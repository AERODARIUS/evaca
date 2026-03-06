import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { LoginForm } from './components/LoginForm';
import { AlertsTable } from './components/AlertsTable';
import { AlertForm } from './components/AlertForm';
import { AlertRow } from './types';
import { listAlerts as fetchAlerts } from './lib/alerts';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlertRow | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });
  }, []);

  const loadAlerts = async () => {
    if (!user) return;
    const items = await fetchAlerts(user.uid);
    setAlerts(items);
  };

  useEffect(() => {
    if (!user) return;
    void loadAlerts();
  }, [user]);

  if (!user) {
    return (
      <main className="container">
        <LoginForm />
      </main>
    );
  }

  return (
    <main className="container">
      <header className="card row between">
        <p>{user.email}</p>
        <button type="button" onClick={() => signOut(auth)}>
          Logout
        </button>
      </header>

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
        onExpand={(id) => setExpandedId((current) => (current === id ? null : id))}
        onEdit={(alert) => setEditing(alert)}
        onUpdated={loadAlerts}
      />
    </main>
  );
}
