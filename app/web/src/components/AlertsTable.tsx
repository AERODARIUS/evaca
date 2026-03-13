import { AlertRow } from '../types';
import { deleteAlert, toggleAlertActive } from '../lib/alerts';
import { useState } from 'react';
import { Alert, Button, Card, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { warnLog } from '../lib/logger';

interface Props {
  alerts: AlertRow[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (alert: AlertRow) => void;
  onUpdated: () => Promise<void>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  hasLoadError: boolean;
}

export function AlertsTable({
  alerts,
  expandedId,
  onExpand,
  onEdit,
  onUpdated,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  hasLoadError,
}: Props) {
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  const runMutation = async (action: () => Promise<void>) => {
    setIsMutating(true);
    setMutationError(null);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      warnLog('alerts', 'Alert mutation failed', error);
      setMutationError(`Operation failed: ${message}.`);
    } finally {
      setIsMutating(false);
    }
  };

  const onDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this alert?');
    if (!confirmed) {
      return;
    }

    const action = async () => {
      await deleteAlert(id);
      await onUpdated();
    };
    setRetryAction(() => action);
    await runMutation(action);
  };

  const onToggleStatus = async (alert: AlertRow) => {
    const action = async () => {
      await toggleAlertActive(alert.id, !alert.isActive);
      await onUpdated();
    };
    setRetryAction(() => action);
    await runMutation(action);
  };

  if (isLoading) {
    return (
      <Card className="card-surface">
        <Skeleton active paragraph={{ rows: 5 }} title={{ width: '35%' }} />
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="card-surface">
        <Empty description="No alerts yet. Create your first alert from the form above." />
      </Card>
    );
  }

  return (
    <Card className="card-surface">
      <Typography.Title level={3}>Alerts</Typography.Title>
      {hasLoadError ? (
        <Alert
          type="warning"
          showIcon
          message="Showing last available alert data."
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {mutationError ? (
        <Alert
          type="error"
          showIcon
          message={mutationError}
          style={{ marginBottom: 12 }}
          action={
            <Button
              size="small"
              onClick={() => {
                if (retryAction) {
                  void runMutation(retryAction);
                }
              }}
              disabled={!retryAction || isMutating}
            >
              Retry
            </Button>
          }
        />
      ) : null}
      <Table<AlertRow>
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: 'Asset',
            dataIndex: 'symbol',
            key: 'symbol',
          },
          {
            title: 'Target',
            dataIndex: 'targetPrice',
            key: 'targetPrice',
          },
          {
            title: 'Status',
            key: 'status',
            render: (_, alert) => <Tag color={alert.isActive ? 'green' : 'default'}>{alert.isActive ? 'active' : 'paused'}</Tag>,
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, alert) => (
              <Space>
                <Button
                  type="text"
                  disabled={isMutating}
                  onClick={() => {
                    onExpand(expandedId === alert.id ? '' : alert.id);
                  }}
                >
                  {expandedId === alert.id ? 'Hide' : 'View'}
                </Button>
                <Button type="default" disabled={isMutating} onClick={() => onEdit(alert)}>
                  Edit
                </Button>
                <Button type="primary" loading={isMutating} disabled={isMutating} onClick={() => void onToggleStatus(alert)}>
                  {alert.isActive ? 'Pause' : 'Activate'}
                </Button>
                <Button danger loading={isMutating} disabled={isMutating} onClick={() => void onDelete(alert.id)}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
        dataSource={alerts}
        expandable={{
          expandedRowRender: (alert) => (
            <div>
              <p>{alert.displayName}</p>
              <p>Condition: {alert.condition === 'gte' ? 'above' : 'below'}</p>
              <p>Frequency: {alert.intervalMinutes} min</p>
              <p>Last checked: {alert.lastCheckedAt ? alert.lastCheckedAt.toLocaleString() : 'Never'}</p>
              <p>Last triggered: {alert.lastTriggeredAt ? alert.lastTriggeredAt.toLocaleString() : 'Never'}</p>
            </div>
          ),
          expandedRowKeys: expandedId ? [expandedId] : [],
          onExpand: (_, alert) => {
            onExpand(expandedId === alert.id ? '' : alert.id);
          },
        }}
      />
      {hasMore ? (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button type="default" loading={isLoadingMore} disabled={isMutating} onClick={() => void onLoadMore()}>
            Load more alerts
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
