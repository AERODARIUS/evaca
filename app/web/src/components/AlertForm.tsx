import { FormEvent, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertRow, InstrumentOption } from '../types';

interface Props {
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

type NotificationChannel = 'inApp' | 'email' | 'push';

export function AlertForm({ editing, onSaved, onCancelEdit }: Props) {
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

  useEffect(() => {
    if (!editing) {
      setAlertName('');
      setIsEnabled(true);
      setNotificationChannels(['inApp']);
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
    setFrequencyMinutes(String(editing.frequencyMinutes));
    setCurrentPrice(editing.lastSeenPrice ?? editing.creationPrice);
    setQuery(editing.symbol);
    setIsEnabled(editing.status === 'active');
    setNotificationChannels(['inApp']);
  }, [editing]);

  const search = async () => {
    if (!query.trim()) return;
    const fn = httpsCallable(functions, 'searchEtoroInstruments');
    const result = await fn({ searchText: query });
    const data = result.data as { items: InstrumentOption[] };
    setOptions(data.items);
  };

  const loadRate = async (instrumentId: number) => {
    const fn = httpsCallable(functions, 'getEtoroInstrumentRate');
    const result = await fn({ instrumentId });
    const data = result.data as { rate: number };
    setCurrentPrice(data.rate);
  };

  const onSelect = async (item: InstrumentOption) => {
    setInstrument(item);
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
    if (!instrument) return;

    const payload = {
      instrumentId: instrument.instrumentId,
      symbol: instrument.symbol,
      displayName: instrument.displayName,
      targetPrice: Number(targetPrice),
      condition,
      frequencyMinutes: Number(frequencyMinutes),
    };

    if (editing) {
      const fn = httpsCallable(functions, 'updateAlert');
      await fn({ ...payload, id: editing.id });
      onCancelEdit();
    } else {
      const fn = httpsCallable(functions, 'createAlert');
      await fn(payload);
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="AAPL, BTC, TSLA"
              required
            />
            <button type="button" onClick={search}>
              Search
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

        {instrument ? <p>Selected: {instrument.symbol}</p> : null}
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
      </form>
    </section>
  );
}
