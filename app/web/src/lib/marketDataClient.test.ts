import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHttpsCallable } = vi.hoisted(() => ({
  mockHttpsCallable: vi.fn(),
}));

vi.mock('./firebase', () => ({
  functions: { _tag: 'functions' },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}));

import { marketDataClient } from './marketDataClient';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('marketDataClient', () => {
  it('returns searched instruments on success', async () => {
    const callableMock = vi.fn().mockResolvedValue({
      data: {
        items: [{ instrumentId: 101, symbol: 'BTC', displayName: 'Bitcoin' }],
      },
    });
    mockHttpsCallable.mockReturnValue(callableMock);

    const items = await marketDataClient.searchInstruments('btc');

    expect(items).toEqual([{ instrumentId: 101, symbol: 'BTC', displayName: 'Bitcoin' }]);
    expect(mockHttpsCallable).toHaveBeenCalledWith({ _tag: 'functions' }, 'searchEtoroInstruments');
  });

  it('returns instrument rate on success and throws on invalid payload', async () => {
    const callableMock = vi.fn().mockResolvedValue({ data: { rate: 123.45 } });
    mockHttpsCallable.mockReturnValue(callableMock);
    await expect(marketDataClient.getInstrumentRate(101)).resolves.toBe(123.45);

    const invalidCallableMock = vi.fn().mockResolvedValue({ data: { rate: null } });
    mockHttpsCallable.mockReturnValue(invalidCallableMock);
    await expect(marketDataClient.getInstrumentRate(101)).rejects.toThrow('Unable to load instrument rate right now.');
  });
});
