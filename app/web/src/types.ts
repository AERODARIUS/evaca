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

export type FirestoreAlertCondition = 'above' | 'below';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface AlertDocument {
  userId: string;
  instrumentId: number;
  symbol: string;
  displayName: string;
  condition: FirestoreAlertCondition;
  targetPrice: number;
  isActive: boolean;
  intervalMinutes: number;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDocument {
  userId: string;
  alertId: string;
  instrumentId: number;
  symbol: string;
  displayName: string;
  condition: FirestoreAlertCondition;
  targetPrice: number;
  triggerPrice: number;
  status: NotificationStatus;
  errorMessage: string | null;
  createdAt: string;
}
