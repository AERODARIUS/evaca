const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { HttpsError } = require("firebase-functions/v2/https");

const { __test } = require("./index");

const firestoreRulesPath = path.resolve(__dirname, "..", "firestore.rules");
const firestoreIndexesPath = path.resolve(__dirname, "..", "firestore.indexes.json");

function createInMemoryFirestore() {
  const store = new Map();
  const makeRef = (collectionName, id) => ({
    __key: `${collectionName}/${id}`,
    id,
    async update(payload) {
      const current = store.get(this.__key) || {};
      store.set(this.__key, { ...current, ...payload });
    },
  });

  return {
    runTransaction(handler) {
      const transaction = {
        async get(ref) {
          const value = store.get(ref.__key);
          return {
            exists: value !== undefined,
            data: () => value,
          };
        },
        set(ref, payload) {
          store.set(ref.__key, payload);
        },
        update(ref, payload) {
          const current = store.get(ref.__key) || {};
          store.set(ref.__key, { ...current, ...payload });
        },
      };
      return handler(transaction);
    },
    collection(collectionName) {
      return {
        doc(id) {
          return makeRef(collectionName, id);
        },
      };
    },
  };
}

test("normalizeInstrument maps eToro payload to internal asset shape", () => {
  const mapped = __test.normalizeInstrument({
    InstrumentId: "1001",
    InternalSymbolFull: "BTC",
    displayname: "Bitcoin",
  });

  assert.deepEqual(mapped, {
    instrumentId: 1001,
    symbol: "BTC",
    displayName: "Bitcoin",
  });
});

test("extractInstrumentId supports InstrumentId casing variants", () => {
  assert.equal(__test.extractInstrumentId({ InstrumentId: "1007" }), 1007);
  assert.equal(__test.extractInstrumentId({ InstrumentID: "1008" }), 1008);
  assert.equal(__test.extractInstrumentId({ instrumentId: "1009" }), 1009);
});

test("normalizeInstrument unwraps nested instrument envelope", () => {
  const mapped = __test.normalizeInstrument({
    item: {
      instrument: {
        InstrumentId: "1005",
        InternalSymbolFull: "XRP",
        displayname: "Ripple",
      },
    },
  });

  assert.deepEqual(mapped, {
    instrumentId: 1005,
    symbol: "XRP",
    displayName: "Ripple",
  });
});

test("normalizeInstrumentRate includes normalized instrument and price", () => {
  const mapped = __test.normalizeInstrumentRate({
    instrumentId: 2002,
    internalSymbolFull: "ETH",
    displayName: "Ethereum",
    buyRate: "3000.5",
    sellRate: "2999.5",
  });

  assert.deepEqual(mapped, {
    instrumentId: 2002,
    symbol: "ETH",
    displayName: "Ethereum",
    rate: 3000,
  });
});

