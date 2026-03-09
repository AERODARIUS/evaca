const test = require("node:test");
const assert = require("node:assert/strict");

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
