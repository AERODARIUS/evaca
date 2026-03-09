const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");

const { __test } = require("./index");

test("normalizeInstrument maps eToro payload to internal asset shape", () => {
  const mapped = __test.normalizeInstrument({
    InstrumentID: "1001",
    InternalSymbolFull: "BTC",
    displayname: "Bitcoin",
  });

  assert.deepEqual(mapped, {
    instrumentId: 1001,
    symbol: "BTC",
    displayName: "Bitcoin",
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

test("requireCallableAuthAndAppCheck rejects missing auth", () => {
  assert.throws(
    () =>
      __test.requireCallableAuthAndAppCheck(
        { auth: null, app: { appId: "app-1" } },
        "searchEtoroInstruments",
      ),
    (error) => error?.code === "unauthenticated",
  );
});

test("requireCallableAuthAndAppCheck rejects missing app check", () => {
  assert.throws(
    () =>
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

test("enforceRateLimit blocks when window max is exceeded", () => {
  __test.__rateLimitBuckets.clear();

  for (let i = 0; i < 30; i += 1) {
    __test.enforceRateLimit("test-scope", "uid:user-1");
  }

  assert.throws(
    () => __test.enforceRateLimit("test-scope", "uid:user-1"),
    (error) => error?.code === "resource-exhausted",
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
  ]);
});

test("buildSearchCandidates uses text search for non-ticker input", () => {
  const candidates = __test.buildSearchCandidates("bitcoin us dollar");

  assert.deepEqual(candidates, [
    {
      kind: "searchText",
      queryValue: "bitcoin us dollar",
      withPagination: true,
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
