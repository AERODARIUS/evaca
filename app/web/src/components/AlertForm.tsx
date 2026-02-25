import { FormEvent, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertRow, InstrumentOption } from '../types';

interface Props {
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

export function AlertForm({ editing, onSaved, onCancelEdit }: Props) {
  const [query, setQuery] = useState('');
  const [instrument, setInstrument] = useState<InstrumentOption | null>(null);
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'gte' | 'lte'>('gte');
  const [frequencyMinutes, setFrequencyMinutes] = useState('5');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!editing) return;
    setInstrument({
      instrumentId: editing.instrumentId,
      symbol: editing.symbol,
      displayName: editing.displayName,
    });
    setTargetPrice(String(editing.targetPrice));
    setCondition(editing.condition);
    setFrequencyMinutes(String(editing.frequencyMinutes));
    setCurrentPrice(editing.lastSeenPrice ?? editing.creationPrice);
    setQuery(editing.symbol);
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

    setQuery('');
    setInstrument(null);
    setOptions([]);
    setTargetPrice('');
    setCondition('gte');
    setFrequencyMinutes('5');
    setCurrentPrice(null);
    await onSaved();
  };

  return (
    <section className="card">
      <h2>{editing ? 'Editar alerta' : 'Nueva alerta'}</h2>
      <form onSubmit={onSubmit}>
        <label>
          Nombre del activo
          <div className="row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} required />
            <button type="button" onClick={search}>
              Buscar
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

        {instrument ? <p>Seleccionado: {instrument.symbol}</p> : null}
        {currentPrice !== null ? <p>Precio actual: {currentPrice}</p> : null}

        <label>
          Precio objetivo
          <input
            type="number"
            step="0.0001"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            required
          />
        </label>

        <label>
          Condición
          <select value={condition} onChange={(e) => setCondition(e.target.value as 'gte' | 'lte')}>
            <option value="gte">Mayor o igual</option>
            <option value="lte">Menor o igual</option>
          </select>
        </label>

        <label>
          Frecuencia de chequeo (min)
          <input
            type="number"
            min={1}
            max={1440}
            value={frequencyMinutes}
            onChange={(e) => setFrequencyMinutes(e.target.value)}
            required
          />
        </label>

        <div className="row">
          <button type="submit">Guardar alerta</button>
          {editing ? (
            <button type="button" onClick={onCancelEdit}>
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