test("extractItems supports nested eToro response containers", () => {
  const items = __test.extractItems({
    data: {
      pageItems: [
        {
          instrumentId: 3003,
          internalSymbolFull: "AAPL",
          displayname: "Apple Inc",
        },
      ],
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].instrumentId, 3003);
});

test("extractItems handles single instrument payload with InstrumentId casing", () => {
  const items = __test.extractItems({
    InstrumentId: "3004",
    InternalSymbolFull: "XRP",
    displayname: "Ripple",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].InstrumentId, "3004");
});

test("isSearchMatch supports compact matches for ticker-like input", () => {
  const match = __test.isSearchMatch(
    { symbol: "BTC-USD", displayName: "Bitcoin / US Dollar" },
    "btcusd",
  );

  assert.equal(match, true);
});

test("parseBearerToken extracts token from Bearer authorization header", () => {
  assert.equal(__test.parseBearerToken("Bearer abc123"), "abc123");
  assert.equal(__test.parseBearerToken("Basic abc123"), null);
  assert.equal(__test.parseBearerToken(""), null);
});

test("requireCallableAuthAndAppCheck rejects missing auth", async () => {
  await assert.rejects(
    __test.requireCallableAuthAndAppCheck(
      { auth: null, app: { appId: "app-1" } },
      "searchEtoroInstruments",
    ),
    (error) => error?.code === "unauthenticated",
  );
});

test("requireCallableAuthAndAppCheck rejects missing app check", async () => {
  await assert.rejects(
    __test.requireCallableAuthAndAppCheck(
      { auth: { uid: "user-1" }, app: null },
      "searchEtoroInstruments",
    ),
    (error) => error?.code === "unauthenticated",
  );
});

test("getClientIp prefers x-forwarded-for first IP", () => {
  const ip = __test.getClientIp({
    headers: { "x-forwarded-for": "10.1.1.1, 10.1.1.2" },
    ip: "127.0.0.1",
  });

  assert.equal(ip, "10.1.1.1");
});

test("sanitizeRateLimitKeyPart keeps only safe key characters", () => {
  assert.equal(
    __test.sanitizeRateLimitKeyPart("10.0.0.1 / bad key"),
    "10.0.0.1___bad_key",
  );
});

test("buildSearchCandidates prefers ticker lookup for ticker-like search", () => {
  const candidates = __test.buildSearchCandidates("btc");

  assert.deepEqual(candidates, [
    {
      kind: "internalSymbolFull",
      queryValue: "BTC",
      withPagination: false,
      fields: "instrumentId,internalSymbolFull,displayname",
    },
    {
      kind: "searchText",
      queryValue: "btc",
      withPagination: true,
      fields: "instrumentId,internalSymbolFull,displayname",
    },
  ]);
});

test("buildSearchCandidates uses text search for non-ticker input", () => {
  const candidates = __test.buildSearchCandidates("bitcoin us dollar");

  assert.deepEqual(candidates, [
    {
      kind: "searchText",
      queryValue: "bitcoin us dollar",
      withPagination: true,
      fields: "instrumentId,internalSymbolFull,displayname",
    },
  ]);
});

test("getHttpStatusFromHttpsCode maps known firebase codes", () => {
  assert.equal(__test.getHttpStatusFromHttpsCode("invalid-argument"), 400);
  assert.equal(__test.getHttpStatusFromHttpsCode("unauthenticated"), 401);
  assert.equal(__test.getHttpStatusFromHttpsCode("resource-exhausted"), 429);
  assert.equal(__test.getHttpStatusFromHttpsCode("unknown-code"), 500);
});

test("toClientError returns safe payload for HttpsError", () => {
  const clientError = __test.toClientError(
    new HttpsError("permission-denied", "Request could not be authorized.", {
      errorCode: "ETORO_FORBIDDEN",
    }),
    "corr-123",
  );

  assert.deepEqual(clientError, {
    httpStatus: 403,
    code: "permission-denied",
    errorCode: "ETORO_FORBIDDEN",
    message: "Request could not be authorized.",
    correlationId: "corr-123",
  });
});

test("toClientError masks unknown errors with internal response", () => {
  const clientError = __test.toClientError(
    new Error("provider raw payload leaked details"),
    "corr-456",
  );

  assert.deepEqual(clientError, {
    httpStatus: 500,
    code: "internal",
    errorCode: "INTERNAL_ERROR",
    message: "Internal error.",
    correlationId: "corr-456",
  });
});

test("isAlertDue returns true when alert never checked", () => {
  assert.equal(__test.isAlertDue(null, 15, Date.UTC(2026, 0, 1, 12, 0, 0)), true);
});

test("isAlertDue respects configured interval", () => {
  const checkedAt = new Date(Date.UTC(2026, 0, 1, 11, 50, 0));
  const dueAtNoon = __test.isAlertDue(checkedAt, 10, Date.UTC(2026, 0, 1, 12, 0, 0));
  const notDueAt1155 = __test.isAlertDue(checkedAt, 10, Date.UTC(2026, 0, 1, 11, 55, 0));

  assert.equal(dueAtNoon, true);
  assert.equal(notDueAt1155, false);
});

test("shouldCreateNotification suppresses duplicates while condition remains true", () => {
  const baseline = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
  assert.equal(__test.shouldCreateNotification(true, baseline, baseline), false);
  assert.equal(
    __test.shouldCreateNotification(
      true,
      new Date(Date.UTC(2026, 0, 1, 11, 50, 0)),
      new Date(Date.UTC(2026, 0, 1, 12, 0, 0)),
    ),
    true,
  );
});

test("evaluateFirestoreCondition supports above and below conditions", () => {
  assert.equal(__test.evaluateFirestoreCondition("above", 150, 100), true);
  assert.equal(__test.evaluateFirestoreCondition("below", 80, 100), true);
  assert.equal(__test.evaluateFirestoreCondition("above", 90, 100), false);
});

test("toNotificationFailureMessage returns fallback for non-errors", () => {
  assert.equal(
    __test.toNotificationFailureMessage(null),
    "Notification delivery failed.",
  );
});

test("toNotificationFailureMessage truncates long messages", () => {
  const longMessage = "x".repeat(600);
  const message = __test.toNotificationFailureMessage(new Error(longMessage));
  assert.equal(message.length, 500);
});

test("runAlertEvaluation creates and marks notifications as sent for due matching alerts", async () => {
  const createdNotifications = [];
  const notificationUpdates = [];
  const alertUpdates = [];
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  const previousCheck = new Date(Date.UTC(2026, 2, 10, 11, 50, 0));
  const mockTimestamp = { _type: "serverTimestamp" };

  const alertDocs = [
    {
      id: "alert-1",
      data() {
        return {
          userId: "user-1",
          instrumentId: 101,
          symbol: "BTC",
          displayName: "BTC breakout",
          condition: "above",
          targetPrice: 100,
          intervalMinutes: 5,
          lastCheckedAt: previousCheck,
          lastTriggeredAt: null,
        };
      },
      ref: {
        async update(payload) {
          alertUpdates.push(payload);
        },
      },
    },
  ];

  const result = await __test.runAlertEvaluation({
    alertDocs,
    nowMs: now,
    fetchRate: async () => ({ rate: 120 }),
    createTimestamp: () => mockTimestamp,
    createNotificationRecord: async ({ dedupeKey, notificationData }) => {
      createdNotifications.push({ dedupeKey, notificationData });
      return {
        created: true,
        ref: {
        async update(updatePayload) {
          notificationUpdates.push(updatePayload);
        },
        },
      };
    },
    log: { info() {}, warn() {}, error() {} },
  });

  assert.deepEqual(result, {
    dueAlerts: 1,
    processedAlerts: 1,
    skippedAlerts: 0,
    failedAlerts: 0,
    notificationsCreated: 1,
    notificationsSent: 1,
    notificationsFailed: 0,
  });
  assert.equal(createdNotifications.length, 1);
  assert.equal(createdNotifications[0].dedupeKey, "alert-1:1773143400000");
  assert.equal(createdNotifications[0].notificationData.status, "pending");
  assert.equal(createdNotifications[0].notificationData.triggerPrice, 120);
  assert.deepEqual(notificationUpdates, [{ status: "sent", errorMessage: null }]);
  assert.equal(alertUpdates.length, 1);
  assert.equal(alertUpdates[0].lastCheckedAt, mockTimestamp);
  assert.equal(alertUpdates[0].lastTriggeredAt, mockTimestamp);
});

test("runAlertEvaluation skips duplicate notification when condition remains matched", async () => {
  const createdNotifications = [];
  const alertUpdates = [];
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  const previousCheck = new Date(Date.UTC(2026, 2, 10, 11, 50, 0));
  const lastTriggeredAt = new Date(Date.UTC(2026, 2, 10, 11, 55, 0));
  const mockTimestamp = { _type: "serverTimestamp" };

  const alertDocs = [
    {
      id: "alert-2",
      data() {
        return {
          userId: "user-1",
          instrumentId: 101,
          symbol: "BTC",
          displayName: "BTC breakout",
          condition: "above",
          targetPrice: 100,
          intervalMinutes: 5,
          lastCheckedAt: previousCheck,
          lastTriggeredAt,
        };
      },
      ref: {
        async update(payload) {
          alertUpdates.push(payload);
        },
      },
    },
  ];

  const result = await __test.runAlertEvaluation({
    alertDocs,
    nowMs: now,
    fetchRate: async () => ({ rate: 120 }),
    createTimestamp: () => mockTimestamp,
    createNotificationRecord: async ({ dedupeKey, notificationData }) => {
      createdNotifications.push({ dedupeKey, notificationData });
      return {
        created: true,
        ref: { async update() {} },
      };
    },
    log: { info() {}, warn() {}, error() {} },
  });

  assert.deepEqual(result, {
    dueAlerts: 1,
    processedAlerts: 1,
    skippedAlerts: 0,
    failedAlerts: 0,
    notificationsCreated: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
  });
  assert.equal(createdNotifications.length, 0);
  assert.equal(alertUpdates.length, 1);
  assert.equal(alertUpdates[0].lastTriggeredAt, undefined);
  assert.equal(alertUpdates[0].lastCheckedAt, mockTimestamp);
});

test("runAlertEvaluation keeps processing other alerts when one rate lookup fails", async () => {
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  const mockTimestamp = { _type: "serverTimestamp" };
  const alertUpdates = [];

  const alertDocs = [
    {
      id: "alert-failing",
      data() {
        return {
          userId: "user-1",
          instrumentId: 404,
          symbol: "BAD",
          displayName: "Broken instrument",
          condition: "above",
          targetPrice: 100,
          intervalMinutes: 5,
        };
      },
      ref: {
        async update(payload) {
          alertUpdates.push({ id: "alert-failing", payload });
        },
      },
    },
    {
      id: "alert-healthy",
      data() {
        return {
          userId: "user-1",
          instrumentId: 101,
          symbol: "BTC",
          displayName: "Healthy instrument",
          condition: "above",
          targetPrice: 100,
          intervalMinutes: 5,
        };
      },
      ref: {
        async update(payload) {
          alertUpdates.push({ id: "alert-healthy", payload });
        },
      },
    },
  ];

  const result = await __test.runAlertEvaluation({
    alertDocs,
    nowMs: now,
    concurrency: 2,
    fetchRate: async (instrumentId) => {
      if (instrumentId === 404) {
        throw new Error("rate unavailable");
      }
      return { rate: 120 };
    },
    createTimestamp: () => mockTimestamp,
    createNotificationRecord: async () => ({
      created: true,
      ref: { async update() {} },
    }),
    log: { info() {}, warn() {}, error() {} },
  });

  assert.deepEqual(result, {
    dueAlerts: 2,
    processedAlerts: 1,
    skippedAlerts: 0,
    failedAlerts: 1,
    notificationsCreated: 1,
    notificationsSent: 1,
    notificationsFailed: 0,
  });
  assert.equal(alertUpdates.length, 2);
});

test("computeNextCheckAtDate uses interval and defaults to one minute", () => {
  const baseMs = Date.UTC(2026, 2, 10, 12, 0, 0);
  const fromInterval = __test.computeNextCheckAtDate(10, baseMs);
  const fromInvalid = __test.computeNextCheckAtDate(0, baseMs);

  assert.equal(fromInterval.toISOString(), "2026-03-10T12:10:00.000Z");
  assert.equal(fromInvalid.toISOString(), "2026-03-10T12:01:00.000Z");
});

test("getCheckAlertsConfig reads bounded values from env", () => {
  const config = __test.getCheckAlertsConfig({
    CHECK_ALERTS_BATCH_SIZE: "250",
    CHECK_ALERTS_CONCURRENCY: "8",
    CHECK_ALERTS_MAX_BATCHES: "4",
    CHECK_ALERTS_LEASE_DURATION_MS: "120000",
  });

  assert.deepEqual(config, {
    batchSize: 250,
    concurrency: 8,
    maxBatches: 4,
    leaseDurationMs: 120000,
  });
});

test("buildNotificationDedupeKey uses lastCheckedAt when available", () => {
  const dedupeKey = __test.buildNotificationDedupeKey({
    alertId: "alert-1",
    lastCheckedAtValue: new Date("2026-03-10T11:50:00.000Z"),
    intervalMinutes: 5,
    nowMs: Date.UTC(2026, 2, 10, 12, 0, 0),
  });

  assert.equal(dedupeKey, "alert-1:1773143400000");
});

test("buildNotificationDedupeKey uses rounded interval window for initial checks", () => {
  const nowMs = Date.UTC(2026, 2, 10, 12, 4, 59);
  const dedupeKey = __test.buildNotificationDedupeKey({
    alertId: "alert-1",
    lastCheckedAtValue: null,
    intervalMinutes: 5,
    nowMs,
  });

  assert.equal(dedupeKey, "alert-1:initial:1773144000000");
});

test("runAlertEvaluation keeps notifications idempotent across overlapping runs", async () => {
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  const dedupeMap = new Set();
  const createNotificationRecord = async ({ dedupeKey }) => {
    const created = !dedupeMap.has(dedupeKey);
    dedupeMap.add(dedupeKey);
    return {
      created,
      ref: { async update() {} },
    };
  };

  const makeAlertDoc = () => ({
    id: "alert-1",
    data() {
      return {
        userId: "user-1",
        instrumentId: 101,
        symbol: "BTC",
        displayName: "BTC breakout",
        condition: "above",
        targetPrice: 100,
        intervalMinutes: 5,
        lastCheckedAt: new Date(Date.UTC(2026, 2, 10, 11, 50, 0)),
        lastTriggeredAt: null,
      };
    },
    ref: { async update() {} },
  });

  const [firstRun, secondRun] = await Promise.all([
    __test.runAlertEvaluation({
      alertDocs: [makeAlertDoc()],
      nowMs: now,
      fetchRate: async () => ({ rate: 120 }),
      createTimestamp: () => ({ _type: "serverTimestamp" }),
      createNotificationRecord,
      log: { info() {}, warn() {}, error() {} },
    }),
    __test.runAlertEvaluation({
      alertDocs: [makeAlertDoc()],
      nowMs: now,
      fetchRate: async () => ({ rate: 120 }),
      createTimestamp: () => ({ _type: "serverTimestamp" }),
      createNotificationRecord,
      log: { info() {}, warn() {}, error() {} },
    }),
  ]);

  assert.equal(firstRun.notificationsCreated + secondRun.notificationsCreated, 1);
});

test("scheduler lease blocks overlap until released", async () => {
  const firestore = createInMemoryFirestore();
  const nowMs = Date.UTC(2026, 2, 10, 12, 0, 0);

  const first = await __test.acquireSchedulerLease({
    firestore,
    lockId: "checkAlerts",
    nowMs,
    leaseDurationMs: 60_000,
    ownerId: "worker-a",
  });
  const second = await __test.acquireSchedulerLease({
    firestore,
    lockId: "checkAlerts",
    nowMs: nowMs + 1_000,
    leaseDurationMs: 60_000,
    ownerId: "worker-b",
  });

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);

  const released = await __test.releaseSchedulerLease({
    firestore,
    lockId: "checkAlerts",
    ownerId: "worker-a",
    releasedAtMs: nowMs + 2_000,
  });
  const third = await __test.acquireSchedulerLease({
    firestore,
    lockId: "checkAlerts",
    nowMs: nowMs + 3_000,
    leaseDurationMs: 60_000,
    ownerId: "worker-c",
  });

  assert.equal(released, true);
  assert.equal(third.acquired, true);
});

