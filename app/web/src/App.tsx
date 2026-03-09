import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Button, Card, Typography } from 'antd';
import { auth } from './lib/firebase';
import { LoginForm } from './components/LoginForm';
import { AlertsTable } from './components/AlertsTable';
import { AlertForm } from './components/AlertForm';
import { AlertRow } from './types';
import { listAlerts as fetchAlerts } from './lib/alerts';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlertRow | null>(null);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  const loadAlerts = async () => {
    if (!user) {
      return;
    }

    setIsAlertsLoading(true);
    try {
      const items = await fetchAlerts(user.uid);
      setAlerts(items);
    } finally {
      setIsAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadAlerts();
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
          await loadAlerts();
        }}
      />

      <AlertsTable
        alerts={alerts}
        expandedId={expandedId}
        onExpand={(id) => setExpandedId(id || null)}
        onEdit={(alert) => setEditing(alert)}
        onUpdated={loadAlerts}
        isLoading={isAlertsLoading}
      />
    </main>
  );
}
