import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { AlertCondition, AlertDocument, AlertRow, FirestoreAlertCondition } from '../types';
import { AlertInput, validateAlertInput as validateAlertInputPayload } from './alertValidation';

const alertsCollection = collection(db, 'alerts');
const DEFAULT_ALERTS_PAGE_SIZE = 20;

export interface AlertsPage {
  items: AlertRow[];
  nextPageToken: string | null;
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return null;
}

function toFirestoreCondition(condition: AlertCondition): FirestoreAlertCondition {
  return condition === 'gte' ? 'above' : 'below';
}

function toUiCondition(condition: FirestoreAlertCondition | AlertCondition): AlertCondition {
  if (condition === 'above' || condition === 'gte') {
    return 'gte';
  }

  return 'lte';
}

export function validateAlertInput(input: AlertInput): string[] {
  return validateAlertInputPayload(input);
}

function mapDocToAlertRow(id: string, data: AlertDocument): AlertRow {
  return {
    id,
    userId: data.userId,
    instrumentId: data.instrumentId,
    symbol: data.symbol,
    displayName: data.displayName,
    targetPrice: data.targetPrice,
    condition: toUiCondition(data.condition),
    isActive: data.isActive,
    intervalMinutes: data.intervalMinutes,
    lastCheckedAt: asDate(data.lastCheckedAt),
    lastTriggeredAt: asDate(data.lastTriggeredAt),
    createdAt: asDate(data.createdAt) ?? new Date(0),
    updatedAt: asDate(data.updatedAt) ?? new Date(0),
  };
}

export async function listAlerts(userId: string): Promise<AlertRow[]> {
  const allItems: AlertRow[] = [];
  let pageToken: string | null = null;

  do {
    const page = await listAlertsPage(userId, { pageToken });
    allItems.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return allItems;
}

function encodePageToken(createdAtMs: number, id: string): string {
  return btoa(JSON.stringify({ createdAtMs, id }));
}

function decodePageToken(pageToken?: string | null): { createdAtMs: number; id: string } | null {
  if (!pageToken) {
    return null;
  }

  try {
    const parsed = JSON.parse(atob(pageToken)) as { createdAtMs?: number; id?: string };
    if (typeof parsed.createdAtMs !== 'number' || !Number.isFinite(parsed.createdAtMs) || typeof parsed.id !== 'string' || parsed.id.length === 0) {
      return null;
    }
    return { createdAtMs: parsed.createdAtMs, id: parsed.id };
  } catch (_error) {
    return null;
  }
}

export async function listAlertsPage(
  userId: string,
  options?: { pageSize?: number; pageToken?: string | null },
): Promise<AlertsPage> {
  const pageSize = Math.min(Math.max(Math.trunc(options?.pageSize ?? DEFAULT_ALERTS_PAGE_SIZE), 1), 100);
  const cursor = decodePageToken(options?.pageToken);

  let alertsQuery = query(
    alertsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'desc'),
    limit(pageSize + 1),
  );

  if (cursor) {
    alertsQuery = query(
      alertsCollection,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      orderBy('__name__', 'desc'),
      startAfter(new Date(cursor.createdAtMs), cursor.id),
      limit(pageSize + 1),
    );
  }

  const snapshot = await getDocs(alertsQuery);
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const items = pageDocs.map((item) => mapDocToAlertRow(item.id, item.data() as AlertDocument));
  let nextPageToken: string | null = null;

  if (snapshot.docs.length > pageSize) {
    const lastRow = items[items.length - 1];
    nextPageToken = encodePageToken(lastRow.createdAt.getTime(), lastRow.id);
  }

  return { items, nextPageToken };
}

export async function createAlert(userId: string, input: AlertInput): Promise<void> {
  const errors = validateAlertInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  await addDoc(alertsCollection, {
    userId,
    instrumentId: input.instrumentId,
    symbol: input.symbol.trim(),
    displayName: input.displayName.trim(),
    condition: toFirestoreCondition(input.condition),
    targetPrice: input.targetPrice,
    isActive: input.isActive,
    intervalMinutes: input.intervalMinutes,
    lastCheckedAt: null,
    nextCheckAt: serverTimestamp(),
    lastTriggeredAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAlert(alertId: string, input: AlertInput): Promise<void> {
  const errors = validateAlertInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const alertRef = doc(db, 'alerts', alertId);
  await updateDoc(alertRef, {
    instrumentId: input.instrumentId,
    symbol: input.symbol.trim(),
    displayName: input.displayName.trim(),
    condition: toFirestoreCondition(input.condition),
    targetPrice: input.targetPrice,
    isActive: input.isActive,
    intervalMinutes: input.intervalMinutes,
    nextCheckAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAlert(alertId: string): Promise<void> {
  await deleteDoc(doc(db, 'alerts', alertId));
}

export async function toggleAlertActive(alertId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'alerts', alertId), {
    isActive,
    nextCheckAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
