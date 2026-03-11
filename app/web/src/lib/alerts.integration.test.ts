import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAddDoc,
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDocs,
  mockLimit,
  mockOrderBy,
  mockQuery,
  mockServerTimestamp,
  mockStartAfter,
  mockUpdateDoc,
  mockWhere,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'alerts-collection'),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockQuery: vi.fn(),
  mockServerTimestamp: vi.fn(),
  mockStartAfter: vi.fn(),
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
  limit: mockLimit,
  orderBy: mockOrderBy,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  startAfter: mockStartAfter,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

import { createAlert, deleteAlert, listAlertsPage, toggleAlertActive, updateAlert } from './alerts';

beforeEach(() => {
  vi.clearAllMocks();
  mockWhere.mockReturnValue('where-clause');
  mockOrderBy.mockReturnValue('order-clause');
  mockLimit.mockReturnValue('limit-clause');
  mockStartAfter.mockReturnValue('cursor-clause');
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
      nextCheckAt: 'ts',
      updatedAt: 'ts',
    });

    await toggleAlertActive('alert-1', true);
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc:alert-1', {
      isActive: true,
      nextCheckAt: 'ts',
      updatedAt: 'ts',
    });

    await deleteAlert('alert-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc:alert-1');
  });

  it('lists first page alerts with next cursor token', async () => {
    const createdAt = new Date('2026-03-10T10:00:00.000Z');
    const updatedAt = new Date('2026-03-10T11:00:00.000Z');
    const secondCreatedAt = new Date('2026-03-10T09:00:00.000Z');
    const secondUpdatedAt = new Date('2026-03-10T09:30:00.000Z');
    const thirdCreatedAt = new Date('2026-03-10T08:00:00.000Z');
    const thirdUpdatedAt = new Date('2026-03-10T08:30:00.000Z');

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
        {
          id: 'alert-def',
          data: () => ({
            userId: 'user-1',
            instrumentId: 444,
            symbol: 'TSLA',
            displayName: 'Tesla momentum',
            targetPrice: 210,
            condition: 'below',
            isActive: false,
            intervalMinutes: 30,
            lastCheckedAt: null,
            lastTriggeredAt: null,
            createdAt: secondCreatedAt,
            updatedAt: secondUpdatedAt,
          }),
        },
        {
          id: 'alert-ghi',
          data: () => ({
            userId: 'user-1',
            instrumentId: 555,
            symbol: 'MSFT',
            displayName: 'Microsoft momentum',
            targetPrice: 350,
            condition: 'above',
            isActive: true,
            intervalMinutes: 45,
            lastCheckedAt: null,
            lastTriggeredAt: null,
            createdAt: thirdCreatedAt,
            updatedAt: thirdUpdatedAt,
          }),
        },
      ],
    });

    const page = await listAlertsPage('user-1', { pageSize: 2 });

    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-1');
    expect(mockOrderBy).toHaveBeenCalledWith('__name__', 'desc');
    expect(mockGetDocs).toHaveBeenCalledWith('alerts-query');
    expect(page.items).toEqual([
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
      {
        id: 'alert-def',
        userId: 'user-1',
        instrumentId: 444,
        symbol: 'TSLA',
        displayName: 'Tesla momentum',
        targetPrice: 210,
        condition: 'lte',
        isActive: false,
        intervalMinutes: 30,
        lastCheckedAt: null,
        lastTriggeredAt: null,
        createdAt: secondCreatedAt,
        updatedAt: secondUpdatedAt,
      },
    ]);
    expect(typeof page.nextPageToken).toBe('string');
  });

  it('lists next page alerts using cursor token', async () => {
    const createdAt = new Date('2026-03-10T07:00:00.000Z');
    const updatedAt = new Date('2026-03-10T07:30:00.000Z');

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'alert-jkl',
          data: () => ({
            userId: 'user-1',
            instrumentId: 777,
            symbol: 'NFLX',
            displayName: 'Netflix',
            targetPrice: 400,
            condition: 'above',
            isActive: true,
            intervalMinutes: 10,
            lastCheckedAt: null,
            lastTriggeredAt: null,
            createdAt,
            updatedAt,
          }),
        },
      ],
    });

    const page = await listAlertsPage('user-1', {
      pageSize: 2,
      pageToken: btoa(JSON.stringify({ createdAtMs: Date.parse('2026-03-10T08:00:00.000Z'), id: 'alert-ghi' })),
    });

    expect(mockStartAfter).toHaveBeenCalledWith(new Date('2026-03-10T08:00:00.000Z'), 'alert-ghi');
    expect(page.nextPageToken).toBeNull();
    expect(page.items).toHaveLength(1);
  });

  it('returns empty page for no documents', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const page = await listAlertsPage('user-1', { pageSize: 2 });
    expect(page.items).toEqual([]);
    expect(page.nextPageToken).toBeNull();
  });
});
