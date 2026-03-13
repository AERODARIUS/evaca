const { randomUUID } = require("crypto");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { asNumber, asString, asDate } = require("./primitives");
const { toNotificationFailureMessage } = require("./errors");
const { RATE_LIMIT_COLLECTION } = require("./rateLimit");

const DEFAULT_CHECK_ALERTS_BATCH_SIZE = 100;
const DEFAULT_CHECK_ALERTS_CONCURRENCY = 5;
const DEFAULT_CHECK_ALERTS_MAX_BATCHES = 10;
const DEFAULT_CHECK_ALERTS_LEASE_DURATION_MS = 55 * 1000;
const CHECK_ALERTS_LEASE_ID = "checkAlerts";
const DEFAULT_OPS_CLEANUP_BATCH_SIZE = 250;
const DEFAULT_OPS_CLEANUP_MAX_BATCHES = 10;
const DEFAULT_SCHEDULER_LEASE_RETENTION_MS = 24 * 60 * 60 * 1000;

function asPositiveInteger(value, fallback, minimum = 1, maximum = 1000) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum) {
    return fallback;
  }

  return Math.min(numeric, maximum);
}

function getCheckAlertsConfig(env = process.env) {
  return {
    batchSize: asPositiveInteger(
      env.CHECK_ALERTS_BATCH_SIZE,
      DEFAULT_CHECK_ALERTS_BATCH_SIZE,
      1,
      500,
    ),
    concurrency: asPositiveInteger(
      env.CHECK_ALERTS_CONCURRENCY,
      DEFAULT_CHECK_ALERTS_CONCURRENCY,
      1,
      20,
    ),
    maxBatches: asPositiveInteger(
      env.CHECK_ALERTS_MAX_BATCHES,
      DEFAULT_CHECK_ALERTS_MAX_BATCHES,
      1,
      100,
    ),
    leaseDurationMs: asPositiveInteger(
      env.CHECK_ALERTS_LEASE_DURATION_MS,
      DEFAULT_CHECK_ALERTS_LEASE_DURATION_MS,
      10 * 1000,
      10 * 60 * 1000,
    ),
  };
}

async function acquireSchedulerLease({
  firestore = admin.firestore(),
  lockId = CHECK_ALERTS_LEASE_ID,
  nowMs = Date.now(),
  leaseDurationMs = DEFAULT_CHECK_ALERTS_LEASE_DURATION_MS,
  ownerId = randomUUID(),
}) {
  const lockRef = firestore.collection("schedulerLeases").doc(lockId);
  const nowDate = new Date(nowMs);
  const leaseExpiresAt = new Date(nowMs + leaseDurationMs);

  const acquired = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const currentExpiresAt = asDate(snapshot.data()?.leaseExpiresAt);
    if (currentExpiresAt && currentExpiresAt.getTime() > nowMs) {
      return false;
    }

    transaction.set(lockRef, {
      lockId,
      leaseOwnerId: ownerId,
      leaseAcquiredAt: nowDate,
      leaseExpiresAt,
      updatedAt: nowDate,
    });
    return true;
  });

  return {
    acquired,
    lockId,
    ownerId,
    leaseExpiresAt,
  };
}

async function releaseSchedulerLease({
  firestore = admin.firestore(),
  lockId = CHECK_ALERTS_LEASE_ID,
  ownerId,
  releasedAtMs = Date.now(),
}) {
  if (!ownerId) {
    return false;
  }

  const lockRef = firestore.collection("schedulerLeases").doc(lockId);
  const releasedAt = new Date(releasedAtMs);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    if (!snapshot.exists || snapshot.data()?.leaseOwnerId !== ownerId) {
      return false;
    }

    transaction.update(lockRef, {
      leaseExpiresAt: releasedAt,
      updatedAt: releasedAt,
    });
    return true;
  });
}

function buildNotificationDedupeKey({
  alertId,
  lastCheckedAtValue,
  intervalMinutes,
  nowMs = Date.now(),
}) {
  const lastCheckedAt = asDate(lastCheckedAtValue);
  if (lastCheckedAt) {
    return `${alertId}:${lastCheckedAt.getTime()}`;
  }

  const safeIntervalMs = Math.max(1, asNumber(intervalMinutes) || 1) * 60 * 1000;
  const windowStartMs = Math.floor(nowMs / safeIntervalMs) * safeIntervalMs;
  return `${alertId}:initial:${windowStartMs}`;
}

async function createIdempotentNotification({
  firestore = admin.firestore(),
  dedupeKey,
  notificationData,
}) {
  const notificationRef = firestore.collection("notifications").doc(dedupeKey);
  const created = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(notificationRef);
    if (snapshot.exists) {
      return false;
    }

    transaction.set(notificationRef, {
      ...notificationData,
      dedupeKey,
    });
    return true;
  });

  return {
    created,
    ref: notificationRef,
  };
}

