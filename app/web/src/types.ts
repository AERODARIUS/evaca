export type AlertCondition = 'gte' | 'lte';
export type FirestoreAlertCondition = 'above' | 'below';

export interface AlertRow {
  id: string;
  userId: string;
  instrumentId: number;
  symbol: string;
  displayName: string;
  targetPrice: number;
  condition: AlertCondition;
  isActive: boolean;
  intervalMinutes: number;
  lastCheckedAt: Date | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstrumentOption {
  instrumentId: number;
  symbol: string;
  displayName: string;
}

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
  lastCheckedAt: Date | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
