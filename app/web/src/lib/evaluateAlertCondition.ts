import { AlertCondition } from '../types';

export interface AlertEvaluationInput {
  condition: AlertCondition;
  currentPrice: number;
  targetPrice: number;
}

export function evaluateAlertCondition({
  condition,
  currentPrice,
  targetPrice,
}: AlertEvaluationInput): boolean {
  if (condition === 'gte') {
    return currentPrice >= targetPrice;
  }

  return currentPrice <= targetPrice;
}
