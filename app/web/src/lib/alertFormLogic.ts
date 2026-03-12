import { AlertCondition, InstrumentOption } from '../types';

export type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

interface CallableErrorLike {
  code?: string;
  message?: string;
  details?: {
    errorCode?: string;
  };
}

export interface ValidationErrors {
  alertName?: string;
  instrument?: string;
  targetPrice?: string;
  interval?: string;
}

export interface AlertDraft {
  alertName: string;
  instrument: InstrumentOption | null;
  targetPrice: number | null;
  condition: AlertCondition;
  intervalMinutes: number;
  isActive: boolean;
}

export interface AlertPayload {
  instrumentId: number;
  symbol: string;
  displayName: string;
  targetPrice: number;
  condition: AlertCondition;
  intervalMinutes: number;
  isActive: boolean;
}

export interface SearchFeedback {
  state: SearchState;
  message: string;
}

const SEARCH_DEFAULT_MESSAGE = 'Search by ticker symbol or asset name.';

export function validateAlertDraft(alertName: string, instrument: InstrumentOption | null, targetPrice: number | null, frequencyMinutes: number): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!alertName.trim()) {
    errors.alertName = 'Alert name is required so you can identify this trigger later.';
  }

  if (!instrument) {
    errors.instrument = 'Select one asset from the search results before saving.';
  }

  if (targetPrice === null || Number.isNaN(targetPrice) || targetPrice <= 0) {
    errors.targetPrice = 'Target price must be a positive number.';
  }

  if (!Number.isInteger(frequencyMinutes)) {
    errors.interval = 'Check interval must be a whole number of minutes.';
  } else if (frequencyMinutes < 1 || frequencyMinutes > 1440) {
    errors.interval = 'Check interval must be between 1 and 1440 minutes.';
  }

  return errors;
}

export function buildAlertPayload(draft: AlertDraft): { errors: ValidationErrors; payload: AlertPayload | null } {
  const errors = validateAlertDraft(draft.alertName, draft.instrument, draft.targetPrice, draft.intervalMinutes);
  if (Object.keys(errors).length > 0 || !draft.instrument || draft.targetPrice === null) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      instrumentId: draft.instrument.instrumentId,
      symbol: draft.instrument.symbol,
      displayName: draft.alertName.trim(),
      targetPrice: draft.targetPrice,
      condition: draft.condition,
      intervalMinutes: draft.intervalMinutes,
      isActive: draft.isActive,
    },
  };
}

export function toggleCondition(current: AlertCondition): AlertCondition {
  return current === 'gte' ? 'lte' : 'gte';
}

export function getConditionPresentation(condition: AlertCondition): { icon: 'up' | 'down'; label: 'Above' | 'Below' } {
  if (condition === 'gte') {
    return {
      icon: 'up',
      label: 'Above',
    };
  }

  return {
    icon: 'down',
    label: 'Below',
  };
}

export function searchIdleFeedback(): SearchFeedback {
  return {
    state: 'idle',
    message: SEARCH_DEFAULT_MESSAGE,
  };
}

export function searchLoadingFeedback(): SearchFeedback {
  return {
    state: 'loading',
    message: 'Searching market data...',
  };
}

export function searchResultsFeedback(searchText: string, resultsCount: number): SearchFeedback {
  if (resultsCount === 0) {
    return {
      state: 'empty',
      message: `No assets found for "${searchText}". Try a ticker like XRP, BTC, or TSLA.`,
    };
  }

  return {
    state: 'results',
    message: `Found ${resultsCount} result(s). Select one asset to continue.`,
  };
}

export function getSearchErrorMessage(error: unknown, searchText: string): string {
  const fallback = `We couldn't search assets for "${searchText}" right now. Please try again.`;
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const callableError = error as CallableErrorLike;

  switch (callableError.code) {
    case 'functions/invalid-argument':
      return 'Enter a symbol or asset name before searching (for example: XRP, BTC, AAPL).';
    case 'functions/unauthenticated': {
      const detailCode = callableError.details?.errorCode;
      if (detailCode === 'APP_CHECK_REQUIRED') {
        return 'Search is blocked by Firebase App Check. Verify site key, allowed domains, and App Check config.';
      }
      if (detailCode === 'AUTH_REQUIRED') {
        return 'Your session expired. Sign in again and retry the search.';
      }
      return 'Authentication is required to search assets. Sign in and try again.';
    }
    case 'functions/permission-denied':
      return 'Search is currently blocked for this account. Check your Firebase/eToro setup.';
    case 'functions/not-found':
      return `No assets found for "${searchText}". Try a ticker symbol (XRP, BTC, TSLA).`;
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'The eToro search service is temporarily unavailable. Please retry in a few seconds.';
    case 'functions/internal':
    case 'functions/unknown':
      return 'Search failed in Cloud Functions. Check Functions deployment and logs for eToro errors.';
    case 'functions/failed-precondition':
      return 'Search is misconfigured: missing eToro API secrets in Functions.';
    default:
      break;
  }

  if (typeof callableError.message === 'string' && callableError.message.length > 0) {
    if (callableError.message.toLowerCase().includes('secret')) {
      return 'Search is misconfigured: missing eToro API secrets in Functions.';
    }
  }

  return fallback;
}
