const { HttpsError } = require("firebase-functions/v2/https");

const SAFE_ERROR_MESSAGES = Object.freeze({
  ETORO_BAD_REQUEST: "Request validation failed.",
  ETORO_FORBIDDEN: "Request could not be authorized.",
  ETORO_NOT_FOUND: "Requested resource was not found.",
  ETORO_UNAVAILABLE: "Provider is temporarily unavailable.",
  ETORO_INTERNAL: "Provider request failed.",
  AUTH_REQUIRED: "Authentication is required.",
  APP_CHECK_REQUIRED: "App Check is required.",
  INTERNAL: "Internal error.",
});

function getHttpStatusFromHttpsCode(code) {
  const map = {
    "invalid-argument": 400,
    unauthenticated: 401,
    "permission-denied": 403,
    "not-found": 404,
    "resource-exhausted": 429,
    unavailable: 503,
    internal: 500,
  };
  return map[code] || 500;
}

function toClientError(error, correlationId) {
  if (error instanceof HttpsError) {
    const detailCode =
      error?.details &&
      typeof error.details === "object" &&
      typeof error.details.errorCode === "string"
        ? error.details.errorCode
        : error.code.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    return {
      httpStatus: getHttpStatusFromHttpsCode(error.code),
      code: error.code,
      errorCode: detailCode,
      message: error.message,
      correlationId,
    };
  }

  return {
    httpStatus: 500,
    code: "internal",
    errorCode: "INTERNAL_ERROR",
    message: SAFE_ERROR_MESSAGES.INTERNAL,
    correlationId,
  };
}

function toNotificationFailureMessage(error) {
  const fallback = "Notification delivery failed.";
  if (!(error instanceof Error) || typeof error.message !== "string") {
    return fallback;
  }

  const trimmed = error.message.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 500);
}

module.exports = {
  SAFE_ERROR_MESSAGES,
  getHttpStatusFromHttpsCode,
  toClientError,
  toNotificationFailureMessage,
};
