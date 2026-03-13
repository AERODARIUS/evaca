const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { HttpsError } = require("firebase-functions/v2/https");
const { asNumber, asString } = require("./primitives");
const { SAFE_ERROR_MESSAGES } = require("./errors");

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_COLLECTION = "_rateLimits";

function getClientIp(request) {
  const forwardedFor = request?.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    const first = forwardedFor.split(",")[0].trim();
    if (first) {
      return first;
    }
  }

  return (
    request?.ip ||
    request?.socket?.remoteAddress ||
    request?.rawRequest?.ip ||
    "unknown"
  );
}

function sanitizeRateLimitKeyPart(value) {
  const clean = asString(value).toLowerCase();
  return clean.replace(/[^a-z0-9._:-]/g, "_").slice(0, 120) || "unknown";
}

function getRateLimitWindowStartMs(nowMs = Date.now(), windowMs = RATE_LIMIT_WINDOW_MS) {
  return Math.floor(nowMs / windowMs) * windowMs;
}

function toRateLimitDocId({
  scope,
  endpoint,
  identity,
  windowStartMs,
}) {
  const keyParts = [
    sanitizeRateLimitKeyPart(scope),
    sanitizeRateLimitKeyPart(endpoint),
    sanitizeRateLimitKeyPart(identity),
    String(windowStartMs),
  ];
  return keyParts.join("|");
}

async function enforceDistributedRateLimit({
  scope,
  endpoint,
  identity,
  nowMs = Date.now(),
  maxRequests = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
  firestore = admin.firestore(),
}) {
  const windowStartMs = getRateLimitWindowStartMs(nowMs, windowMs);
  const rateLimitId = toRateLimitDocId({
    scope,
    endpoint,
    identity,
    windowStartMs,
  });
  const ref = firestore.collection(RATE_LIMIT_COLLECTION).doc(rateLimitId);

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const currentCount = snapshot.exists ? asNumber(snapshot.data()?.count) || 0 : 0;
    if (currentCount >= maxRequests) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.", {
        errorCode: "RATE_LIMITED",
      });
    }

    transaction.set(ref, {
      count: currentCount + 1,
      scope: asString(scope),
      endpoint: asString(endpoint),
      identity: asString(identity),
      windowStartMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(windowStartMs + (windowMs * 2)),
    }, { merge: true });
  });
}

async function enforceRequesterRateLimits({
  endpoint,
  callerUid = null,
  callerIp = null,
}) {
  const checks = [
    enforceDistributedRateLimit({
      scope: "endpoint",
      endpoint,
      identity: endpoint,
    }),
  ];

  if (callerUid) {
    checks.push(enforceDistributedRateLimit({
      scope: "uid",
      endpoint,
      identity: callerUid,
    }));
  }

  if (callerIp) {
    checks.push(enforceDistributedRateLimit({
      scope: "ip",
      endpoint,
      identity: callerIp,
    }));
  }

  await Promise.all(checks);
}

async function requireCallableAuthAndAppCheck(request, functionName) {
  const callerUid = request?.auth?.uid || "anonymous";
  if (!request?.auth?.uid) {
    logger.warn("Callable request rejected", {
      functionName,
      callerUid,
      rejectionReason: "missing-auth",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.AUTH_REQUIRED,
      { errorCode: "AUTH_REQUIRED" },
    );
  }

  if (!request?.app?.appId) {
    logger.warn("Callable request rejected", {
      functionName,
      callerUid,
      rejectionReason: "missing-app-check",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.APP_CHECK_REQUIRED,
      { errorCode: "APP_CHECK_REQUIRED" },
    );
  }

  const callerIp = getClientIp(request?.rawRequest || request);
  await enforceRequesterRateLimits({
    endpoint: functionName,
    callerUid: request.auth.uid,
    callerIp,
  });
  return request.auth.uid;
}

function parseBearerToken(authHeader) {
  if (typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

async function verifyHttpAuthAndAppCheck(request, functionName) {
  const idToken = parseBearerToken(request?.headers?.authorization);
  if (!idToken) {
    logger.warn("HTTP request rejected", {
      functionName,
      callerUid: "anonymous",
      rejectionReason: "missing-auth-token",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.AUTH_REQUIRED,
      { errorCode: "AUTH_REQUIRED" },
    );
  }

  const appCheckToken = request?.headers?.["x-firebase-appcheck"];
  if (typeof appCheckToken !== "string" || appCheckToken.trim() === "") {
    logger.warn("HTTP request rejected", {
      functionName,
      callerUid: "anonymous",
      rejectionReason: "missing-app-check-token",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.APP_CHECK_REQUIRED,
      { errorCode: "APP_CHECK_REQUIRED" },
    );
  }

  let decodedIdToken;
  try {
    decodedIdToken = await admin.auth().verifyIdToken(idToken);
  } catch (_error) {
    logger.warn("HTTP request rejected", {
      functionName,
      callerUid: "anonymous",
      rejectionReason: "invalid-auth-token",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.AUTH_REQUIRED,
      { errorCode: "AUTH_REQUIRED" },
    );
  }

  try {
    await admin.appCheck().verifyToken(appCheckToken);
  } catch (_error) {
    logger.warn("HTTP request rejected", {
      functionName,
      callerUid: decodedIdToken.uid || "anonymous",
      rejectionReason: "invalid-app-check-token",
    });
    throw new HttpsError(
      "unauthenticated",
      SAFE_ERROR_MESSAGES.APP_CHECK_REQUIRED,
      { errorCode: "APP_CHECK_REQUIRED" },
    );
  }

  const callerUid = decodedIdToken.uid || "anonymous";
  const callerIp = getClientIp(request);
  await enforceRequesterRateLimits({
    endpoint: functionName,
    callerUid,
    callerIp,
  });
  return { callerUid, callerIp };
}

module.exports = {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_COLLECTION,
  getClientIp,
  sanitizeRateLimitKeyPart,
  getRateLimitWindowStartMs,
  toRateLimitDocId,
  enforceDistributedRateLimit,
  enforceRequesterRateLimits,
  requireCallableAuthAndAppCheck,
  parseBearerToken,
  verifyHttpAuthAndAppCheck,
};
