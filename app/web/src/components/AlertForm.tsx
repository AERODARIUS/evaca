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

interface Props {
  userId: string;
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

type NotificationChannel = 'inApp' | 'email' | 'push';
type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

interface CallableErrorLike {
  code?: string;
  message?: string;
}

interface ValidationErrors {
  alertName?: string;
  instrument?: string;
  targetPrice?: string;
  interval?: string;
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

function validateForm(
  alertName: string,
  instrument: InstrumentOption | null,
  targetPrice: number | null,
  frequencyMinutes: number,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!alertName.trim()) {
    errors.alertName = 'Alert name is required so you can identify this trigger later.';
  }

  if (!instrument) {
    errors.instrument = 'Select one asset from the search results before saving.';
  }

  if (targetPrice === null || Number.isNaN(targetPrice) || targetPrice <= 0) {
    errors.targetPrice = 'Target price must be a positive number.';
  }

  if (frequencyMinutes < 1 || frequencyMinutes > 1440) {
    errors.interval = 'Check interval must be between 1 and 1440 minutes.';
  }

  return errors;
}

export function AlertForm({ userId, editing, onSaved, onCancelEdit }: Props) {
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
  const [searchFeedback, setSearchFeedback] = useState<string>('Search by ticker symbol or asset name.');
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
      setSearchFeedback('Search by ticker symbol or asset name.');
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
    setSearchFeedback('Search by ticker symbol or asset name.');
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
    setSearchState('loading');
    setSearchFeedback('Searching market data...');
    setIsSearching(true);

    try {
      const fn = httpsCallable(functions, 'searchEtoroInstruments');
      const result = await fn({ searchText });
      const data = result.data as { items: InstrumentOption[] };
      setOptions(data.items);
      if (data.items.length === 0) {
        setSearchState('empty');
        setSearchFeedback(`No assets found for "${searchText}". Try a ticker like XRP, BTC, or TSLA.`);
      } else {
        setSearchState('results');
        setSearchFeedback(`Found ${data.items.length} result(s). Select one asset to continue.`);
      }
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

    const nextValidationErrors = validateForm(alertName, instrument, targetPrice, frequencyMinutes);
    setValidationErrors(nextValidationErrors);

    if (Object.keys(nextValidationErrors).length > 0 || !instrument || targetPrice === null) {
      setError('Please correct the highlighted fields and submit again.');
      return;
    }

    const payload = {
      instrumentId: instrument.instrumentId,
      symbol: instrument.symbol,
      displayName: alertName.trim(),
      targetPrice,
      condition,
      intervalMinutes: frequencyMinutes,
      isActive: isEnabled,
    };

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
    setSearchFeedback('Search by ticker symbol or asset name.');
    setSuccessMessage(editing ? 'Alert updated successfully.' : 'Alert created successfully.');
    setIsSubmitting(false);
    await onSaved();
  };

  const toggleCondition = () => {
    setCondition((current) => (current === 'gte' ? 'lte' : 'gte'));
  };

  const onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void search();
    }
  };

  const searchStatusTone = searchState === 'error' ? 'error' : searchState === 'results' ? 'success' : 'info';

  return (
    <PageSection
      title={editing ? 'Edit alert' : 'New alert'}
      subtitle="Create a precise rule using clear sections: Asset, Trigger, Notifications, and Status."
    >
      <Card className="card-surface">
        <Form layout="vertical" onSubmitCapture={onSubmit}>
          <Typography.Title level={4}>Asset</Typography.Title>

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

          <Alert className="form-alert" type={searchStatusTone} showIcon message={searchFeedback} />

          {searchState === 'loading' ? (
            <Space>
              <Spin size="small" />
              <Typography.Text>Loading results...</Typography.Text>
            </Space>
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

          <Typography.Title level={4}>Trigger</Typography.Title>

          <Form.Item label="Condition" required>
            <Button
              type="default"
              className={`condition-toggle condition-toggle-${condition}`}
              onClick={toggleCondition}
              icon={condition === 'gte' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              disabled={isSubmitting}
            >
              {condition === 'gte' ? 'Above' : 'Below'}
            </Button>
            <div>
              <FieldHint>
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
            />
            <div>
              <FieldHint>Use lower intervals for volatile assets and higher intervals for long-term positions.</FieldHint>
            </div>
          </Form.Item>

          <Typography.Title level={4}>Notifications</Typography.Title>

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

          <Typography.Title level={4}>Status</Typography.Title>

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

          {successMessage ? <Alert type="success" showIcon message={successMessage} /> : null}
          {error ? <Alert type="error" showIcon message={error} /> : null}
        </Form>
      </Card>
    </PageSection>
  );
}
