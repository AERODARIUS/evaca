import { Fragment } from 'react';
import { AlertRow } from '../types';
import { deleteAlert, toggleAlertActive } from '../lib/alerts';

interface Props {
  alerts: AlertRow[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (alert: AlertRow) => void;
  onUpdated: () => Promise<void>;
}

export function AlertsTable({ alerts, expandedId, onExpand, onEdit, onUpdated }: Props) {
  const onDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this alert?');
    if (!confirmed) return;

    await deleteAlert(id);
    await onUpdated();
  };

  const onToggleStatus = async (alert: AlertRow) => {
    await toggleAlertActive(alert.id, !alert.isActive);
    await onUpdated();
  };

  if (alerts.length === 0) return <p className="card">No alerts yet.</p>;

  return (
    <section className="card">
      <h2>Alerts</h2>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Target</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const isOpen = expandedId === alert.id;
            return (
              <Fragment key={alert.id}>
                <tr onClick={() => onExpand(alert.id)}>
                  <td>{alert.symbol}</td>
                  <td>{alert.targetPrice}</td>
                  <td>{alert.isActive ? 'active' : 'paused'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(alert);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDelete(alert.id);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onToggleStatus(alert);
                      }}
                    >
                      {alert.isActive ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={4}>
                      <div>
                        <p>{alert.displayName}</p>
                        <p>Condition: {alert.condition === 'gte' ? 'above' : 'below'}</p>
                        <p>Frequency: {alert.intervalMinutes} min</p>
                        <p>Last checked: {alert.lastCheckedAt ? alert.lastCheckedAt.toLocaleString() : 'Never'}</p>
                        <p>Last triggered: {alert.lastTriggeredAt ? alert.lastTriggeredAt.toLocaleString() : 'Never'}</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
