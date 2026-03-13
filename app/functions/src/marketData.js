const { randomUUID } = require("crypto");
const logger = require("firebase-functions/logger");
const { HttpsError } = require("firebase-functions/v2/https");
const { asNumber, asString } = require("./primitives");
const { SAFE_ERROR_MESSAGES } = require("./errors");

const ETORO_BASE_URL = "https://public-api.etoro.com/api/v1";
const ETORO_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const ETORO_MAX_RETRIES = 2;
const ETORO_REQUEST_TIMEOUT_MS = 8000;
const ETORO_RETRY_BASE_DELAY_MS = 250;
const ETORO_RETRY_JITTER_MS = 120;
const ETORO_SEARCH_PAGE_SIZE = 50;
const ETORO_SEARCH_MAX_PAGES = 2;
const ETORO_INSTRUMENTS_BATCH_SIZE = 50;

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (
      asNumber(payload.instrumentId) !== null ||
      asNumber(payload.InstrumentId) !== null ||
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

  const nestedCandidates = [
    item.instrument,
    item.Instrument,
    item.item,
    item.Item,
    item.asset,
    item.Asset,
    item.value,
    item.Value,
    item.data,
    item.Data,
    item.result,
    item.Result,
  ];
  for (const nested of nestedCandidates) {
    if (nested && typeof nested === "object") {
      const normalizedNested = normalizeInstrument(nested);
      if (normalizedNested) {
        return normalizedNested;
      }
    }
  }

  const instrumentId =
    asNumber(item.instrumentId) ??
    asNumber(item.InstrumentId) ??
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

function extractInstrumentId(item) {
  return (
    asNumber(item?.instrumentId) ??
    asNumber(item?.InstrumentId) ??
    asNumber(item?.InstrumentID) ??
    asNumber(item?.instrumentID) ??
    asNumber(item?.id) ??
    asNumber(item?.ID)
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

function toEtoroQueryString(query, csvKeys = []) {
  let queryString = query.toString();
  for (const key of csvKeys) {
    const value = query.get(key);
    if (typeof value !== "string" || !value.includes(",")) {
      continue;
    }
    const encodedPair = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    const rawPair = `${encodeURIComponent(key)}=${value}`;
    queryString = queryString.replace(encodedPair, rawPair);
  }
  return queryString;
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
      {
        kind: "searchText",
        queryValue: clean,
        withPagination: true,
        fields,
      },
    ];
  }

  return [
    {
      kind: "searchText",
      queryValue: clean,
      withPagination: true,
      fields,
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
    compactSymbol.includes(compactQuery) ||
    compactDisplayName.includes(compactQuery)
  );
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

function createMarketDataService({ etoroApiKeySecret, etoroUserKeySecret }) {
  function getEtoroSecretKeys() {
    return {
      apiKey: requireSecretValue(etoroApiKeySecret, "ETORO_API_KEY"),
      userKey: requireSecretValue(etoroUserKeySecret, "ETORO_USER_KEY"),
    };
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

  async function fetchEtoroInstrumentsByIds(instrumentIds, apiKey, userKey) {
    const ids = Array.from(
      new Set(
        instrumentIds
          .map((id) => asNumber(id))
          .filter((id) => id !== null && id > 0),
      ),
    );
    const rawItems = [];

    for (let index = 0; index < ids.length; index += ETORO_INSTRUMENTS_BATCH_SIZE) {
      const batchIds = ids.slice(index, index + ETORO_INSTRUMENTS_BATCH_SIZE);
      if (batchIds.length === 0) {
        continue;
      }
      const query = new URLSearchParams({
        instrumentIds: batchIds.join(","),
      });
      const queryString = toEtoroQueryString(query, ["instrumentIds"]);
      const payload = await callEtoro(
        `/market-data/instruments?${queryString}`,
        apiKey,
        userKey,
      );
      rawItems.push(...extractItems(payload));
    }

    return rawItems;
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
        const queryString = toEtoroQueryString(query, ["fields"]);

        logger.info("eToro search request", {
          searchText: trimmedSearchText,
          mode: candidate.kind,
          pageNumber,
        });

        logger.info("QUERY STRING", {
          query: queryString,
        });

        const payload = await callEtoro(
          `/market-data/search?${queryString}`,
          apiKey,
          userKey,
        );
        const pageItems = extractItems(payload);
        logger.info("eToro search page processed", {
          mode: candidate.kind,
          pageNumber,
          payloadSummary: summarizePayload(payload),
          pageItemsCount: pageItems.length,
          firstPageItemKeys:
            pageItems.length > 0 && pageItems[0] && typeof pageItems[0] === "object"
              ? Object.keys(pageItems[0]).slice(0, 20)
              : [],
        });
        rawItems.push(...pageItems);

        if (pageItems.length < ETORO_SEARCH_PAGE_SIZE) {
          break;
        }
      }
    }

    const dedupedByInstrumentId = Array.from(
      new Map(
        rawItems.map((item) => {
          const id = extractInstrumentId(item);
          return [id ?? randomUUID(), item];
        }),
      ).values(),
    );

    let normalizedItems = dedupedByInstrumentId
      .map(normalizeInstrument)
      .filter((item) => item !== null);

    if (normalizedItems.length === 0) {
      const rawInstrumentIds = dedupedByInstrumentId
        .map((item) => extractInstrumentId(item))
        .filter((id) => id !== null && id > 0);
      if (rawInstrumentIds.length > 0) {
        try {
          const metadataItems = await fetchEtoroInstrumentsByIds(
            rawInstrumentIds,
            apiKey,
            userKey,
          );
          normalizedItems = Array.from(
            new Map(
              metadataItems
                .map(normalizeInstrument)
                .filter((item) => item !== null)
                .map((item) => [item.instrumentId, item]),
            ).values(),
          );
          logger.info("eToro search fallback metadata hydration", {
            requestedInstrumentIds: rawInstrumentIds.length,
            metadataRawItems: metadataItems.length,
            metadataNormalizedItems: normalizedItems.length,
          });
        } catch (error) {
          logger.warn("eToro search fallback metadata hydration failed", {
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const rankedItems = rankSearchResults(normalizedItems, trimmedSearchText);
    const items = rankedItems.filter((item) =>
      isSearchMatch(item, trimmedSearchText),
    );

    logger.info("eToro search response", {
      totalRawItems: rawItems.length,
      totalDedupedItems: dedupedByInstrumentId.length,
      totalNormalizedItems: normalizedItems.length,
      totalMatchedItems: items.length,
      firstRawItem:
        rawItems.length > 0 && rawItems[0] && typeof rawItems[0] === "object"
          ? {
              keys: Object.keys(rawItems[0]).slice(0, 20),
              instrumentId: extractInstrumentId(rawItems[0]),
              symbol:
                asString(rawItems[0].internalSymbolFull) ||
                asString(rawItems[0].InternalSymbolFull) ||
                asString(rawItems[0].symbol) ||
                asString(rawItems[0].Symbol) ||
                "",
            }
          : null,
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
      const itemId = extractInstrumentId(item);
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

  return {
    searchEtoroAssets,
    fetchEtoroInstrumentRate,
  };
}

module.exports = {
  ETORO_BASE_URL,
  ETORO_RETRYABLE_STATUSES,
  ETORO_MAX_RETRIES,
  ETORO_REQUEST_TIMEOUT_MS,
  ETORO_RETRY_BASE_DELAY_MS,
  ETORO_RETRY_JITTER_MS,
  ETORO_SEARCH_PAGE_SIZE,
  ETORO_SEARCH_MAX_PAGES,
  ETORO_INSTRUMENTS_BATCH_SIZE,
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
};
