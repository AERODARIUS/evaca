import { FormEvent, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

type AuthContext = 'login' | 'register' | 'google';

function getAuthErrorMessage(error: unknown, context: AuthContext): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Sign in or use a different email.';
      case 'auth/invalid-email':
        return 'The email format is invalid.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again in a few minutes.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Check your internet and try again.';
      case 'auth/popup-closed-by-user':
        return 'You closed the Google window before completing sign in.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the popup. Enable popups for this site.';
      case 'auth/cancelled-popup-request':
        return 'The Google sign-in request was canceled.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Authentication.';
      case 'auth/operation-not-allowed':
        return context === 'register'
          ? 'Email/password sign-up is not enabled in Firebase.'
          : 'This authentication method is not enabled in Firebase.';
      default:
        if (error.message.includes('deleted_client')) {
          return 'The Google OAuth client was deleted or is invalid in Google Cloud.';
        }
        return `Authentication error (${error.code}).`;
    }
  }

  return context === 'register'
    ? 'Could not create the account.'
    : 'Could not complete authentication.';
}

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, mode));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'google'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>{mode === 'register' ? 'Create account' : 'Sign in'}</h1>
      <div className="auth-switch">
        <button
          type="button"
          className={mode === 'login' ? 'auth-switch-active' : ''}
          onClick={() => {
            setMode('login');
            setError('');
          }}
          disabled={loading}
        >
          Login
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'auth-switch-active' : ''}
          onClick={() => {
            setMode('register');
            setError('');
          }}
          disabled={loading}
        >
          Register
        </button>
      </div>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {mode === 'register' ? (
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="auth-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : mode === 'register' ? 'Create account' : 'Login'}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onGoogleLogin}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>
      </div>
    </form>
  );
}
