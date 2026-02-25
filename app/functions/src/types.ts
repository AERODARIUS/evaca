export type AlertCondition = 'gte' | 'lte';

export interface Alert {
  id: string;
  uid: string;
  email: string;
  instrumentId: number;
  symbol: string;
  displayName: string;
  condition: AlertCondition;
  targetPrice: number;
  creationPrice: number;
  lastSeenPrice: number;
  frequencyMinutes: number;
  nextCheckAt: FirebaseFirestore.Timestamp;
  lastCheckedAt: FirebaseFirestore.Timestamp | null;
  lastNotifiedAt: FirebaseFirestore.Timestamp | null;
  status: 'active' | 'paused' | 'triggered';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface SearchInstrument {
  instrumentId: number;
  symbol: string;
  displayName: string;
}
