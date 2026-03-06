import { describe, expect, it } from 'vitest';
import { validateAlertInput } from './alertValidation';

describe('validateAlertInput', () => {
  it('accepts a valid payload', () => {
    const errors = validateAlertInput({
      instrumentId: 101,
      symbol: 'AAPL',
      displayName: 'Apple breakout',
      targetPrice: 150,
      condition: 'gte',
      intervalMinutes: 5,
      isActive: true,
    });

    expect(errors).toEqual([]);
  });

  it('returns validation errors for invalid payloads', () => {
    const errors = validateAlertInput({
      instrumentId: 0,
      symbol: ' ',
      displayName: ' ',
      targetPrice: -1,
      condition: 'lte',
      intervalMinutes: 0,
      isActive: false,
    });

    expect(errors).toEqual([
      'Select a valid instrument.',
      'Symbol is required.',
      'Display name is required.',
      'Target price must be a positive number.',
      'Check interval must be between 1 and 1440 minutes.',
    ]);
  });
});
