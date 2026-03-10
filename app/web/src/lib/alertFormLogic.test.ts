import { describe, expect, it } from 'vitest';
import {
  buildAlertPayload,
  getConditionPresentation,
  getSearchErrorMessage,
  searchLoadingFeedback,
  searchResultsFeedback,
  toggleCondition,
  validateAlertDraft,
} from './alertFormLogic';

describe('alert form validation and submit payload', () => {
  it('returns user-friendly validation errors for invalid submission draft', () => {
    const errors = validateAlertDraft(' ', null, 0, 0);

    expect(errors).toEqual({
      alertName: 'Alert name is required so you can identify this trigger later.',
      instrument: 'Select one asset from the search results before saving.',
      targetPrice: 'Target price must be a positive number.',
      interval: 'Check interval must be between 1 and 1440 minutes.',
    });
  });

  it('builds submission payload for valid form values', () => {
    const { errors, payload } = buildAlertPayload({
      alertName: ' BTC breakout above 100 ',
      instrument: {
        instrumentId: 101,
        symbol: 'BTC',
        displayName: 'Bitcoin',
      },
      targetPrice: 100,
      condition: 'gte',
      intervalMinutes: 5,
      isActive: true,
    });

    expect(errors).toEqual({});
    expect(payload).toEqual({
      instrumentId: 101,
      symbol: 'BTC',
      displayName: 'BTC breakout above 100',
      targetPrice: 100,
      condition: 'gte',
      intervalMinutes: 5,
      isActive: true,
    });
  });
});

describe('condition toggle interactions', () => {
  it('toggles condition value and keeps icon/label in sync', () => {
    const next = toggleCondition('gte');

    expect(next).toBe('lte');
    expect(getConditionPresentation(next)).toEqual({
      icon: 'down',
      label: 'Below',
    });
    expect(getConditionPresentation('gte')).toEqual({
      icon: 'up',
      label: 'Above',
    });
  });
});

describe('asset search deterministic states', () => {
  it('covers loading, success, and empty feedback states', () => {
    expect(searchLoadingFeedback()).toEqual({
      state: 'loading',
      message: 'Searching market data...',
    });

    expect(searchResultsFeedback('btc', 2)).toEqual({
      state: 'results',
      message: 'Found 2 result(s). Select one asset to continue.',
    });

    expect(searchResultsFeedback('btc', 0)).toEqual({
      state: 'empty',
      message: 'No assets found for "btc". Try a ticker like XRP, BTC, or TSLA.',
    });
  });

  it('maps callable failures to deterministic error guidance', () => {
    expect(getSearchErrorMessage({ code: 'functions/unauthenticated' }, 'btc')).toBe(
      'Your session expired. Sign in again and retry the search.',
    );

    expect(getSearchErrorMessage({ code: 'functions/failed-precondition' }, 'btc')).toBe(
      'Search is misconfigured: missing eToro API secrets in Functions.',
    );

    expect(getSearchErrorMessage({}, 'btc')).toContain("couldn't search assets");
  });
});
