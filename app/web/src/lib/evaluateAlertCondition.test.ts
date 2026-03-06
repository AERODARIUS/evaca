import { describe, expect, it } from 'vitest';
import { evaluateAlertCondition } from './evaluateAlertCondition';

describe('evaluateAlertCondition', () => {
  it('returns true when gte condition is met', () => {
    const result = evaluateAlertCondition({
      condition: 'gte',
      currentPrice: 102,
      targetPrice: 100,
    });

    expect(result).toBe(true);
  });

  it('returns true when lte condition is met', () => {
    const result = evaluateAlertCondition({
      condition: 'lte',
      currentPrice: 98,
      targetPrice: 100,
    });

    expect(result).toBe(true);
  });

  it('returns false when gte condition is not met', () => {
    const result = evaluateAlertCondition({
      condition: 'gte',
      currentPrice: 99.99,
      targetPrice: 100,
    });

    expect(result).toBe(false);
  });

  it('returns false when lte condition is not met', () => {
    const result = evaluateAlertCondition({
      condition: 'lte',
      currentPrice: 100.01,
      targetPrice: 100,
    });

    expect(result).toBe(false);
  });
});
