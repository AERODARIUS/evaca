import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [condition, setCondition] = useState<'gte' | 'lte'>('gte');
  const [frequencyMinutes, setFrequencyMinutes] = useState<number>(5);
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
      setTargetPrice(null);
      setCondition('gte');
      setFrequencyMinutes(5);
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
    setTargetPrice(editing.targetPrice);
    setCondition(editing.condition);
    setFrequencyMinutes(editing.intervalMinutes);
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

  const onSelect = async (instrumentIdAsText: string) => {
    const selected = options.find((item) => String(item.instrumentId) === instrumentIdAsText);
    if (!selected) {
      return;
    }

    setInstrument(selected);
    setSearchFeedback(null);
    setSearchFeedbackType(null);
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

    if (!instrument) {
      setError('Please select an asset before saving.');
      return;
    }

    if (targetPrice === null || Number.isNaN(targetPrice)) {
      setError('Please provide a valid target price.');
      return;
    }

    const payload = {
      instrumentId: instrument.instrumentId,
      symbol: instrument.symbol,
      displayName: alertName.trim() || instrument.displayName,
      targetPrice,
      condition,
      intervalMinutes: frequencyMinutes,
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
    setTargetPrice(null);
    setCondition('gte');
    setFrequencyMinutes(5);
    setNotificationChannels(['inApp']);
    setIsEnabled(true);
    setCurrentPrice(null);
    await onSaved();
  };

  return (
    <PageSection
      title={editing ? 'Edit alert' : 'New alert'}
      subtitle="Track an asset, define a trigger, and keep notifications under control."
    >
      <Card className="card-surface">
        <Form layout="vertical" onSubmitCapture={onSubmit}>
          <Form.Item label="Alert name" required>
            <Input
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              placeholder="BTC breakout alert"
              maxLength={80}
            />
          </Form.Item>

          <Form.Item label="Asset selector (symbol/search)" required>
            <FormRow>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (searchFeedback) {
                    setSearchFeedback(null);
                    setSearchFeedbackType(null);
                  }
                }}
                placeholder="AAPL, BTC, TSLA"
              />
              <Button type="default" onClick={search} loading={isSearching}>
                Search
              </Button>
            </FormRow>
            <FieldHint>Search and then pick a single instrument from the result list.</FieldHint>
          </Form.Item>

          {searchOptions.length > 0 ? (
            <Form.Item label="Search results">
              <Select
                placeholder="Select an asset"
                options={searchOptions}
                value={instrument ? String(instrument.instrumentId) : undefined}
                onChange={(value) => {
                  void onSelect(value);
                }}
              />
            </Form.Item>
          ) : null}

          {searchFeedback ? (
            <Alert
              type={searchFeedbackType === 'error' ? 'error' : 'info'}
              showIcon
              message={searchFeedback}
              className="form-alert"
            />
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

          <Form.Item label="Condition" required>
            <Select
              value={condition}
              options={[
                { value: 'gte', label: 'Above' },
                { value: 'lte', label: 'Below' },
              ]}
              onChange={(value) => setCondition(value)}
            />
          </Form.Item>

          <Form.Item label="Target price" required>
            <InputNumber
              value={targetPrice}
              onChange={(value) => setTargetPrice(typeof value === 'number' ? value : null)}
              min={0.0001}
              step={0.0001}
              controls
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="Check interval (minutes)" required>
            <InputNumber
              value={frequencyMinutes}
              onChange={(value) => setFrequencyMinutes(typeof value === 'number' ? value : 5)}
              min={1}
              max={1440}
              style={{ width: '100%' }}
            />
          </Form.Item>

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
              <FieldHint>Delivery setup is wired in later tasks; this UI captures selection.</FieldHint>
            </div>
          </Form.Item>

          <Form.Item label="Enabled status" valuePropName="checked">
            <Switch checked={isEnabled} onChange={setIsEnabled} checkedChildren="Enabled" unCheckedChildren="Paused" />
          </Form.Item>

          <ActionBar>
            <Button htmlType="submit" type="primary">
              Save alert
            </Button>
            {editing ? (
              <Button type="default" onClick={onCancelEdit}>
                Cancel edit
              </Button>
            ) : null}
          </ActionBar>

          {error ? <Alert type="error" showIcon message={error} /> : null}
        </Form>
      </Card>
    </PageSection>
  );
}
