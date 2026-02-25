import { defineSecret } from 'firebase-functions/params';
import { SearchInstrument } from './types';

const ETORO_APP_KEY = defineSecret('ETORO_APP_KEY');
const ETORO_USER_KEY = defineSecret('ETORO_USER_KEY');
const BASE_URL = 'https://public-api.etoro.com/api/v1';

function buildHeaders(): HeadersInit {
  return {
    'content-type': 'application/json',
    'x-api-key': ETORO_APP_KEY.value(),
    'x-user-key': ETORO_USER_KEY.value(),
    'x-request-id': crypto.randomUUID(),
  };
}

function readInstrumentId(raw: Record<string, unknown>): number | null {
  const id = raw.instrumentId ?? raw.InstrumentID;
  if (typeof id === 'number') return id;
  return null;
}

export async function searchInstruments(searchText: string): Promise<SearchInstrument[]> {
  const params = new URLSearchParams({
    searchText,
    pageSize: '10',
    pageNumber: '1',
    fields: 'instrumentId,internalSymbolFull,displayname',
  });

  const response = await fetch(`${BASE_URL}/market-data/search?${params.toString()}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`eToro search failed: ${response.status}`);
  }

  const body = (await response.json()) as { items?: Array<Record<string, unknown>> };
  const items = body.items ?? [];

  return items
    .map((item) => ({
      instrumentId: readInstrumentId(item),
      symbol: typeof item.internalSymbolFull === 'string' ? item.internalSymbolFull : '',
      displayName: typeof item.displayname === 'string' ? item.displayname : '',
    }))
    .filter((item): item is SearchInstrument => item.instrumentId !== null && item.symbol.length > 0);
}

export async function getInstrumentRate(instrumentId: number): Promise<number> {
  const params = new URLSearchParams({ instrumentIds: `${instrumentId}` });

  const response = await fetch(`${BASE_URL}/market-data/instruments/rates?${params.toString()}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`eToro rates failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    items?: Array<Record<string, unknown>>;
    rates?: Array<Record<string, unknown>>;
  };

  const rows = body.items ?? body.rates ?? [];
  const first = rows[0] ?? {};

  const rate = first.bid ?? first.ask ?? first.Bid ?? first.Ask;
  if (typeof rate !== 'number') {
    throw new Error('Rate not found in eToro response');
  }

  return rate;
}

export const etoroSecrets = [ETORO_APP_KEY, ETORO_USER_KEY];
