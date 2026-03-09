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
