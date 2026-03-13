const { asNumber, asString } = require("./primitives");

const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
const MAX_NOTIFICATION_PAGE_SIZE = 100;

function normalizePageSize(value, fallback = DEFAULT_NOTIFICATION_PAGE_SIZE, maximum = MAX_NOTIFICATION_PAGE_SIZE) {
  const numeric = asNumber(value);
  if (!numeric) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.trunc(numeric), maximum));
}

function encodePageToken(parts) {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

function decodePageToken(token) {
  const raw = asString(token);
  if (!raw) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const createdAtMs = asNumber(decoded?.createdAtMs);
    const id = asString(decoded?.id);
    if (!createdAtMs || !id) {
      return null;
    }
    return { createdAtMs, id };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  MAX_NOTIFICATION_PAGE_SIZE,
  normalizePageSize,
  encodePageToken,
  decodePageToken,
};
