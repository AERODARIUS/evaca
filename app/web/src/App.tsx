import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Alert, Button, Card, Typography } from 'antd';
import { auth } from './lib/firebase';
import { LoginForm } from './components/LoginForm';
import { AlertsTable } from './components/AlertsTable';
import { AlertForm } from './components/AlertForm';
import { AlertRow } from './types';
import { listAlertsPage as fetchAlertsPage } from './lib/alerts';
import { warnLog } from './lib/logger';

const ALERTS_PAGE_SIZE = 20;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlertRow | null>(null);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);
  const [isLoadingMoreAlerts, setIsLoadingMoreAlerts] = useState(false);
  const [alertsPageToken, setAlertsPageToken] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  const loadAlerts = async (options?: { reset?: boolean }) => {
    if (!user) {
      return;
    }

    const shouldReset = options?.reset !== false;
    if (shouldReset) {
      setIsAlertsLoading(true);
    } else {
      setIsLoadingMoreAlerts(true);
    }

    try {
      const page = await fetchAlertsPage(user.uid, {
        pageSize: ALERTS_PAGE_SIZE,
        pageToken: shouldReset ? null : alertsPageToken,
      });
      setAlerts((current) => (shouldReset ? page.items : [...current, ...page.items]));
      setAlertsPageToken(page.nextPageToken);
      setAlertsError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      warnLog('alerts', 'Failed to load alerts', error);
      setAlertsError(
        shouldReset
          ? `Unable to load alerts: ${message}.`
          : `Unable to load more alerts: ${message}.`,
      );
    } finally {
      if (shouldReset) {
        setIsAlertsLoading(false);
      } else {
        setIsLoadingMoreAlerts(false);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadAlerts({ reset: true });
  }, [user]);

  if (!authReady) {
    return (
      <main className="loading-screen">
        <div className="loading-orb" aria-hidden="true" />
        <p className="loading-title">eVaca</p>
        <p className="loading-subtitle">Preparing your alerts...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <LoginForm />
      </main>
    );
  }

  return (
    <main className="container">
      <Card className="card-surface">
        <div className="row between">
          <Typography.Text>{user.email}</Typography.Text>
          <Button type="default" onClick={() => signOut(auth)}>
            Logout
          </Button>
        </div>
      </Card>

      <AlertForm
        userId={user.uid}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaved={async () => {
          await loadAlerts({ reset: true });
        }}
      />

      {alertsError ? (
        <Alert
          type="error"
          showIcon
          message={alertsError}
          action={
            <Button size="small" onClick={() => void loadAlerts({ reset: true })}>
              Retry
            </Button>
          }
        />
      ) : null}

      <AlertsTable
        alerts={alerts}
        expandedId={expandedId}
        onExpand={(id) => setExpandedId(id || null)}
        onEdit={(alert) => setEditing(alert)}
        onUpdated={async () => loadAlerts({ reset: true })}
        isLoading={isAlertsLoading}
        isLoadingMore={isLoadingMoreAlerts}
        hasMore={Boolean(alertsPageToken)}
        onLoadMore={async () => loadAlerts({ reset: false })}
        hasLoadError={Boolean(alertsError)}
      />
    </main>
  );
}
