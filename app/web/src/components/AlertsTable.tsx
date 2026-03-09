import { AlertRow } from '../types';
import { deleteAlert, toggleAlertActive } from '../lib/alerts';
import { Button, Card, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';

interface Props {
  alerts: AlertRow[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (alert: AlertRow) => void;
  onUpdated: () => Promise<void>;
  isLoading: boolean;
}

export function AlertsTable({ alerts, expandedId, onExpand, onEdit, onUpdated, isLoading }: Props) {
  const onDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this alert?');
    if (!confirmed) {
      return;
    }

    await deleteAlert(id);
    await onUpdated();
  };

  const onToggleStatus = async (alert: AlertRow) => {
    await toggleAlertActive(alert.id, !alert.isActive);
    await onUpdated();
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
                  onClick={() => {
                    onExpand(expandedId === alert.id ? '' : alert.id);
                  }}
                >
                  {expandedId === alert.id ? 'Hide' : 'View'}
                </Button>
                <Button type="default" onClick={() => onEdit(alert)}>
                  Edit
                </Button>
                <Button type="primary" onClick={() => void onToggleStatus(alert)}>
                  {alert.isActive ? 'Pause' : 'Activate'}
                </Button>
                <Button danger onClick={() => void onDelete(alert.id)}>
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
    </Card>
  );
}
