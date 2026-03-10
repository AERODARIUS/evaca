const { randomUUID } = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ETORO_API_KEY = defineSecret("ETORO_API_KEY");
const ETORO_USER_KEY = defineSecret("ETORO_USER_KEY");
const ETORO_BASE_URL = "https://public-api.etoro.com/api/v1";
const ETORO_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const ETORO_MAX_RETRIES = 2;
const ETORO_REQUEST_TIMEOUT_MS = 8000;
const ETORO_RETRY_BASE_DELAY_MS = 250;
const ETORO_RETRY_JITTER_MS = 120;
const ETORO_SEARCH_PAGE_SIZE = 50;
const ETORO_SEARCH_MAX_PAGES = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_MAX_BUCKETS = 5000;
const rateLimitBuckets = new Map();
const SAFE_ERROR_MESSAGES = Object.freeze({
  ETORO_BAD_REQUEST: "Request validation failed.",
  ETORO_FORBIDDEN: "Request could not be authorized.",
  ETORO_NOT_FOUND: "Requested resource was not found.",
  ETORO_UNAVAILABLE: "Provider is temporarily unavailable.",
  ETORO_INTERNAL: "Provider request failed.",
  AUTH_REQUIRED: "Authentication is required.",
  APP_CHECK_REQUIRED: "App Check is required.",
  INTERNAL: "Internal error.",
});

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (
      asNumber(payload.instrumentId) !== null ||
      asNumber(payload.InstrumentID) !== null ||
      asNumber(payload.instrumentID) !== null
    ) {
      return [payload];
    }

    const candidates = [
      payload.items,
      payload.Items,
      payload.results,
      payload.Results,
      payload.data,
      payload.Data,
      payload.instruments,
      payload.Instruments,
      payload.value,
      payload.Value,
      payload.pageItems,
      payload.PageItems,
      payload.content,
      payload.Content,
      payload.instrumentsList,
      payload.InstrumentsList,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") {
        const nested = extractItems(candidate);
        if (nested.length > 0) {
          return nested;
        }
      }
    }
  }

  return [];
}

function normalizeInstrument(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const instrumentId =
    asNumber(item.instrumentId) ??
    asNumber(item.InstrumentID) ??
    asNumber(item.instrumentID) ??
    asNumber(item.instrument_id) ??
    asNumber(item.id) ??
    asNumber(item.ID);
  const symbol =
    asString(item.internalSymbolFull) ||
    asString(item.InternalSymbolFull) ||
    asString(item.internalSymbol) ||
    asString(item.InternalSymbol) ||
    asString(item.symbol) ||
    asString(item.Symbol) ||
    asString(item.ticker) ||
    asString(item.Ticker) ||
    asString(item.shortSymbol) ||
    asString(item.ShortSymbol) ||
    "";
  const displayName =
    asString(item.displayname) ||
    asString(item.displayName) ||
    asString(item.DisplayName) ||
    asString(item.instrumentName) ||
    asString(item.InstrumentName) ||
    asString(item.name) ||
    asString(item.Name) ||
    symbol;

  if (instrumentId === null || instrumentId <= 0 || symbol.length === 0) {
    return null;
  }

  return {
    instrumentId,
    symbol,
    displayName,
  };
}

function normalizeInstrumentRate(item) {
  const normalized = normalizeInstrument(item);
  if (!normalized) {
    return null;
  }

  const rate = extractPrice(item);
  if (rate === null) {
    return null;
  }

  return {
    ...normalized,
    rate,
  };
}

function extractPrice(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const direct =
    asNumber(item.rate) ??
    asNumber(item.currentRate) ??
    asNumber(item.currentPrice) ??
    asNumber(item.lastPrice) ??
    asNumber(item.close) ??
    asNumber(item.bid) ??
    asNumber(item.ask);

  if (direct !== null) {
    return direct;
  }

  const buy = asNumber(item.buyRate) ?? asNumber(item.buy);
  const sell = asNumber(item.sellRate) ?? asNumber(item.sell);
  if (buy !== null && sell !== null) {
    return (buy + sell) / 2;
  }

  return null;
}

