const { randomUUID } = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const { asNumber, asString, asDate } = require("./src/primitives");
const {
  SAFE_ERROR_MESSAGES,
  getHttpStatusFromHttpsCode,
  toClientError,
  toNotificationFailureMessage,
} = require("./src/errors");
const {
  normalizePageSize,
  encodePageToken,
  decodePageToken,
} = require("./src/pagination");
const {
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
} = require("./src/rateLimit");
const {
  extractItems,
  normalizeInstrument,
  normalizeInstrumentRate,
  extractInstrumentId,
  extractPrice,
  summarizePayload,
  toEtoroQueryString,
  buildSearchCandidates,
  rankSearchResults,
  isSearchMatch,
  createMarketDataService,
} = require("./src/marketData");
const {
  CHECK_ALERTS_LEASE_ID,
  DEFAULT_CHECK_ALERTS_CONCURRENCY,
  getCheckAlertsConfig,
  acquireSchedulerLease,
  releaseSchedulerLease,
  buildDueAlertsQuery,
  runAlertEvaluation,
  buildNotificationDedupeKey,
  createIdempotentNotification,
  computeNextCheckAtDate,
  isAlertDue,
  shouldCreateNotification,
  evaluateFirestoreCondition,
  deleteExpiredCollectionDocs,
  cleanupOperationalCollections,
} = require("./src/scheduler");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ETORO_API_KEY = defineSecret("ETORO_API_KEY");
const ETORO_USER_KEY = defineSecret("ETORO_USER_KEY");

const marketDataService = createMarketDataService({
  etoroApiKeySecret: ETORO_API_KEY,
  etoroUserKeySecret: ETORO_USER_KEY,
});

exports.searchEtoroInstruments = onCall(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
    enforceAppCheck: true,
  },
  async (request) => {
    const correlationId = randomUUID();
    try {
      await requireCallableAuthAndAppCheck(request, "searchEtoroInstruments");
      return marketDataService.searchEtoroAssets(request.data?.searchText);
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
      await requireCallableAuthAndAppCheck(request, "getEtoroInstrumentRate");
      return marketDataService.fetchEtoroInstrumentRate(request.data?.instrumentId);
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
      const result = await marketDataService.searchEtoroAssets(request.query.searchText);
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
      const result = await marketDataService.fetchEtoroInstrumentRate(request.query.instrumentId);
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
      const callerUid = await requireCallableAuthAndAppCheck(request, "listUserNotifications");
      const pageSize = normalizePageSize(request.data?.pageSize);
      const cursorToken = decodePageToken(request.data?.pageToken);
      let notificationsQuery = admin.firestore().collection("notifications")
        .where("userId", "==", callerUid)
        .orderBy("createdAt", "desc")
        .orderBy(admin.firestore.FieldPath.documentId(), "desc")
        .limit(pageSize + 1);

      if (cursorToken) {
        notificationsQuery = notificationsQuery.startAfter(
          new Date(cursorToken.createdAtMs),
          cursorToken.id,
        );
      }

      const snapshot = await notificationsQuery.get();
      const pageDocs = snapshot.docs.slice(0, pageSize);
      const items = pageDocs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
      let nextPageToken = null;
      if (snapshot.docs.length > pageSize) {
        const lastDoc = pageDocs[pageDocs.length - 1];
        const createdAt = asDate(lastDoc.data()?.createdAt);
        if (createdAt) {
          nextPageToken = encodePageToken({
            createdAtMs: createdAt.getTime(),
            id: lastDoc.id,
          });
        }
      }

      return {
        items,
        pageSize,
        nextPageToken,
      };
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
    const startedAtMs = Date.now();
    const nowDate = new Date(startedAtMs);
    const { batchSize, concurrency, maxBatches, leaseDurationMs } = getCheckAlertsConfig();
    const lease = await acquireSchedulerLease({
      firestore: admin.firestore(),
      lockId: CHECK_ALERTS_LEASE_ID,
      nowMs: startedAtMs,
      leaseDurationMs,
    });

    if (!lease.acquired) {
      logger.info("checkAlerts: skipped due to active scheduler lease", {
        lockId: CHECK_ALERTS_LEASE_ID,
      });
      return;
    }

    let totalDueAlerts = 0;
    let totalProcessedAlerts = 0;
    let totalSkippedAlerts = 0;
    let totalFailedAlerts = 0;
    let totalNotificationsCreated = 0;
    let totalNotificationsSent = 0;
    let totalNotificationsFailed = 0;
    let cursor = null;

    try {
      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const dueQuery = buildDueAlertsQuery({
          firestore: admin.firestore(),
          nowDate,
          batchSize,
          cursor,
        });
        const snapshot = await dueQuery.get();
        if (snapshot.empty) {
          break;
        }

        const evaluation = await runAlertEvaluation({
          alertDocs: snapshot.docs,
          nowMs: startedAtMs,
          concurrency,
          fetchRate: marketDataService.fetchEtoroInstrumentRate,
        });

        totalDueAlerts += evaluation.dueAlerts;
        totalProcessedAlerts += evaluation.processedAlerts;
        totalSkippedAlerts += evaluation.skippedAlerts;
        totalFailedAlerts += evaluation.failedAlerts;
        totalNotificationsCreated += evaluation.notificationsCreated;
        totalNotificationsSent += evaluation.notificationsSent;
        totalNotificationsFailed += evaluation.notificationsFailed;

        if (snapshot.docs.length < batchSize) {
          break;
        }

        cursor = snapshot.docs[snapshot.docs.length - 1];
      }

      if (totalDueAlerts === 0) {
        logger.info("checkAlerts: no active alerts found");
        return;
      }

      logger.info("checkAlerts: scheduler run summary", {
        dueAlerts: totalDueAlerts,
        processedAlerts: totalProcessedAlerts,
        skippedAlerts: totalSkippedAlerts,
        failedAlerts: totalFailedAlerts,
        notificationsCreated: totalNotificationsCreated,
        notificationsSent: totalNotificationsSent,
        notificationsFailed: totalNotificationsFailed,
        durationMs: Date.now() - startedAtMs,
        batchSize,
        concurrency,
        maxBatches,
      });
    } finally {
      await releaseSchedulerLease({
        firestore: admin.firestore(),
        lockId: CHECK_ALERTS_LEASE_ID,
        ownerId: lease.ownerId,
      });
    }
  },
);

exports.cleanupOperationalCollections = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Etc/UTC",
  },
  async () => cleanupOperationalCollections(),
);

exports.__test = {
  extractItems,
  normalizeInstrument,
  normalizeInstrumentRate,
  extractInstrumentId,
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
  enforceDistributedRateLimit,
  enforceRequesterRateLimits,
  getRateLimitWindowStartMs,
  toRateLimitDocId,
  sanitizeRateLimitKeyPart,
  normalizePageSize,
  encodePageToken,
  decodePageToken,
  buildSearchCandidates,
  verifyHttpAuthAndAppCheck,
  toClientError,
  getHttpStatusFromHttpsCode,
  runAlertEvaluation,
  buildDueAlertsQuery,
  buildNotificationDedupeKey,
  createIdempotentNotification,
  acquireSchedulerLease,
  releaseSchedulerLease,
  deleteExpiredCollectionDocs,
  cleanupOperationalCollections,
  computeNextCheckAtDate,
  getCheckAlertsConfig,
  SAFE_ERROR_MESSAGES,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_COLLECTION,
  DEFAULT_CHECK_ALERTS_CONCURRENCY,
  summarizePayload,
  toEtoroQueryString,
};