test("deleteExpiredCollectionDocs removes expired docs in bounded batches", async () => {
  const deletions = [];
  const snapshots = [
    {
      empty: false,
      docs: [
        { ref: { async delete() { deletions.push("d1"); } } },
        { ref: { async delete() { deletions.push("d2"); } } },
      ],
    },
    {
      empty: false,
      docs: [
        { ref: { async delete() { deletions.push("d3"); } } },
      ],
    },
  ];
  let callCount = 0;
  const firestore = {
    collection() {
      return {
        where() {
          return {
            limit() {
              return {
                async get() {
                  const result = snapshots[callCount];
                  callCount += 1;
                  return result || { empty: true, docs: [] };
                },
              };
            },
          };
        },
      };
    },
  };

  const deletedCount = await __test.deleteExpiredCollectionDocs({
    firestore,
    collectionName: "_rateLimits",
    timestampField: "expiresAt",
    cutoffDate: new Date(Date.UTC(2026, 2, 10, 12, 0, 0)),
    batchSize: 2,
    maxBatches: 10,
  });

  assert.equal(deletedCount, 3);
  assert.deepEqual(deletions, ["d1", "d2", "d3"]);
});

test("cleanupOperationalCollections prunes rate limits and stale scheduler leases", async () => {
  const calls = [];
  const summary = await __test.cleanupOperationalCollections({
    nowMs: Date.UTC(2026, 2, 10, 12, 0, 0),
    schedulerLeaseRetentionMs: 60 * 60 * 1000,
    cleanupDocs: async (params) => {
      calls.push(params);
      return params.collectionName === "_rateLimits" ? 4 : 2;
    },
    log: { info() {}, warn() {}, error() {} },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].collectionName, "_rateLimits");
  assert.equal(calls[0].timestampField, "expiresAt");
  assert.equal(calls[0].cutoffDate.toISOString(), "2026-03-10T12:00:00.000Z");
  assert.equal(calls[1].collectionName, "schedulerLeases");
  assert.equal(calls[1].timestampField, "leaseExpiresAt");
  assert.equal(calls[1].cutoffDate.toISOString(), "2026-03-10T11:00:00.000Z");

  assert.deepEqual(summary, {
    rateLimitsDeleted: 4,
    schedulerLeasesDeleted: 2,
    totalDeleted: 6,
    checkedAt: "2026-03-10T12:00:00.000Z",
  });
});

