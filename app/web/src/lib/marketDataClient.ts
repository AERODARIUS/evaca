import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { InstrumentOption } from '../types';

export interface MarketDataClient {
  searchInstruments: (searchText: string) => Promise<InstrumentOption[]>;
  getInstrumentRate: (instrumentId: number) => Promise<number>;
}

export const marketDataClient: MarketDataClient = {
  async searchInstruments(searchText: string): Promise<InstrumentOption[]> {
    const fn = httpsCallable(functions, 'searchEtoroInstruments');
    const result = await fn({ searchText });
    const data = result.data as { items?: InstrumentOption[] };
    return Array.isArray(data.items) ? data.items : [];
  },

  async getInstrumentRate(instrumentId: number): Promise<number> {
    const fn = httpsCallable(functions, 'getEtoroInstrumentRate');
    const result = await fn({ instrumentId });
    const data = result.data as { rate?: number };

    if (typeof data.rate !== 'number' || !Number.isFinite(data.rate)) {
      throw new Error('Unable to load instrument rate right now.');
    }

    return data.rate;
  },
};
