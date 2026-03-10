import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertRow, InstrumentOption } from '../types';
import { createAlert, updateAlert } from '../lib/alerts';
import { ActionBar, FieldHint, FormRow, PageSection } from './primitives';
import {
  buildAlertPayload,
  getConditionPresentation,
  getSearchErrorMessage,
  searchIdleFeedback,
  searchLoadingFeedback,
  searchResultsFeedback,
  SearchState,
  toggleCondition,
  ValidationErrors,
  validateAlertDraft,
} from '../lib/alertFormLogic';

interface Props {
  userId: string;
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

type NotificationChannel = 'inApp' | 'email' | 'push';
export function AlertForm({ userId, editing, onSaved, onCancelEdit }: Props) {
  const conditionHintId = 'condition-toggle-hint';
  const intervalHintId = 'interval-hint';
  const submitStatusId = 'alert-submit-status';
  const [alertName, setAlertName] = useState('');
  const [query, setQuery] = useState('');
  const [instrument, setInstrument] = useState<InstrumentOption | null>(null);
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [condition, setCondition] = useState<'gte' | 'lte'>('gte');
  const [frequencyMinutes, setFrequencyMinutes] = useState<number>(5);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(['inApp']);
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string>(searchIdleFeedback().message);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (!editing) {
      setAlertName('');
      setQuery('');
      setInstrument(null);
      setOptions([]);
      setTargetPrice(null);
      setCondition('gte');
      setFrequencyMinutes(5);
      setCurrentPrice(null);
      setIsEnabled(true);
      setNotificationChannels(['inApp']);
      setError(null);
      setSuccessMessage(null);
      setSearchFeedback(searchIdleFeedback().message);
      setSearchState('idle');
      setIsSearching(false);
      setIsLoadingPrice(false);
      setIsSubmitting(false);
      setValidationErrors({});
      return;
    }

    setInstrument({
      instrumentId: editing.instrumentId,
      symbol: editing.symbol,
      displayName: editing.displayName,
    });
    setAlertName(editing.displayName);
    setTargetPrice(editing.targetPrice);
    setCondition(editing.condition);
    setFrequencyMinutes(editing.intervalMinutes);
    setCurrentPrice(null);
    setQuery(editing.symbol);
    setIsEnabled(editing.isActive);
    setNotificationChannels(['inApp']);
    setError(null);
    setSuccessMessage(null);
    setSearchFeedback(searchIdleFeedback().message);
    setSearchState('idle');
    setIsSearching(false);
    setIsLoadingPrice(false);
    setIsSubmitting(false);
    setValidationErrors({});
  }, [editing]);

  const searchOptions = useMemo(
    () =>
      options.map((item) => ({
        value: String(item.instrumentId),
        label: `${item.symbol} - ${item.displayName}`,
      })),
    [options],
  );

  const search = async () => {
    const searchText = query.trim();
    if (!searchText) {
      setOptions([]);
      setSearchState('error');
      setSearchFeedback('Enter a symbol or asset name before searching.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    const loadingFeedback = searchLoadingFeedback();
    setSearchState(loadingFeedback.state);
    setSearchFeedback(loadingFeedback.message);
    setIsSearching(true);

    try {
      const fn = httpsCallable(functions, 'searchEtoroInstruments');
      const result = await fn({ searchText });
      const data = result.data as { items: InstrumentOption[] };
      setOptions(data.items);
      const resultsFeedback = searchResultsFeedback(searchText, data.items.length);
      setSearchState(resultsFeedback.state);
      setSearchFeedback(resultsFeedback.message);
    } catch (searchError) {
      setSearchState('error');
      setSearchFeedback(getSearchErrorMessage(searchError, searchText));
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

  const onSelect = async (instrumentIdAsText: string) => {
    const selected = options.find((item) => String(item.instrumentId) === instrumentIdAsText);
    if (!selected) {
      return;
    }

    setInstrument(selected);
    setValidationErrors((current) => ({ ...current, instrument: undefined }));
    await loadRate(selected.instrumentId);
  };

  const onToggleChannel = (channel: NotificationChannel, checked: boolean) => {
    setNotificationChannels((current) => {
      if (!checked) {
        const next = current.filter((item) => item !== channel);
        return next.length > 0 ? next : ['inApp'];
      }

      if (current.includes(channel)) {
        return current;
      }

      return [...current, channel];
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const nextValidationErrors = validateAlertDraft(alertName, instrument, targetPrice, frequencyMinutes);
    setValidationErrors(nextValidationErrors);

    const { payload } = buildAlertPayload({
      alertName,
      instrument,
      targetPrice,
      condition,
      intervalMinutes: frequencyMinutes,
      isActive: isEnabled,
    });

    if (!payload) {
      setError('Please correct the highlighted fields and submit again.');
      return;
    }

    setIsSubmitting(true);

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
      setError(`Save failed: ${message}`);
      setIsSubmitting(false);
      return;
    }

    setAlertName('');
    setQuery('');
    setInstrument(null);
    setOptions([]);
    setTargetPrice(null);
    setCondition('gte');
    setFrequencyMinutes(5);
    setNotificationChannels(['inApp']);
    setIsEnabled(true);
    setCurrentPrice(null);
    setValidationErrors({});
    setSearchState('idle');
    setSearchFeedback(searchIdleFeedback().message);
    setSuccessMessage(editing ? 'Alert updated successfully.' : 'Alert created successfully.');
    setIsSubmitting(false);
    await onSaved();
  };

  const onToggleCondition = () => {
    setCondition((current) => toggleCondition(current));
  };

  const onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void search();
    }
  };

  const searchStatusTone = searchState === 'error' ? 'error' : searchState === 'results' ? 'success' : 'info';
  const conditionPresentation = getConditionPresentation(condition);

  return (
    <PageSection
      title={editing ? 'Edit alert' : 'New alert'}
      subtitle="Create a precise rule using clear sections: Asset, Trigger, Notifications, and Status."
    >
      <Card className="card-surface">
        <Form layout="vertical" onSubmitCapture={onSubmit}>
          <Typography.Title level={4} id="asset-section-title">Asset</Typography.Title>

          <Form.Item label="Alert name" required validateStatus={validationErrors.alertName ? 'error' : ''} help={validationErrors.alertName}>
            <Input
              value={alertName}
              onChange={(e) => {
                setAlertName(e.target.value);
                if (validationErrors.alertName) {
                  setValidationErrors((current) => ({ ...current, alertName: undefined }));
                }
              }}
              placeholder="Example: BTC breakout above 70k"
              maxLength={80}
            />
          </Form.Item>

          <Form.Item
            label="Search asset"
            required
            validateStatus={validationErrors.instrument ? 'error' : ''}
            help={validationErrors.instrument}
          >
            <FormRow>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onQueryKeyDown}
                placeholder="Ticker or name (AAPL, BTC, Tesla)"
              />
              <Button type="default" onClick={search} loading={isSearching}>
                Search
              </Button>
            </FormRow>
          </Form.Item>

          <Alert
            className="form-alert"
            type={searchStatusTone}
            showIcon
            message={searchFeedback}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          />

          {searchState === 'loading' ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : null}

          {searchState === 'results' ? (
            <Form.Item label="Select one asset" required>
              <Select
                placeholder="Choose an asset from results"
                options={searchOptions}
                value={instrument ? String(instrument.instrumentId) : undefined}
                onChange={(value) => {
                  void onSelect(value);
                }}
              />
            </Form.Item>
          ) : null}

          {instrument ? (
            <Typography.Text>
              Selected: <strong>{instrument.symbol}</strong>
            </Typography.Text>
          ) : null}

          {isLoadingPrice ? (
            <Space>
              <Spin size="small" />
              <Typography.Text>Loading current price...</Typography.Text>
            </Space>
          ) : null}

          {currentPrice !== null ? <Typography.Text>Current price: {currentPrice}</Typography.Text> : null}

          <Typography.Title level={4} id="trigger-section-title">Trigger</Typography.Title>

          <Form.Item label="Condition" required>
            <Button
              type="default"
              className={`condition-toggle condition-toggle-${condition}`}
              onClick={onToggleCondition}
              icon={conditionPresentation.icon === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              disabled={isSubmitting}
              aria-pressed={condition === 'gte'}
              aria-describedby={conditionHintId}
            >
              {conditionPresentation.label}
            </Button>
            <div>
              <FieldHint id={conditionHintId}>
                Press Enter, Space, or click to switch between Above and Below.
              </FieldHint>
            </div>
          </Form.Item>

          <Form.Item
            label="Target price"
            required
            validateStatus={validationErrors.targetPrice ? 'error' : ''}
            help={validationErrors.targetPrice}
          >
            <InputNumber
              value={targetPrice ?? undefined}
              onChange={(value) => {
                setTargetPrice(typeof value === 'number' ? value : null);
                if (validationErrors.targetPrice) {
                  setValidationErrors((current) => ({ ...current, targetPrice: undefined }));
                }
              }}
              min={0.0001}
              step={0.0001}
              controls
              style={{ width: '100%' }}
              placeholder="100.25"
            />
          </Form.Item>

          <Form.Item
            label="Check interval (minutes)"
            required
            validateStatus={validationErrors.interval ? 'error' : ''}
            help={validationErrors.interval}
          >
            <InputNumber
              value={frequencyMinutes}
              onChange={(value) => {
                setFrequencyMinutes(typeof value === 'number' ? value : 5);
                if (validationErrors.interval) {
                  setValidationErrors((current) => ({ ...current, interval: undefined }));
                }
              }}
              min={1}
              max={1440}
              style={{ width: '100%' }}
              aria-describedby={intervalHintId}
            />
            <div>
              <FieldHint id={intervalHintId}>Use lower intervals for volatile assets and higher intervals for long-term positions.</FieldHint>
            </div>
          </Form.Item>

          <Typography.Title level={4} id="notifications-section-title">Notifications</Typography.Title>

          <Form.Item label="Notification channel(s)">
            <Space size={16} wrap>
              <Checkbox
                checked={notificationChannels.includes('inApp')}
                onChange={(event) => onToggleChannel('inApp', event.target.checked)}
              >
                In-app
              </Checkbox>
              <Checkbox
                checked={notificationChannels.includes('email')}
                onChange={(event) => onToggleChannel('email', event.target.checked)}
              >
                Email
              </Checkbox>
              <Checkbox
                checked={notificationChannels.includes('push')}
                onChange={(event) => onToggleChannel('push', event.target.checked)}
              >
                Push
              </Checkbox>
            </Space>
            <div>
              <FieldHint>At least one channel is always kept active to avoid silent alerts.</FieldHint>
            </div>
          </Form.Item>

          <Typography.Title level={4} id="status-section-title">Status</Typography.Title>

          <Form.Item label="Enabled status" valuePropName="checked">
            <Switch checked={isEnabled} onChange={setIsEnabled} checkedChildren="Enabled" unCheckedChildren="Paused" />
          </Form.Item>

          <ActionBar>
            <Button htmlType="submit" type="primary" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Create alert'}
            </Button>
            {editing ? (
              <Button type="default" onClick={onCancelEdit}>
                Cancel edit
              </Button>
            ) : null}
          </ActionBar>

          <div id={submitStatusId} aria-live="polite" aria-atomic="true">
            {successMessage ? <Alert type="success" showIcon message={successMessage} role="status" /> : null}
            {error ? <Alert type="error" showIcon message={error} role="alert" /> : null}
          </div>
        </Form>
      </Card>
    </PageSection>
  );
}
