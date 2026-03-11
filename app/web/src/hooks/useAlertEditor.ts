import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { AlertRow, InstrumentOption } from '../types';
import { createAlert, updateAlert } from '../lib/alerts';
import {
  buildAlertPayload,
  getSearchErrorMessage,
  searchIdleFeedback,
  searchLoadingFeedback,
  searchResultsFeedback,
  SearchState,
  toggleCondition,
  ValidationErrors,
  validateAlertDraft,
} from '../lib/alertFormLogic';
import { MarketDataClient, marketDataClient } from '../lib/marketDataClient';

export type NotificationChannel = 'inApp' | 'email' | 'push';

export interface UseAlertEditorInput {
  userId: string;
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
  marketData?: MarketDataClient;
}

export interface EditorState {
  alertName: string;
  query: string;
  instrument: InstrumentOption | null;
  options: InstrumentOption[];
  targetPrice: number | null;
  condition: 'gte' | 'lte';
  frequencyMinutes: number;
  notificationChannels: NotificationChannel[];
  isEnabled: boolean;
  currentPrice: number | null;
  error: string | null;
  successMessage: string | null;
  searchFeedback: string;
  searchState: SearchState;
  isSearching: boolean;
  isLoadingPrice: boolean;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

export function buildInitialEditorState(editing: AlertRow | null): EditorState {
  if (!editing) {
    return {
      alertName: '',
      query: '',
      instrument: null,
      options: [],
      targetPrice: null,
      condition: 'gte',
      frequencyMinutes: 5,
      notificationChannels: ['inApp'],
      isEnabled: true,
      currentPrice: null,
      error: null,
      successMessage: null,
      searchFeedback: searchIdleFeedback().message,
      searchState: 'idle',
      isSearching: false,
      isLoadingPrice: false,
      isSubmitting: false,
      validationErrors: {},
    };
  }

  return {
    alertName: editing.displayName,
    query: editing.symbol,
    instrument: {
      instrumentId: editing.instrumentId,
      symbol: editing.symbol,
      displayName: editing.displayName,
    },
    options: [],
    targetPrice: editing.targetPrice,
    condition: editing.condition,
    frequencyMinutes: editing.intervalMinutes,
    notificationChannels: ['inApp'],
    isEnabled: editing.isActive,
    currentPrice: null,
    error: null,
    successMessage: null,
    searchFeedback: searchIdleFeedback().message,
    searchState: 'idle',
    isSearching: false,
    isLoadingPrice: false,
    isSubmitting: false,
    validationErrors: {},
  };
}

export async function submitEditorDraft(input: {
  editing: AlertRow | null;
  userId: string;
  state: EditorState;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}): Promise<{ successMessage: string } | { error: string }> {
  const nextValidationErrors = validateAlertDraft(
    input.state.alertName,
    input.state.instrument,
    input.state.targetPrice,
    input.state.frequencyMinutes,
  );

  if (Object.keys(nextValidationErrors).length > 0) {
    return { error: 'Please correct the highlighted fields and submit again.' };
  }

  const { payload } = buildAlertPayload({
    alertName: input.state.alertName,
    instrument: input.state.instrument,
    targetPrice: input.state.targetPrice,
    condition: input.state.condition,
    intervalMinutes: input.state.frequencyMinutes,
    isActive: input.state.isEnabled,
  });

  if (!payload) {
    return { error: 'Please correct the highlighted fields and submit again.' };
  }

  try {
    if (input.editing) {
      await updateAlert(input.editing.id, payload);
      input.onCancelEdit();
    } else {
      await createAlert(input.userId, payload);
    }
  } catch (submitError) {
    const message = submitError instanceof Error ? submitError.message : 'Unable to save alert right now.';
    return { error: `Save failed: ${message}` };
  }

  await input.onSaved();

  return {
    successMessage: input.editing ? 'Alert updated successfully.' : 'Alert created successfully.',
  };
}

export function useAlertEditor({
  userId,
  editing,
  onSaved,
  onCancelEdit,
  marketData = marketDataClient,
}: UseAlertEditorInput) {
  const [state, setState] = useState<EditorState>(() => buildInitialEditorState(editing));

  useEffect(() => {
    setState(buildInitialEditorState(editing));
  }, [editing]);

  const searchOptions = useMemo(
    () =>
      state.options.map((item) => ({
        value: String(item.instrumentId),
        label: `${item.symbol} - ${item.displayName}`,
      })),
    [state.options],
  );

  const setAlertName = (value: string) => {
    setState((current) => ({
      ...current,
      alertName: value,
      validationErrors: current.validationErrors.alertName ? { ...current.validationErrors, alertName: undefined } : current.validationErrors,
    }));
  };

  const setQuery = (value: string) => {
    setState((current) => ({ ...current, query: value }));
  };

  const setTargetPrice = (value: number | null) => {
    setState((current) => ({
      ...current,
      targetPrice: value,
      validationErrors: current.validationErrors.targetPrice ? { ...current.validationErrors, targetPrice: undefined } : current.validationErrors,
    }));
  };

  const setFrequencyMinutes = (value: number) => {
    setState((current) => ({
      ...current,
      frequencyMinutes: value,
      validationErrors: current.validationErrors.interval ? { ...current.validationErrors, interval: undefined } : current.validationErrors,
    }));
  };

  const setIsEnabled = (value: boolean) => {
    setState((current) => ({ ...current, isEnabled: value }));
  };

  const onToggleChannel = (channel: NotificationChannel, checked: boolean) => {
    setState((current) => {
      if (!checked) {
        const next = current.notificationChannels.filter((item) => item !== channel);
        return { ...current, notificationChannels: next.length > 0 ? next : ['inApp'] };
      }

      if (current.notificationChannels.includes(channel)) {
        return current;
      }

      return { ...current, notificationChannels: [...current.notificationChannels, channel] };
    });
  };

  const onToggleCondition = () => {
    setState((current) => ({ ...current, condition: toggleCondition(current.condition) }));
  };

  const search = async () => {
    const searchText = state.query.trim();
    if (!searchText) {
      setState((current) => ({
        ...current,
        options: [],
        searchState: 'error',
        searchFeedback: 'Enter a symbol or asset name before searching.',
      }));
      return;
    }

    const loadingFeedback = searchLoadingFeedback();
    setState((current) => ({
      ...current,
      error: null,
      successMessage: null,
      searchState: loadingFeedback.state,
      searchFeedback: loadingFeedback.message,
      isSearching: true,
    }));

    try {
      const items = await marketData.searchInstruments(searchText);
      const feedback = searchResultsFeedback(searchText, items.length);
      setState((current) => ({
        ...current,
        options: items,
        searchState: feedback.state,
        searchFeedback: feedback.message,
      }));
    } catch (searchError) {
      setState((current) => ({
        ...current,
        options: [],
        searchState: 'error',
        searchFeedback: getSearchErrorMessage(searchError, searchText),
      }));
    } finally {
      setState((current) => ({ ...current, isSearching: false }));
    }
  };

  const loadRate = async (instrumentId: number) => {
    setState((current) => ({ ...current, error: null, isLoadingPrice: true }));

    try {
      const rate = await marketData.getInstrumentRate(instrumentId);
      setState((current) => ({ ...current, currentPrice: rate }));
    } catch (rateError) {
      const message = rateError instanceof Error ? rateError.message : 'Unable to load instrument rate right now.';
      setState((current) => ({ ...current, error: message, currentPrice: null }));
    } finally {
      setState((current) => ({ ...current, isLoadingPrice: false }));
    }
  };

  const onSelectInstrument = async (instrumentIdAsText: string) => {
    const selected = state.options.find((item) => String(item.instrumentId) === instrumentIdAsText);
    if (!selected) {
      return;
    }

    setState((current) => ({
      ...current,
      instrument: selected,
      validationErrors: current.validationErrors.instrument
        ? { ...current.validationErrors, instrument: undefined }
        : current.validationErrors,
    }));
    await loadRate(selected.instrumentId);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nextValidationErrors = validateAlertDraft(
      state.alertName,
      state.instrument,
      state.targetPrice,
      state.frequencyMinutes,
    );
    setState((current) => ({ ...current, error: null, successMessage: null, validationErrors: nextValidationErrors }));

    if (Object.keys(nextValidationErrors).length > 0) {
      setState((current) => ({
        ...current,
        error: 'Please correct the highlighted fields and submit again.',
      }));
      return;
    }

    setState((current) => ({ ...current, isSubmitting: true }));
    const submitResult = await submitEditorDraft({
      editing,
      userId,
      state,
      onSaved,
      onCancelEdit,
    });

    if ('error' in submitResult) {
      setState((current) => ({ ...current, error: submitResult.error, isSubmitting: false }));
      return;
    }

    const resetState = buildInitialEditorState(null);
    setState({
      ...resetState,
      successMessage: submitResult.successMessage,
    });
  };

  const onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void search();
    }
  };

  return {
    state,
    searchOptions,
    setAlertName,
    setQuery,
    setTargetPrice,
    setFrequencyMinutes,
    setIsEnabled,
    onToggleChannel,
    onToggleCondition,
    onSelectInstrument,
    onSubmit,
    onQueryKeyDown,
    search,
  };
}
