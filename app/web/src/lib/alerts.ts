import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { AlertCondition, AlertDocument, AlertRow, FirestoreAlertCondition } from '../types';
import { AlertInput, validateAlertInput as validateAlertInputPayload } from './alertValidation';

const alertsCollection = collection(db, 'alerts');

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
  const alertsQuery = query(alertsCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(alertsQuery);

  return snapshot.docs.map((item) => mapDocToAlertRow(item.id, item.data() as AlertDocument));
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
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAlert(alertId: string): Promise<void> {
  await deleteDoc(doc(db, 'alerts', alertId));
}

export async function toggleAlertActive(alertId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'alerts', alertId), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}
