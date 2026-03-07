import { FormEvent, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertRow, InstrumentOption } from '../types';
import { createAlert, updateAlert } from '../lib/alerts';

interface Props {
  userId: string;
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

type NotificationChannel = 'inApp' | 'email' | 'push';
type SearchFeedbackType = 'error' | 'info';

interface CallableErrorLike {
  code?: string;
  message?: string;
}

function getSearchErrorMessage(error: unknown, searchText: string): string {
  const fallback = `We couldn't search assets for "${searchText}" right now. Please try again.`;
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const callableError = error as CallableErrorLike;

  switch (callableError.code) {
    case 'functions/invalid-argument':
      return 'Enter a symbol or asset name before searching (for example: XRP, BTC, AAPL).';
    case 'functions/unauthenticated':
      return 'Your session expired. Sign in again and retry the search.';
    case 'functions/permission-denied':
      return 'Search is currently blocked for this account. Check your Firebase/eToro setup.';
    case 'functions/not-found':
      return `No assets found for "${searchText}". Try a ticker symbol (XRP, BTC, TSLA).`;
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'The eToro search service is temporarily unavailable. Please retry in a few seconds.';
    case 'functions/internal':
    case 'functions/unknown':
      return 'Search failed in Cloud Functions. Check Functions deployment and logs for eToro errors.';
    case 'functions/failed-precondition':
      return 'Search is misconfigured: missing eToro API secrets in Functions.';
    default:
      break;
  }

  if (typeof callableError.message === 'string' && callableError.message.length > 0) {
    if (callableError.message.toLowerCase().includes('secret')) {
      return 'Search is misconfigured: missing eToro API secrets in Functions.';
    }
  }

  return fallback;
}

export function AlertForm({ userId, editing, onSaved, onCancelEdit }: Props) {
  const [alertName, setAlertName] = useState('');
  const [query, setQuery] = useState('');
  const [instrument, setInstrument] = useState<InstrumentOption | null>(null);
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'gte' | 'lte'>('gte');
  const [frequencyMinutes, setFrequencyMinutes] = useState('5');
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(['inApp']);
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [searchFeedbackType, setSearchFeedbackType] = useState<SearchFeedbackType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  useEffect(() => {
    if (!editing) {
      setAlertName('');
      setQuery('');
      setInstrument(null);
      setOptions([]);
      setTargetPrice('');
      setCondition('gte');
      setFrequencyMinutes('5');
      setCurrentPrice(null);
      setIsEnabled(true);
      setNotificationChannels(['inApp']);
      setError(null);
      setSearchFeedback(null);
      setSearchFeedbackType(null);
      setIsSearching(false);
      setIsLoadingPrice(false);
      return;
    }

    setInstrument({
      instrumentId: editing.instrumentId,
      symbol: editing.symbol,
      displayName: editing.displayName,
    });
    setAlertName(editing.displayName);
    setTargetPrice(String(editing.targetPrice));
    setCondition(editing.condition);
    setFrequencyMinutes(String(editing.intervalMinutes));
    setCurrentPrice(null);
    setQuery(editing.symbol);
    setIsEnabled(editing.isActive);
    setNotificationChannels(['inApp']);
    setError(null);
    setSearchFeedback(null);
    setSearchFeedbackType(null);
    setIsSearching(false);
    setIsLoadingPrice(false);
  }, [editing]);

  const search = async () => {
    const searchText = query.trim();
    if (!searchText) {
      setOptions([]);
      setSearchFeedback('Enter a symbol or asset name before searching.');
      setSearchFeedbackType('info');
      return;
    }

    setError(null);
    setSearchFeedback(null);
    setSearchFeedbackType(null);
    setIsSearching(true);

    try {
      const fn = httpsCallable(functions, 'searchEtoroInstruments');
      const result = await fn({ searchText });
      const data = result.data as { items: InstrumentOption[] };
      setOptions(data.items);
      if (data.items.length === 0) {
        setSearchFeedback(`No assets found for "${searchText}". Try a ticker like XRP, BTC, or TSLA.`);
        setSearchFeedbackType('info');
      }
    } catch (searchError) {
      setSearchFeedback(getSearchErrorMessage(searchError, searchText));
      setSearchFeedbackType('error');
      setOptions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadRate = async (instrumentId: number) => {
    setError(null);
    setIsLoadingPrice(true);

    try {
      const fn = httpsCallable(functions, 'getEtoroInstrumentRate');
      const result = await fn({ instrumentId });
      const data = result.data as { rate: number };
      setCurrentPrice(data.rate);
    } catch (rateError) {
      const message =
        rateError instanceof Error ? rateError.message : 'Unable to load instrument rate right now.';
      setError(message);
      setCurrentPrice(null);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const onSelect = async (item: InstrumentOption) => {
    setInstrument(item);
    setSearchFeedback(null);
    setSearchFeedbackType(null);
    await loadRate(item.instrumentId);
  };

  const onToggleChannel = (channel: NotificationChannel) => {
    setNotificationChannels((current) => {
      if (current.includes(channel)) {
        const next = current.filter((item) => item !== channel);
        return next.length > 0 ? next : ['inApp'];
      }

      return [...current, channel];
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!instrument) {
      setError('Please select an asset before saving.');
      return;
    }

    const payload = {
      instrumentId: instrument.instrumentId,
      symbol: instrument.symbol,
      displayName: alertName.trim() || instrument.displayName,
      targetPrice: Number(targetPrice),
      condition,
      intervalMinutes: Number(frequencyMinutes),
      isActive: isEnabled,
    };

    try {
      if (editing) {
        await updateAlert(editing.id, payload);
        onCancelEdit();
      } else {
        await createAlert(userId, payload);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unable to save alert right now.';
      setError(message);
      return;
    }

    setAlertName('');
    setQuery('');
    setInstrument(null);
    setOptions([]);
    setTargetPrice('');
    setCondition('gte');
    setFrequencyMinutes('5');
    setNotificationChannels(['inApp']);
    setIsEnabled(true);
    setCurrentPrice(null);
    await onSaved();
  };

  return (
    <section className="card">
      <h2>{editing ? 'Edit alert' : 'New alert'}</h2>
      <form onSubmit={onSubmit}>
        <label>
          Alert name
          <input
            value={alertName}
            onChange={(e) => setAlertName(e.target.value)}
            placeholder="BTC breakout alert"
            required
          />
        </label>

        <label>
          Asset selector (symbol/search)
          <div className="row">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (searchFeedback) {
                  setSearchFeedback(null);
                  setSearchFeedbackType(null);
                }
              }}
              placeholder="AAPL, BTC, TSLA"
              required
            />
            <button type="button" onClick={search} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </label>

        {options.length > 0 ? (
          <ul className="options">
            {options.map((item) => (
              <li key={item.instrumentId}>
                <button type="button" onClick={() => onSelect(item)}>
                  {item.symbol} - {item.displayName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searchFeedback ? (
          <p className={searchFeedbackType === 'error' ? 'error' : 'field-help'} role="status">
            {searchFeedback}
          </p>
        ) : null}

        {instrument ? <p>Selected: {instrument.symbol}</p> : null}
        {isLoadingPrice ? <p>Loading current price...</p> : null}
        {currentPrice !== null ? <p>Current price: {currentPrice}</p> : null}

        <label>
          Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value as 'gte' | 'lte')}>
            <option value="gte">Above</option>
            <option value="lte">Below</option>
          </select>
        </label>

        <label>
          Target price
          <input
            type="number"
            step="0.0001"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            required
          />
        </label>

        <label>
          Check interval (minutes)
          <input
            type="number"
            min={1}
            max={1440}
            value={frequencyMinutes}
            onChange={(e) => setFrequencyMinutes(e.target.value)}
            required
          />
        </label>

        <fieldset className="channels-fieldset">
          <legend>Notification channel(s)</legend>
          <div className="row wrap">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notificationChannels.includes('inApp')}
                onChange={() => onToggleChannel('inApp')}
              />
              In-app
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notificationChannels.includes('email')}
                onChange={() => onToggleChannel('email')}
              />
              Email
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notificationChannels.includes('push')}
                onChange={() => onToggleChannel('push')}
              />
              Push
            </label>
          </div>
          <p className="field-help">Delivery setup is wired in later tasks; this UI now captures selection.</p>
        </fieldset>

        <label className="checkbox-label">
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
          Enabled status
        </label>

        <div className="row">
          <button type="submit">Save alert</button>
          {editing ? (
            <button type="button" onClick={onCancelEdit}>
              Cancel edit
            </button>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}
