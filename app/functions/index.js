const { randomUUID } = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ETORO_API_KEY = defineSecret("ETORO_API_KEY");
const ETORO_USER_KEY = defineSecret("ETORO_USER_KEY");
const ETORO_BASE_URL = "https://public-api.etoro.com/api/v1";
const ETORO_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const ETORO_MAX_RETRIES = 2;
const ETORO_SEARCH_PAGE_SIZE = 50;
const ETORO_SEARCH_MAX_PAGES = 2;

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

  for (let attempt = 0; attempt <= ETORO_MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(`${ETORO_BASE_URL}${path}`, {
        method: "GET",
        headers: {
          "x-request-id": randomUUID(),
          "x-api-key": apiKey,
          "x-user-key": userKey,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      logger.warn("eToro network error", {
        path,
        attempt,
        errorMessage: message,
      });
      if (attempt < ETORO_MAX_RETRIES) {
        await delay(200 * (attempt + 1));
        continue;
      }

      throw new HttpsError(
        "unavailable",
        `Unable to reach eToro API. ${message}`,
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

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
        await delay(200 * (attempt + 1));
        continue;
      }

      if (response.status === 400) {
        throw new HttpsError(
          "invalid-argument",
          `eToro API request failed: ${serverMessage}`,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new HttpsError(
          "permission-denied",
          `eToro API request failed: ${serverMessage}`,
        );
      }

      if (response.status === 404) {
        throw new HttpsError(
          "not-found",
          `eToro API request failed: ${serverMessage}`,
        );
      }

      if (response.status === 429 || response.status >= 500) {
        throw new HttpsError(
          "unavailable",
          `eToro API request failed: ${serverMessage}`,
        );
      }

      throw new HttpsError(
        "internal",
        `eToro API request failed: ${serverMessage}`,
      );
    }

    return payload;
  }

  throw new HttpsError(
    "unavailable",
    "Unable to reach eToro API after retries.",
  );
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

async function searchEtoroAssets(searchText) {
  const trimmedSearchText = asString(searchText);
  if (!trimmedSearchText) {
    throw new HttpsError("invalid-argument", "searchText is required.");
  }

  const { apiKey, userKey } = getEtoroSecretKeys();
  const upper = trimmedSearchText.toUpperCase();
  const isTickerLike = /^[A-Za-z0-9._-]{1,16}$/.test(trimmedSearchText);

  const query = new URLSearchParams();
  const searchFields = "instrumentId,internalSymbolFull,displayname";
  if (isTickerLike) {
    query.set("internalSymbolFull", upper);
    query.set("pageSize", "20");
    query.set("pageNumber", "1");
  } else {
    query.set("searchText", trimmedSearchText);
    query.set("pageSize", "20");
    query.set("pageNumber", "1");
  }
  query.set("fields", searchFields);
  const encodedFields = encodeURIComponent(searchFields);
  const queryString = query
    .toString()
    .replace(`fields=${encodedFields}`, `fields=${searchFields}`);

  logger.info("eToro search request", {
    searchText: trimmedSearchText,
    mode: isTickerLike ? "internalSymbolFull" : "searchText",
    query: queryString,
  });

  const payload = await callEtoro(
    `/market-data/search?${queryString}`,
    apiKey,
    userKey,
  );

  const rawItems = extractItems(payload);
  const normalizedItems = rawItems
    .map(normalizeInstrument)
    .filter((item) => item !== null);

  const rankedItems = rankSearchResults(normalizedItems, trimmedSearchText);
  const items = rankedItems.filter((item) =>
    isSearchMatch(item, trimmedSearchText),
  );

  logger.info("eToro search response", {
    mode: isTickerLike ? "internalSymbolFull" : "searchText",
    totalRawItems: rawItems.length,
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
  },
  async (request) => {
    return searchEtoroAssets(request.data?.searchText);
  },
);

exports.getEtoroInstrumentRate = onCall(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request) => {
    return fetchEtoroInstrumentRate(request.data?.instrumentId);
  },
);

exports.marketDataSearchHttp = onRequest(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request, response) => {
    if (request.method !== "GET") {
      response.status(405).json({ error: "Method not allowed. Use GET." });
      return;
    }

    try {
      const result = await searchEtoroAssets(request.query.searchText);
      response.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpsError) {
        response.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      logger.error("marketDataSearchHttp failed", { error });
      response.status(500).json({ error: "Internal error." });
    }
  },
);

exports.marketDataInstrumentRatesHttp = onRequest(
  {
    secrets: [ETORO_API_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request, response) => {
    if (request.method !== "GET") {
      response.status(405).json({ error: "Method not allowed. Use GET." });
      return;
    }

    try {
      const result = await fetchEtoroInstrumentRate(request.query.instrumentId);
      response.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpsError) {
        response.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      logger.error("marketDataInstrumentRatesHttp failed", { error });
      response.status(500).json({ error: "Internal error." });
    }
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
};
