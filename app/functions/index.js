const { randomUUID } = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const ETORO_APP_KEY = defineSecret("ETORO_APP_KEY");
const ETORO_USER_KEY = defineSecret("ETORO_USER_KEY");
const ETORO_BASE_URL = "https://public-api.etoro.com/api/v1";

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
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
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
    asNumber(item.instrumentId) ?? asNumber(item.InstrumentID) ?? asNumber(item.instrumentID);
  const symbol =
    asString(item.internalSymbolFull) || asString(item.symbol) || asString(item.ticker) || "";
  const displayName =
    asString(item.displayname) || asString(item.displayName) || asString(item.name) || symbol;

  if (instrumentId === null || symbol.length === 0) {
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

async function callEtoro(path, appKey, userKey) {
  let response;
  try {
    response = await fetch(`${ETORO_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "x-request-id": randomUUID(),
        "x-api-key": appKey,
        "x-user-key": userKey,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new HttpsError("unavailable", `Unable to reach eToro API. ${message}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const serverMessage =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : `HTTP ${response.status}`;

    if (response.status === 400) {
      throw new HttpsError("invalid-argument", `eToro API request failed: ${serverMessage}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new HttpsError("permission-denied", `eToro API request failed: ${serverMessage}`);
    }

    if (response.status === 404) {
      throw new HttpsError("not-found", `eToro API request failed: ${serverMessage}`);
    }

    if (response.status === 429 || response.status >= 500) {
      throw new HttpsError("unavailable", `eToro API request failed: ${serverMessage}`);
    }

    throw new HttpsError("internal", `eToro API request failed: ${serverMessage}`);
  }

  return payload;
}

function buildSearchCandidates(searchText) {
  const clean = asString(searchText);
  const upper = clean.toUpperCase();
  const isTickerLike = /^[A-Za-z0-9._-]{1,16}$/.test(clean);
  const candidates = [];

  if (isTickerLike) {
    candidates.push({ internalSymbolFull: upper });
  }

  candidates.push({ searchText: clean });

  if (isTickerLike && upper !== clean) {
    candidates.push({ searchText: upper });
  }

  return candidates;
}

function requireSecretValue(secret, label) {
  const value = secret.value();
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpsError("failed-precondition", `Missing required secret: ${label}`);
  }

  return value;
}

exports.searchEtoroInstruments = onCall(
  {
    secrets: [ETORO_APP_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request) => {
    const searchText = asString(request.data?.searchText);
    if (!searchText) {
      throw new HttpsError("invalid-argument", "searchText is required.");
    }

    const fields = ["instrumentId", "internalSymbolFull", "displayname"].join(",");
    const candidates = buildSearchCandidates(searchText);
    const appKey = requireSecretValue(ETORO_APP_KEY, "ETORO_APP_KEY");
    const userKey = requireSecretValue(ETORO_USER_KEY, "ETORO_USER_KEY");

    let items = [];
    let lastError = null;

    for (const candidate of candidates) {
      const query = new URLSearchParams({
        ...candidate,
        fields,
        pageSize: "20",
        pageNumber: "1",
      });

      try {
        const payload = await callEtoro(`/market-data/search?${query.toString()}`, appKey, userKey);
        items = extractItems(payload)
          .map(normalizeInstrument)
          .filter((item) => item !== null);

        if (items.length > 0) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (items.length === 0 && lastError instanceof HttpsError) {
      throw lastError;
    }

    return { items };
  }
);

exports.getEtoroInstrumentRate = onCall(
  {
    secrets: [ETORO_APP_KEY, ETORO_USER_KEY],
    cors: true,
  },
  async (request) => {
    const instrumentId = asNumber(request.data?.instrumentId);
    if (instrumentId === null) {
      throw new HttpsError("invalid-argument", "instrumentId is required.");
    }

    const query = new URLSearchParams({
      instrumentIds: String(instrumentId),
    });
    const appKey = requireSecretValue(ETORO_APP_KEY, "ETORO_APP_KEY");
    const userKey = requireSecretValue(ETORO_USER_KEY, "ETORO_USER_KEY");

    const payload = await callEtoro(`/market-data/instruments/rates?${query.toString()}`, appKey, userKey);

    const items = extractItems(payload);
    const exactItem = items.find((item) => {
      const itemId =
        asNumber(item?.instrumentId) ?? asNumber(item?.InstrumentID) ?? asNumber(item?.instrumentID);
      return itemId === instrumentId;
    });

    const selected = exactItem ?? (items.length > 0 ? items[0] : payload);
    const rate = extractPrice(selected);

    if (rate === null) {
      throw new HttpsError("not-found", "Rate not available for this instrument.");
    }

    return { rate };
  }
);