async function callEtoro(path, apiKey, userKey) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getRetryDelay = (attempt) =>
    ETORO_RETRY_BASE_DELAY_MS * (attempt + 1) +
    Math.floor(Math.random() * ETORO_RETRY_JITTER_MS);

  for (let attempt = 0; attempt <= ETORO_MAX_RETRIES; attempt += 1) {
    const startMs = Date.now();
    let response;
    let payload = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ETORO_REQUEST_TIMEOUT_MS);

    try {
      response = await fetch(`${ETORO_BASE_URL}${path}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "x-request-id": randomUUID(),
          "x-api-key": apiKey,
          "x-user-key": userKey,
        },
      });
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      logger.warn("eToro network error", {
        path,
        attempt,
        errorMessage: message,
        durationMs: Date.now() - startMs,
      });
      if (attempt < ETORO_MAX_RETRIES) {
        await delay(getRetryDelay(attempt));
        continue;
      }

      throw new HttpsError(
        "unavailable",
        SAFE_ERROR_MESSAGES.ETORO_UNAVAILABLE,
        { errorCode: "ETORO_UNAVAILABLE" },
      );
    } finally {
      clearTimeout(timeout);
    }

    logger.info("eToro response received", {
      path,
      attempt,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startMs,
    });

    if (!response.ok) {
      const serverMessage =
        payload &&
        typeof payload === "object" &&
        typeof payload.message === "string"
          ? payload.message
          : `HTTP ${response.status}`;
      logger.warn("eToro non-OK response", {
        path,
        attempt,
        status: response.status,
        serverMessage,
      });

      if (
        ETORO_RETRYABLE_STATUSES.has(response.status) &&
        attempt < ETORO_MAX_RETRIES
      ) {
        await delay(getRetryDelay(attempt));
        continue;
      }

      if (response.status === 400) {
        throw new HttpsError(
          "invalid-argument",
          SAFE_ERROR_MESSAGES.ETORO_BAD_REQUEST,
          { errorCode: "ETORO_BAD_REQUEST" },
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new HttpsError(
          "permission-denied",
          SAFE_ERROR_MESSAGES.ETORO_FORBIDDEN,
          { errorCode: "ETORO_FORBIDDEN" },
        );
      }

      if (response.status === 404) {
        throw new HttpsError(
          "not-found",
          SAFE_ERROR_MESSAGES.ETORO_NOT_FOUND,
          { errorCode: "ETORO_NOT_FOUND" },
        );
      }

      if (response.status === 429 || response.status >= 500) {
        throw new HttpsError(
          "unavailable",
          SAFE_ERROR_MESSAGES.ETORO_UNAVAILABLE,
          { errorCode: "ETORO_UNAVAILABLE" },
        );
      }

      throw new HttpsError(
        "internal",
        SAFE_ERROR_MESSAGES.ETORO_INTERNAL,
        { errorCode: "ETORO_INTERNAL" },
      );
    }

    return payload;
  }

  throw new HttpsError(
    "unavailable",
    SAFE_ERROR_MESSAGES.ETORO_UNAVAILABLE,
    { errorCode: "ETORO_UNAVAILABLE" },
  );
}

function getHttpStatusFromHttpsCode(code) {
  const map = {
    "invalid-argument": 400,
    unauthenticated: 401,
    "permission-denied": 403,
    "not-found": 404,
    "resource-exhausted": 429,
    unavailable: 503,
    internal: 500,
  };
  return map[code] || 500;
}

function toClientError(error, correlationId) {
  if (error instanceof HttpsError) {
    const detailCode =
      error?.details &&
      typeof error.details === "object" &&
      typeof error.details.errorCode === "string"
        ? error.details.errorCode
        : error.code.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    return {
      httpStatus: getHttpStatusFromHttpsCode(error.code),
      code: error.code,
      errorCode: detailCode,
      message: error.message,
      correlationId,
    };
  }

  return {
    httpStatus: 500,
    code: "internal",
    errorCode: "INTERNAL_ERROR",
    message: SAFE_ERROR_MESSAGES.INTERNAL,
    correlationId,
  };
}

function buildSearchCandidates(searchText) {
  const clean = asString(searchText);
  const upper = clean.toUpperCase();
  const isTickerLike = /^[A-Za-z0-9._-]{1,16}$/.test(clean);
  const fields = "instrumentId,internalSymbolFull,displayname";

  if (isTickerLike) {
    return [
      {
        kind: "internalSymbolFull",
        queryValue: upper,
        withPagination: false,
        fields,
      },
    ];
  }

  return [
    {
      kind: "searchText",
      queryValue: clean,
      withPagination: true,
    },
  ];
}

function rankSearchResults(items, searchText) {
  const upper = asString(searchText).toUpperCase();
  if (!upper || items.length === 0) {
    return items;
  }

  const score = (item) => {
    const symbol = asString(item.symbol).toUpperCase();
    const displayName = asString(item.displayName).toUpperCase();

    if (symbol === upper) {
      return 100;
    }

    if (symbol === `${upper}USD` || symbol === `${upper}USDT`) {
      return 90;
    }

    if (symbol.startsWith(upper)) {
      return 70;
    }

    if (displayName.includes(upper)) {
      return 40;
    }

    return 0;
  };

  return [...items].sort((a, b) => score(b) - score(a));
}

function isSearchMatch(item, searchText) {
  const query = asString(searchText).toUpperCase();
  if (!query) {
    return true;
  }

  const symbol = asString(item.symbol).toUpperCase();
  const displayName = asString(item.displayName).toUpperCase();
  const compactQuery = query.replace(/[^A-Z0-9]/g, "");
  const compactSymbol = symbol.replace(/[^A-Z0-9]/g, "");
  const compactDisplayName = displayName.replace(/[^A-Z0-9]/g, "");

  return (
    symbol === query ||
    symbol.startsWith(query) ||
    symbol.includes(query) ||
    displayName.includes(query) ||
    (compactQuery.length > 0 &&
      (compactSymbol.includes(compactQuery) ||
        compactDisplayName.includes(compactQuery)))
  );
}

function summarizePayload(payload) {
  if (Array.isArray(payload)) {
    return { type: "array", length: payload.length };
  }

  if (payload && typeof payload === "object") {
    return {
      type: "object",
      keys: Object.keys(payload).slice(0, 20),
    };
  }

  return { type: typeof payload };
}

function requireSecretValue(secret, label) {
  const value = secret.value();
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpsError(
      "failed-precondition",
      `Missing required secret: ${label}`,
    );
  }

  return value.trim();
}

function getEtoroSecretKeys() {
  return {
    apiKey: requireSecretValue(ETORO_API_KEY, "ETORO_API_KEY"),
    userKey: requireSecretValue(ETORO_USER_KEY, "ETORO_USER_KEY"),
  };
}

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

function enforceRateLimit(scope, identity) {
  const now = Date.now();
  const key = `${scope}:${identity}`;
  const recent = rateLimitBuckets.get(key) || [];
  const activeWindow = recent.filter((entry) => now - entry < RATE_LIMIT_WINDOW_MS);

  if (activeWindow.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpsError("resource-exhausted", "Too many requests. Try again later.", {
      errorCode: "RATE_LIMITED",
    });
  }

  activeWindow.push(now);
  rateLimitBuckets.set(key, activeWindow);

  // Keep bucket growth bounded under noisy traffic patterns.
  if (rateLimitBuckets.size > RATE_LIMIT_MAX_BUCKETS) {
    for (const [bucketKey, timestamps] of rateLimitBuckets.entries()) {
      const hasActiveEntry = timestamps.some((entry) => now - entry < RATE_LIMIT_WINDOW_MS);
      if (!hasActiveEntry) {
        rateLimitBuckets.delete(bucketKey);
      }
      if (rateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
        break;
      }
    }
  }
}

function requireCallableAuthAndAppCheck(request, functionName) {
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

  enforceRateLimit(functionName, `uid:${request.auth.uid}`);
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

function asDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  return null;
}

function isAlertDue(lastCheckedAtValue, intervalMinutes, nowMs = Date.now()) {
  const checkedAt = asDate(lastCheckedAtValue);
  if (!checkedAt) {
    return true;
  }

  const intervalMs = Math.max(1, Number(intervalMinutes) || 1) * 60 * 1000;
  return nowMs - checkedAt.getTime() >= intervalMs;
}

function shouldCreateNotification(conditionMatched, lastTriggeredAtValue, lastCheckedAtValue) {
  if (!conditionMatched) {
    return false;
  }

  const lastTriggeredAt = asDate(lastTriggeredAtValue);
  const lastCheckedAt = asDate(lastCheckedAtValue);
  if (!lastTriggeredAt || !lastCheckedAt) {
    return true;
  }

  return lastTriggeredAt.getTime() < lastCheckedAt.getTime();
}

function evaluateFirestoreCondition(condition, currentPrice, targetPrice) {
  if (condition === "above" || condition === "gte") {
    return currentPrice >= targetPrice;
  }

  return currentPrice <= targetPrice;
}

function toNotificationFailureMessage(error) {
  const fallback = "Notification delivery failed.";
  if (!(error instanceof Error) || typeof error.message !== "string") {
    return fallback;
  }

  const trimmed = error.message.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 500);
}

async function runAlertEvaluation({
  snapshot,
  nowMs = Date.now(),
  fetchRate = fetchEtoroInstrumentRate,
  createTimestamp = () => admin.firestore.FieldValue.serverTimestamp(),
  addNotification = (data) => admin.firestore().collection("notifications").add(data),
  log = logger,
}) {
  const dueAlerts = snapshot.docs.filter((docSnapshot) => {
    const alert = docSnapshot.data() || {};
    return isAlertDue(alert.lastCheckedAt, alert.intervalMinutes, nowMs);
  });

  if (dueAlerts.length === 0) {
    log.info("checkAlerts: no alerts due for evaluation");
    return {
      dueAlerts: 0,
      notificationsCreated: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
    };
  }

  const rateCache = new Map();
  const timestamp = createTimestamp();
  let notificationsCreated = 0;
  let notificationsSent = 0;
  let notificationsFailed = 0;

  for (const docSnapshot of dueAlerts) {
    const alert = docSnapshot.data() || {};
    const alertId = docSnapshot.id;
    const instrumentId = asNumber(alert.instrumentId);
    const targetPrice = asNumber(alert.targetPrice);
    const condition = asString(alert.condition);

    if (!instrumentId || targetPrice === null || !condition) {
      log.warn("checkAlerts: invalid alert payload skipped", { alertId });
      continue;
    }

    let triggerPrice;
    if (rateCache.has(instrumentId)) {
      triggerPrice = rateCache.get(instrumentId);
    } else {
      const rateResult = await fetchRate(instrumentId);
      triggerPrice = rateResult.rate;
      rateCache.set(instrumentId, triggerPrice);
    }

    const conditionMatched = evaluateFirestoreCondition(
      condition,
      triggerPrice,
      targetPrice,
    );
    const willCreateNotification = shouldCreateNotification(
      conditionMatched,
      alert.lastTriggeredAt,
      alert.lastCheckedAt,
    );

    if (willCreateNotification) {
      const notificationData = {
        userId: asString(alert.userId),
        alertId,
        instrumentId,
        symbol: asString(alert.symbol),
        displayName: asString(alert.displayName),
        condition,
        targetPrice,
        triggerPrice,
        status: "pending",
        errorMessage: null,
        createdAt: timestamp,
      };
      let notificationRef = null;

      try {
        notificationRef = await addNotification(notificationData);
        notificationsCreated += 1;
        await notificationRef.update({
          status: "sent",
          errorMessage: null,
        });
        notificationsSent += 1;
      } catch (error) {
        notificationsFailed += 1;
        log.error("checkAlerts: notification delivery update failed", {
          alertId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        if (notificationRef) {
          try {
            await notificationRef.update({
              status: "failed",
              errorMessage: toNotificationFailureMessage(error),
            });
          } catch (nestedError) {
            log.error("checkAlerts: notification failure status update failed", {
              alertId,
              errorMessage: nestedError instanceof Error ?
                nestedError.message :
                String(nestedError),
            });
          }
        }
      }
    }

    await docSnapshot.ref.update({
      lastCheckedAt: timestamp,
      ...(willCreateNotification ? { lastTriggeredAt: timestamp } : {}),
      updatedAt: timestamp,
    });
  }

  log.info("checkAlerts: evaluation completed", {
    activeAlerts: snapshot.size,
    dueAlerts: dueAlerts.length,
    notificationsCreated,
    notificationsSent,
    notificationsFailed,
  });

  return {
    dueAlerts: dueAlerts.length,
    notificationsCreated,
    notificationsSent,
    notificationsFailed,
  };
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
  enforceRateLimit(functionName, `uid:${callerUid}`);
  enforceRateLimit(functionName, `ip:${callerIp}`);
  return { callerUid, callerIp };
}

async function searchEtoroAssets(searchText) {
  const trimmedSearchText = asString(searchText);
  if (!trimmedSearchText) {
    throw new HttpsError("invalid-argument", "searchText is required.");
  }

  const { apiKey, userKey } = getEtoroSecretKeys();
  const candidates = buildSearchCandidates(trimmedSearchText);
  const rawItems = [];

  for (const candidate of candidates) {
    for (
      let pageNumber = 1;
      pageNumber <= (candidate.withPagination ? ETORO_SEARCH_MAX_PAGES : 1);
      pageNumber += 1
    ) {
      const query = new URLSearchParams();
      query.set(candidate.kind, candidate.queryValue);
      query.set("pageSize", String(ETORO_SEARCH_PAGE_SIZE));
      query.set("pageNumber", String(pageNumber));
      if (candidate.fields) {
        query.set("fields", candidate.fields);
      }

      logger.info("eToro search request", {
        searchText: trimmedSearchText,
        mode: candidate.kind,
        pageNumber,
      });

      const payload = await callEtoro(
        `/market-data/search?${query.toString()}`,
        apiKey,
        userKey,
      );
      const pageItems = extractItems(payload);
      rawItems.push(...pageItems);

      if (pageItems.length < ETORO_SEARCH_PAGE_SIZE) {
        break;
      }
    }
  }

  const dedupedByInstrumentId = Array.from(
    new Map(
      rawItems.map((item) => {
        const id =
          asNumber(item?.instrumentId) ??
          asNumber(item?.InstrumentID) ??
          asNumber(item?.instrumentID) ??
          asNumber(item?.id);
        return [id ?? randomUUID(), item];
      }),
    ).values(),
  );
  const normalizedItems = dedupedByInstrumentId
    .map(normalizeInstrument)
    .filter((item) => item !== null);

  const rankedItems = rankSearchResults(normalizedItems, trimmedSearchText);
  const items = rankedItems.filter((item) =>
    isSearchMatch(item, trimmedSearchText),
  );

  logger.info("eToro search response", {
    totalRawItems: rawItems.length,
    totalDedupedItems: dedupedByInstrumentId.length,
    totalNormalizedItems: normalizedItems.length,
    totalMatchedItems: items.length,
  });

  return { items };
}

async function fetchEtoroInstrumentRate(instrumentIdValue) {
  const instrumentId = asNumber(instrumentIdValue);
  if (instrumentId === null) {
    throw new HttpsError("invalid-argument", "instrumentId is required.");
  }

  const query = new URLSearchParams({
    instrumentIds: String(instrumentId),
  });
  const { apiKey, userKey } = getEtoroSecretKeys();

  const payload = await callEtoro(
    `/market-data/instruments/rates?${query.toString()}`,
    apiKey,
    userKey,
  );

  const items = extractItems(payload);
  const exactItem = items.find((item) => {
    const itemId =
      asNumber(item?.instrumentId) ??
      asNumber(item?.InstrumentID) ??
      asNumber(item?.instrumentID);
    return itemId === instrumentId;
  });

  const selected = exactItem ?? (items.length > 0 ? items[0] : payload);
  const item = normalizeInstrumentRate(selected);

  if (!item) {
    throw new HttpsError(
      "not-found",
      "Rate not available for this instrument.",
    );
  }

  return {
    item,
    rate: item.rate,
  };
}

exports.searchEtoroInstruments = onCall(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
    enforceAppCheck: true,
  },
  async (request) => {
    const correlationId = randomUUID();
    try {
      requireCallableAuthAndAppCheck(request, "searchEtoroInstruments");
      return searchEtoroAssets(request.data?.searchText);
    } catch (error) {
      const clientError = toClientError(error, correlationId);
      logger.error("searchEtoroInstruments failed", {
        correlationId,
        code: clientError.code,
        errorCode: clientError.errorCode,
        rawError: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(clientError.code, clientError.message, {
        errorCode: clientError.errorCode,
        correlationId,
      });
    }
  },
);

exports.getEtoroInstrumentRate = onCall(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
    enforceAppCheck: true,
  },
  async (request) => {
    const correlationId = randomUUID();
    try {
      requireCallableAuthAndAppCheck(request, "getEtoroInstrumentRate");
      return fetchEtoroInstrumentRate(request.data?.instrumentId);
    } catch (error) {
      const clientError = toClientError(error, correlationId);
      logger.error("getEtoroInstrumentRate failed", {
        correlationId,
        code: clientError.code,
        errorCode: clientError.errorCode,
        rawError: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(clientError.code, clientError.message, {
        errorCode: clientError.errorCode,
        correlationId,
      });
    }
  },
);

exports.marketDataSearchHttp = onRequest(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request, response) => {
    const correlationId = randomUUID();
    if (request.method !== "GET") {
      response.status(405).json({
        error: "Method not allowed. Use GET.",
        code: "method-not-allowed",
        errorCode: "METHOD_NOT_ALLOWED",
        correlationId,
      });
      return;
    }

    try {
      await verifyHttpAuthAndAppCheck(request, "marketDataSearchHttp");
      const result = await searchEtoroAssets(request.query.searchText);
      response.status(200).json(result);
    } catch (error) {
      const clientError = toClientError(error, correlationId);
      logger.error("marketDataSearchHttp failed", {
        correlationId,
        code: clientError.code,
        errorCode: clientError.errorCode,
        rawError: error instanceof Error ? error.message : String(error),
      });
      response.status(clientError.httpStatus).json({
        error: clientError.message,
        code: clientError.code,
        errorCode: clientError.errorCode,
        correlationId,
      });
    }
  },
);

exports.marketDataInstrumentRatesHttp = onRequest(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request, response) => {
    const correlationId = randomUUID();
    if (request.method !== "GET") {
      response.status(405).json({
        error: "Method not allowed. Use GET.",
        code: "method-not-allowed",
        errorCode: "METHOD_NOT_ALLOWED",
        correlationId,
      });
      return;
    }

    try {
      await verifyHttpAuthAndAppCheck(request, "marketDataInstrumentRatesHttp");
      const result = await fetchEtoroInstrumentRate(request.query.instrumentId);
      response.status(200).json(result);
    } catch (error) {
      const clientError = toClientError(error, correlationId);
      logger.error("marketDataInstrumentRatesHttp failed", {
        correlationId,
        code: clientError.code,
        errorCode: clientError.errorCode,
        rawError: error instanceof Error ? error.message : String(error),
      });
      response.status(clientError.httpStatus).json({
        error: clientError.message,
        code: clientError.code,
        errorCode: clientError.errorCode,
        correlationId,
      });
    }
  },
);

exports.listUserNotifications = onCall(
  {
    cors: true,
    enforceAppCheck: true,
  },
  async (request) => {
    const correlationId = randomUUID();
    try {
      const callerUid = requireCallableAuthAndAppCheck(request, "listUserNotifications");
      const snapshot = await admin.firestore().collection("notifications")
        .where("userId", "==", callerUid)
        .get();
      const items = snapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .sort((a, b) => {
          const aDate = asDate(a.createdAt);
          const bDate = asDate(b.createdAt);
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        });
      return { items };
    } catch (error) {
      const clientError = toClientError(error, correlationId);
      logger.error("listUserNotifications failed", {
        correlationId,
        code: clientError.code,
        errorCode: clientError.errorCode,
        rawError: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(clientError.code, clientError.message, {
        errorCode: clientError.errorCode,
        correlationId,
      });
    }
  },
);

exports.checkAlerts = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Etc/UTC",
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
  },
  async () => {
    const snapshot = await admin.firestore().collection("alerts").where("isActive", "==", true).get();
    if (snapshot.empty) {
      logger.info("checkAlerts: no active alerts found");
      return;
    }
    await runAlertEvaluation({ snapshot });
  },
);

exports.__test = {
  extractItems,
  normalizeInstrument,
  normalizeInstrumentRate,
  extractPrice,
  asNumber,
  asString,
  rankSearchResults,
  isSearchMatch,
  parseBearerToken,
  requireCallableAuthAndAppCheck,
  getClientIp,
  asDate,
  isAlertDue,
  shouldCreateNotification,
  evaluateFirestoreCondition,
  toNotificationFailureMessage,
  enforceRateLimit,
  buildSearchCandidates,
  verifyHttpAuthAndAppCheck,
  toClientError,
  getHttpStatusFromHttpsCode,
  runAlertEvaluation,
  __rateLimitBuckets: rateLimitBuckets,
};
