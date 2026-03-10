import { describe, expect, it } from 'vitest';
import {
  getConditionPresentation,
  searchIdleFeedback,
  searchLoadingFeedback,
  searchResultsFeedback,
  validateAlertDraft,
} from './alertFormLogic';

describe('accessibility checks for new alert flow', () => {
  it('exposes deterministic textual feedback for default and loading states', () => {
    expect(searchIdleFeedback()).toEqual({
      state: 'idle',
      message: 'Search by ticker symbol or asset name.',
    });

    expect(searchLoadingFeedback()).toEqual({
      state: 'loading',
      message: 'Searching market data...',
    });

    expect(searchResultsFeedback('btc', 0).message).toContain('No assets found for "btc"');
    expect(searchResultsFeedback('btc', 2).message).toContain('Found 2 result(s)');
  });

  it('provides text-based validation and state labels (non-color indicators)', () => {
    const errors = validateAlertDraft(' ', null, null, 0);

    expect(errors.alertName).toContain('Alert name is required');
    expect(errors.instrument).toContain('Select one asset');
    expect(errors.targetPrice).toContain('positive number');
    expect(errors.interval).toContain('between 1 and 1440');

    expect(getConditionPresentation('gte').label).toBe('Above');
    expect(getConditionPresentation('lte').label).toBe('Below');
  });
});
