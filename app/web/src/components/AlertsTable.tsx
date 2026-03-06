import { Fragment } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertRow } from '../types';

interface Props {
  alerts: AlertRow[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (alert: AlertRow) => void;
  onDeleted: () => Promise<void>;
}

export function AlertsTable({ alerts, expandedId, onExpand, onEdit, onDeleted }: Props) {
  const onDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this alert?');
    if (!confirmed) return;

    const fn = httpsCallable(functions, 'deleteAlert');
    await fn({ id });
    await onDeleted();
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
                  <td>{alert.status}</td>
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
                  </td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={4}>
                      <div>
                        <p>{alert.displayName}</p>
                        <p>Condition: {alert.condition}</p>
                        <p>Initial price: {alert.creationPrice}</p>
                        <p>Last price: {alert.lastSeenPrice}</p>
                        <p>Frequency: {alert.frequencyMinutes} min</p>
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
