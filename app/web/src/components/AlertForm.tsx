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
import { AlertRow } from '../types';
import { ActionBar, FieldHint, FormRow, PageSection } from './primitives';
import { getConditionPresentation } from '../lib/alertFormLogic';
import { useAlertEditor } from '../hooks/useAlertEditor';

interface Props {
  userId: string;
  editing: AlertRow | null;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
}

export function AlertForm({ userId, editing, onSaved, onCancelEdit }: Props) {
  const conditionHintId = 'condition-toggle-hint';
  const intervalHintId = 'interval-hint';
  const submitStatusId = 'alert-submit-status';

  const {
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
  } = useAlertEditor({
    userId,
    editing,
    onSaved,
    onCancelEdit,
  });

  const searchStatusTone = state.searchState === 'error' ? 'error' : state.searchState === 'results' ? 'success' : 'info';
  const conditionPresentation = getConditionPresentation(state.condition);

  return (
    <PageSection
      title={editing ? 'Edit alert' : 'New alert'}
      subtitle="Create a precise rule using clear sections: Asset, Trigger, Notifications, and Status."
    >
      <Card className="card-surface">
        <Form layout="vertical" onSubmitCapture={onSubmit}>
          <Typography.Title level={4} id="asset-section-title">Asset</Typography.Title>

          <Form.Item
            label="Alert name"
            required
            validateStatus={state.validationErrors.alertName ? 'error' : ''}
            help={state.validationErrors.alertName}
          >
            <Input
              value={state.alertName}
              onChange={(e) => setAlertName(e.target.value)}
              placeholder="Example: BTC breakout above 70k"
              maxLength={80}
            />
          </Form.Item>

          <Form.Item
            label="Search asset"
            required
            validateStatus={state.validationErrors.instrument ? 'error' : ''}
            help={state.validationErrors.instrument}
          >
            <FormRow>
              <Input
                value={state.query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onQueryKeyDown}
                placeholder="Ticker or name (AAPL, BTC, Tesla)"
              />
              <Button type="default" onClick={search} loading={state.isSearching}>
                Search
              </Button>
            </FormRow>
          </Form.Item>

          <Alert
            className="form-alert"
            type={searchStatusTone}
            showIcon
            message={state.searchFeedback}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          />

          {state.searchState === 'loading' ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : null}

          {state.searchState === 'results' ? (
            <Form.Item label="Select one asset" required>
              <Select
                placeholder="Choose an asset from results"
                options={searchOptions}
                value={state.instrument ? String(state.instrument.instrumentId) : undefined}
                onChange={(value) => {
                  void onSelectInstrument(value);
                }}
              />
            </Form.Item>
          ) : null}

          {state.instrument ? (
            <Typography.Text>
              Selected: <strong>{state.instrument.symbol}</strong>
            </Typography.Text>
          ) : null}

          {state.isLoadingPrice ? (
            <Space>
              <Spin size="small" />
              <Typography.Text>Loading current price...</Typography.Text>
            </Space>
          ) : null}

          {state.currentPrice !== null ? <Typography.Text>Current price: {state.currentPrice}</Typography.Text> : null}

          <Typography.Title level={4} id="trigger-section-title">Trigger</Typography.Title>

          <Form.Item label="Condition" required>
            <Button
              type="default"
              className={`condition-toggle condition-toggle-${state.condition}`}
              onClick={onToggleCondition}
              icon={conditionPresentation.icon === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              disabled={state.isSubmitting}
              aria-pressed={state.condition === 'gte'}
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
            validateStatus={state.validationErrors.targetPrice ? 'error' : ''}
            help={state.validationErrors.targetPrice}
          >
            <InputNumber
              value={state.targetPrice ?? undefined}
              onChange={(value) => setTargetPrice(typeof value === 'number' ? value : null)}
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
            validateStatus={state.validationErrors.interval ? 'error' : ''}
            help={state.validationErrors.interval}
          >
            <InputNumber
              value={state.frequencyMinutes}
              onChange={(value) => setFrequencyMinutes(typeof value === 'number' ? value : 5)}
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
                checked={state.notificationChannels.includes('inApp')}
                onChange={(event) => onToggleChannel('inApp', event.target.checked)}
              >
                In-app
              </Checkbox>
              <Checkbox
                checked={state.notificationChannels.includes('email')}
                onChange={(event) => onToggleChannel('email', event.target.checked)}
              >
                Email
              </Checkbox>
              <Checkbox
                checked={state.notificationChannels.includes('push')}
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
            <Switch checked={state.isEnabled} onChange={setIsEnabled} checkedChildren="Enabled" unCheckedChildren="Paused" />
          </Form.Item>

          <ActionBar>
            <Button htmlType="submit" type="primary" loading={state.isSubmitting}>
              {editing ? 'Save changes' : 'Create alert'}
            </Button>
            {editing ? (
              <Button type="default" onClick={onCancelEdit}>
                Cancel edit
              </Button>
            ) : null}
          </ActionBar>

          <div id={submitStatusId} aria-live="polite" aria-atomic="true">
            {state.successMessage ? <Alert type="success" showIcon message={state.successMessage} role="status" /> : null}
            {state.error ? <Alert type="error" showIcon message={state.error} role="alert" /> : null}
          </div>
        </Form>
      </Card>
    </PageSection>
  );
}