test("toRateLimitDocId creates deterministic distributed key", () => {
  const key = __test.toRateLimitDocId({
    scope: "uid",
    endpoint: "searchEtoroInstruments",
    identity: "user-1",
    windowStartMs: 1773144000000,
  });

  assert.equal(
    key,
    "uid|searchetoroinstruments|user-1|1773144000000",
  );
});

test("normalizePageSize enforces defaults and max bounds", () => {
  assert.equal(__test.normalizePageSize(undefined), 20);
  assert.equal(__test.normalizePageSize("5"), 5);
  assert.equal(__test.normalizePageSize("500"), 100);
  assert.equal(__test.normalizePageSize(0), 20);
});

test("encodePageToken and decodePageToken roundtrip values", () => {
  const token = __test.encodePageToken({ createdAtMs: 1773144000000, id: "notif-1" });
  const decoded = __test.decodePageToken(token);
  assert.deepEqual(decoded, { createdAtMs: 1773144000000, id: "notif-1" });
});

test("decodePageToken returns null for malformed values", () => {
  assert.equal(__test.decodePageToken("invalid"), null);
  assert.equal(__test.decodePageToken(__test.encodePageToken({ bad: true })), null);
});

test("firestore.rules validates nextCheckAt in alerts payload", () => {
  const rulesSource = fs.readFileSync(firestoreRulesPath, "utf8");

  assert.match(rulesSource, /'nextCheckAt'/);
  assert.match(rulesSource, /data\.nextCheckAt is timestamp/);
});

