import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAddDoc,
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDocs,
  mockOrderBy,
  mockQuery,
  mockServerTimestamp,
  mockUpdateDoc,
  mockWhere,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'alerts-collection'),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockOrderBy: vi.fn(),
  mockQuery: vi.fn(),
  mockServerTimestamp: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('./firebase', () => ({
  db: { _tag: 'db' },
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {
    private readonly dateValue: Date;

    constructor(dateValue: Date) {
      this.dateValue = dateValue;
    }

    toDate() {
      return this.dateValue;
    }
  },
  addDoc: mockAddDoc,
  collection: mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDocs: mockGetDocs,
  orderBy: mockOrderBy,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

import { createAlert, deleteAlert, listAlerts, toggleAlertActive, updateAlert } from './alerts';

beforeEach(() => {
  vi.clearAllMocks();
  mockWhere.mockReturnValue('where-clause');
  mockOrderBy.mockReturnValue('order-clause');
  mockQuery.mockReturnValue('alerts-query');
  mockServerTimestamp.mockReturnValue('ts');
  mockDoc.mockImplementation((_db: unknown, _name: string, id: string) => `doc:${id}`);
});

describe('alerts integration', () => {
  it('creates alert document with mapped firestore condition', async () => {
    await createAlert('user-1', {
      instrumentId: 101,
      symbol: ' BTC ',
      displayName: ' BTC Above 100 ',
      targetPrice: 100,
      condition: 'gte',
      intervalMinutes: 5,
      isActive: true,
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc.mock.calls[0][0]).toBe('alerts-collection');
    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
      userId: 'user-1',
      instrumentId: 101,
      symbol: 'BTC',
      displayName: 'BTC Above 100',
      condition: 'above',
      targetPrice: 100,
      isActive: true,
      intervalMinutes: 5,
      lastCheckedAt: null,
      lastTriggeredAt: null,
      createdAt: 'ts',
      updatedAt: 'ts',
    });
  });

  it('updates and toggles alert documents', async () => {
    await updateAlert('alert-1', {
      instrumentId: 202,
      symbol: 'ETH',
      displayName: 'ETH below 80',
      targetPrice: 80,
      condition: 'lte',
      intervalMinutes: 15,
      isActive: false,
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc:alert-1', {
      instrumentId: 202,
      symbol: 'ETH',
      displayName: 'ETH below 80',
      condition: 'below',
      targetPrice: 80,
      isActive: false,
      intervalMinutes: 15,
      updatedAt: 'ts',
    });

    await toggleAlertActive('alert-1', true);
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc:alert-1', {
      isActive: true,
      updatedAt: 'ts',
    });

    await deleteAlert('alert-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc:alert-1');
  });

  it('lists alerts mapped to UI shape and sorted query', async () => {
    const createdAt = new Date('2026-03-10T10:00:00.000Z');
    const updatedAt = new Date('2026-03-10T11:00:00.000Z');

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'alert-abc',
          data: () => ({
            userId: 'user-1',
            instrumentId: 333,
            symbol: 'AAPL',
            displayName: 'Apple momentum',
            targetPrice: 180,
            condition: 'above',
            isActive: true,
            intervalMinutes: 60,
            lastCheckedAt: null,
            lastTriggeredAt: null,
            createdAt,
            updatedAt,
          }),
        },
      ],
    });

    const items = await listAlerts('user-1');

    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-1');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockGetDocs).toHaveBeenCalledWith('alerts-query');
    expect(items).toEqual([
      {
        id: 'alert-abc',
        userId: 'user-1',
        instrumentId: 333,
        symbol: 'AAPL',
        displayName: 'Apple momentum',
        targetPrice: 180,
        condition: 'gte',
        isActive: true,
        intervalMinutes: 60,
        lastCheckedAt: null,
        lastTriggeredAt: null,
        createdAt,
        updatedAt,
      },
    ]);
  });
});