function computeNextCheckAtDate(intervalMinutes, nowMs = Date.now()) {
  const safeMinutes = Math.max(1, asNumber(intervalMinutes) || 1);
  return new Date(nowMs + safeMinutes * 60 * 1000);
}

function buildDueAlertsQuery({
  firestore,
  nowDate,
  batchSize,
  cursor = null,
}) {
  let alertsQuery = firestore.collection("alerts")
    .where("isActive", "==", true)
    .where("nextCheckAt", "<=", nowDate)
    .orderBy("nextCheckAt", "asc")
    .limit(batchSize);

  if (cursor) {
    alertsQuery = alertsQuery.startAfter(cursor);
  }

  return alertsQuery;
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

async function runAlertEvaluation({
  alertDocs,
  nowMs = Date.now(),
  fetchRate,
  createTimestamp = () => admin.firestore.FieldValue.serverTimestamp(),
  createNotificationRecord = (params) => createIdempotentNotification({
    firestore: admin.firestore(),
    ...params,
  }),
  log = logger,
  concurrency = DEFAULT_CHECK_ALERTS_CONCURRENCY,
}) {
  const dueAlerts = Array.isArray(alertDocs) ? alertDocs : [];
  if (dueAlerts.length === 0) {
    log.info("checkAlerts: no alerts due for evaluation");
    return {
      dueAlerts: 0,
      processedAlerts: 0,
      skippedAlerts: 0,
      failedAlerts: 0,
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
  let processedAlerts = 0;
  let skippedAlerts = 0;
  let failedAlerts = 0;
  let nextIndex = 0;

  const processAlert = async (docSnapshot) => {
    const alert = docSnapshot.data() || {};
    const alertId = docSnapshot.id;
    const instrumentId = asNumber(alert.instrumentId);
    const targetPrice = asNumber(alert.targetPrice);
    const condition = asString(alert.condition);
    const nextCheckAt = computeNextCheckAtDate(alert.intervalMinutes, nowMs);

    if (!instrumentId || targetPrice === null || !condition) {
      skippedAlerts += 1;
      log.warn("checkAlerts: invalid alert payload skipped", { alertId });
      await docSnapshot.ref.update({
        lastCheckedAt: timestamp,
        nextCheckAt,
        updatedAt: timestamp,
      });
      return;
    }

    let triggerPrice = null;
    try {
      if (rateCache.has(instrumentId)) {
        triggerPrice = rateCache.get(instrumentId);
      } else {
        const rateResult = await fetchRate(instrumentId);
        triggerPrice = rateResult.rate;
        rateCache.set(instrumentId, triggerPrice);
      }
    } catch (error) {
      failedAlerts += 1;
      log.error("checkAlerts: rate fetch failed", {
        alertId,
        instrumentId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      await docSnapshot.ref.update({
        lastCheckedAt: timestamp,
        nextCheckAt,
        updatedAt: timestamp,
      });
      return;
    }

    const conditionMatched = evaluateFirestoreCondition(
      condition,
      triggerPrice,
      targetPrice,
    );
    let nextLastTriggeredAt = null;
    const willCreateNotification = shouldCreateNotification(
      conditionMatched,
      alert.lastTriggeredAt,
      alert.lastCheckedAt,
    );

    if (willCreateNotification) {
      const dedupeKey = buildNotificationDedupeKey({
        alertId,
        lastCheckedAtValue: alert.lastCheckedAt,
        intervalMinutes: alert.intervalMinutes,
        nowMs,
      });
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
      let notificationCreated = false;
      let notificationAlreadyExists = false;

      try {
        const creation = await createNotificationRecord({
          dedupeKey,
          notificationData,
        });
        notificationRef = creation.ref;
        notificationCreated = creation.created;
        notificationAlreadyExists = !creation.created;
        if (notificationAlreadyExists) {
          log.info("checkAlerts: duplicate notification skipped", { alertId, dedupeKey });
        }
      } catch (error) {
        notificationsFailed += 1;
        log.error("checkAlerts: idempotent notification create failed", {
          alertId,
          dedupeKey,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      if (notificationRef && notificationCreated) {
        notificationsCreated += 1;
        try {
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

      if (notificationCreated || notificationAlreadyExists) {
        nextLastTriggeredAt = timestamp;
      }
    }

    await docSnapshot.ref.update({
      lastCheckedAt: timestamp,
      nextCheckAt,
      ...(nextLastTriggeredAt ? { lastTriggeredAt: nextLastTriggeredAt } : {}),
      updatedAt: timestamp,
    });
    processedAlerts += 1;
  };

  const workers = Array.from({ length: Math.min(concurrency, dueAlerts.length) }, () =>
    (async () => {
      while (nextIndex < dueAlerts.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const docSnapshot = dueAlerts[currentIndex];
        try {
          await processAlert(docSnapshot);
        } catch (error) {
          failedAlerts += 1;
          log.error("checkAlerts: alert evaluation failed", {
            alertId: docSnapshot?.id || "unknown",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })());

  await Promise.all(workers);

  log.info("checkAlerts: evaluation completed", {
    activeAlerts: dueAlerts.length,
    dueAlerts: dueAlerts.length,
    processedAlerts,
    skippedAlerts,
    failedAlerts,
    notificationsCreated,
    notificationsSent,
    notificationsFailed,
  });

  return {
    dueAlerts: dueAlerts.length,
    processedAlerts,
    skippedAlerts,
    failedAlerts,
    notificationsCreated,
    notificationsSent,
    notificationsFailed,
  };
}

async function deleteExpiredCollectionDocs({
  firestore = admin.firestore(),
  collectionName,
  timestampField,
  cutoffDate,
  batchSize = DEFAULT_OPS_CLEANUP_BATCH_SIZE,
  maxBatches = DEFAULT_OPS_CLEANUP_MAX_BATCHES,
}) {
  let deletedCount = 0;
  const safeBatchSize = Math.max(1, batchSize);
  const safeMaxBatches = Math.max(1, maxBatches);

  for (let batchIndex = 0; batchIndex < safeMaxBatches; batchIndex += 1) {
    const snapshot = await firestore.collection(collectionName)
      .where(timestampField, "<=", cutoffDate)
      .limit(safeBatchSize)
      .get();
    if (snapshot.empty) {
      break;
    }

    await Promise.all(snapshot.docs.map((docSnapshot) => docSnapshot.ref.delete()));
    deletedCount += snapshot.docs.length;

    if (snapshot.docs.length < safeBatchSize) {
      break;
    }
  }

  return deletedCount;
}

async function cleanupOperationalCollections({
  firestore = admin.firestore(),
  nowMs = Date.now(),
  batchSize = DEFAULT_OPS_CLEANUP_BATCH_SIZE,
  maxBatches = DEFAULT_OPS_CLEANUP_MAX_BATCHES,
  schedulerLeaseRetentionMs = DEFAULT_SCHEDULER_LEASE_RETENTION_MS,
  cleanupDocs = deleteExpiredCollectionDocs,
  log = logger,
}) {
  const nowDate = new Date(nowMs);
  const schedulerLeaseCutoffDate = new Date(nowMs - schedulerLeaseRetentionMs);

  const rateLimitsDeleted = await cleanupDocs({
    firestore,
    collectionName: RATE_LIMIT_COLLECTION,
    timestampField: "expiresAt",
    cutoffDate: nowDate,
    batchSize,
    maxBatches,
  });
  const schedulerLeasesDeleted = await cleanupDocs({
    firestore,
    collectionName: "schedulerLeases",
    timestampField: "leaseExpiresAt",
    cutoffDate: schedulerLeaseCutoffDate,
    batchSize,
    maxBatches,
  });

  const summary = {
    rateLimitsDeleted,
    schedulerLeasesDeleted,
    totalDeleted: rateLimitsDeleted + schedulerLeasesDeleted,
    checkedAt: nowDate.toISOString(),
  };
  log.info("cleanupOperationalCollections completed", summary);
  return summary;
}

module.exports = {
  DEFAULT_CHECK_ALERTS_BATCH_SIZE,
  DEFAULT_CHECK_ALERTS_CONCURRENCY,
  DEFAULT_CHECK_ALERTS_MAX_BATCHES,
  DEFAULT_CHECK_ALERTS_LEASE_DURATION_MS,
  CHECK_ALERTS_LEASE_ID,
  DEFAULT_OPS_CLEANUP_BATCH_SIZE,
  DEFAULT_OPS_CLEANUP_MAX_BATCHES,
  DEFAULT_SCHEDULER_LEASE_RETENTION_MS,
  getCheckAlertsConfig,
  acquireSchedulerLease,
  releaseSchedulerLease,
  buildNotificationDedupeKey,
  createIdempotentNotification,
  computeNextCheckAtDate,
  buildDueAlertsQuery,
  isAlertDue,
  shouldCreateNotification,
  evaluateFirestoreCondition,
  runAlertEvaluation,
  deleteExpiredCollectionDocs,
  cleanupOperationalCollections,
};