test("firestore indexes include due-alert and alert pagination composites", () => {
  const indexes = JSON.parse(fs.readFileSync(firestoreIndexesPath, "utf8"));
  const alertIndexes = indexes.indexes.filter((entry) => entry.collectionGroup === "alerts");
  const signatures = alertIndexes.map((entry) =>
    entry.fields.map((field) => `${field.fieldPath}:${field.mode}`).join("|"),
  );

  assert.ok(signatures.includes("isActive:ASCENDING|nextCheckAt:ASCENDING|__name__:ASCENDING"));
  assert.ok(signatures.includes("userId:ASCENDING|createdAt:DESCENDING|__name__:DESCENDING"));
});

test("enforceDistributedRateLimit writes counter when under limit", async () => {
  const writes = [];
  const firestore = {
    collection() {
      return {
        doc(id) {
          return { id };
        },
      };
    },
    async runTransaction(handler) {
      const transaction = {
        async get() {
          return {
            exists: true,
            data() {
              return { count: 2 };
            },
          };
        },
        set(ref, payload, options) {
          writes.push({ ref, payload, options });
        },
      };
      await handler(transaction);
    },
  };

  await __test.enforceDistributedRateLimit({
    scope: "uid",
    endpoint: "searchEtoroInstruments",
    identity: "user-1",
    maxRequests: 3,
    nowMs: Date.UTC(2026, 2, 10, 12, 0, 1),
    firestore,
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.count, 3);
});

test("enforceDistributedRateLimit throws when request limit reached", async () => {
  const firestore = {
    collection() {
      return {
        doc(id) {
          return { id };
        },
      };
    },
    async runTransaction(handler) {
      const transaction = {
        async get() {
          return {
            exists: true,
            data() {
              return { count: 30 };
            },
          };
        },
        set() {},
      };
      await handler(transaction);
    },
  };

  await assert.rejects(
    __test.enforceDistributedRateLimit({
      scope: "uid",
      endpoint: "searchEtoroInstruments",
      identity: "user-1",
      maxRequests: 30,
      nowMs: Date.UTC(2026, 2, 10, 12, 0, 1),
      firestore,
    }),
    (error) => error?.code === "resource-exhausted",
  );
});
