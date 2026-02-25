export type AlertCondition = 'gte' | 'lte';

export interface AlertRow {
  id: string;
  instrumentId: number;
  symbol: string;
  displayName: string;
  targetPrice: number;
  condition: AlertCondition;
  creationPrice: number;
  lastSeenPrice: number;
  frequencyMinutes: number;
  status: 'active' | 'paused' | 'triggered';
}

export interface InstrumentOption {
  instrumentId: number;
  symbol: string;
  displayName: string;
}
