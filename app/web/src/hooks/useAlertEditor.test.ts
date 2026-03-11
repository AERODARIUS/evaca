import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertRow } from '../types';

const { mockCreateAlert, mockUpdateAlert } = vi.hoisted(() => ({
  mockCreateAlert: vi.fn(),
  mockUpdateAlert: vi.fn(),
}));

vi.mock('../lib/alerts', () => ({
  createAlert: mockCreateAlert,
  updateAlert: mockUpdateAlert,
}));

vi.mock('../lib/marketDataClient', () => ({
  marketDataClient: {
    searchInstruments: vi.fn(),
    getInstrumentRate: vi.fn(),
  },
}));

import { buildInitialEditorState, submitEditorDraft } from './useAlertEditor';

beforeEach(() => {
  vi.clearAllMocks();
});

function buildEditingRow(): AlertRow {
  return {
    id: 'alert-1',
    userId: 'user-1',
    instrumentId: 101,
    symbol: 'BTC',
    displayName: 'BTC above 100',
    targetPrice: 100,
    condition: 'gte',
    isActive: true,
    intervalMinutes: 5,
    lastCheckedAt: null,
    lastTriggeredAt: null,
    createdAt: new Date('2026-03-10T10:00:00.000Z'),
    updatedAt: new Date('2026-03-10T10:05:00.000Z'),
  };
}

describe('useAlertEditor helpers', () => {
  it('buildInitialEditorState initializes reset and edit states from one place', () => {
    const emptyState = buildInitialEditorState(null);
    expect(emptyState.alertName).toBe('');
    expect(emptyState.condition).toBe('gte');

    const editState = buildInitialEditorState(buildEditingRow());
    expect(editState.alertName).toBe('BTC above 100');
    expect(editState.instrument?.instrumentId).toBe(101);
    expect(editState.frequencyMinutes).toBe(5);
  });

  it('submitEditorDraft returns validation error for invalid draft', async () => {
    const state = buildInitialEditorState(null);

    const result = await submitEditorDraft({
      editing: null,
      userId: 'user-1',
      state,
      onSaved: async () => {},
      onCancelEdit: () => {},
    });

    expect(result).toEqual({ error: 'Please correct the highlighted fields and submit again.' });
    expect(mockCreateAlert).not.toHaveBeenCalled();
    expect(mockUpdateAlert).not.toHaveBeenCalled();
  });

  it('submitEditorDraft handles success and async failure paths', async () => {
    const baseState = buildInitialEditorState(null);
    const validState = {
      ...baseState,
      alertName: 'BTC above 100',
      instrument: { instrumentId: 101, symbol: 'BTC', displayName: 'Bitcoin' },
      targetPrice: 100,
      frequencyMinutes: 5,
    };

    const onSaved = vi.fn(async () => {});
    mockCreateAlert.mockResolvedValue(undefined);
    await expect(
      submitEditorDraft({
        editing: null,
        userId: 'user-1',
        state: validState,
        onSaved,
        onCancelEdit: () => {},
      }),
    ).resolves.toEqual({ successMessage: 'Alert created successfully.' });

    expect(mockCreateAlert).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);

    mockCreateAlert.mockRejectedValue(new Error('boom'));
    await expect(
      submitEditorDraft({
        editing: null,
        userId: 'user-1',
        state: validState,
        onSaved: async () => {},
        onCancelEdit: () => {},
      }),
    ).resolves.toEqual({ error: 'Save failed: boom' });
  });
});
