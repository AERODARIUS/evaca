import { AlertCondition } from '../types';

export interface AlertInput {
  instrumentId: number;
  symbol: string;
  displayName: string;
  targetPrice: number;
  condition: AlertCondition;
  intervalMinutes: number;
  isActive: boolean;
}

const ALERT_INTERVAL_MIN = 1;
const ALERT_INTERVAL_MAX = 1440;

export function validateAlertInput(input: AlertInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.instrumentId) || input.instrumentId <= 0) {
    errors.push('Select a valid instrument.');
  }

  if (!input.symbol.trim()) {
    errors.push('Symbol is required.');
  }

  if (!input.displayName.trim()) {
    errors.push('Display name is required.');
  }

  if (!Number.isFinite(input.targetPrice) || input.targetPrice <= 0) {
    errors.push('Target price must be a positive number.');
  }

  if (!Number.isInteger(input.intervalMinutes)) {
    errors.push('Check interval must be an integer in minutes.');
  } else if (input.intervalMinutes < ALERT_INTERVAL_MIN || input.intervalMinutes > ALERT_INTERVAL_MAX) {
    errors.push('Check interval must be between 1 and 1440 minutes.');
  }

  return errors;
}
