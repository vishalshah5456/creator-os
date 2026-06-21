import { createContext, useContext, useEffect, useState } from 'react';
import { api, clearStoredAuth, getStoredToken } from '../lib/utils.js';
import { appUrl, REMEMBER_ME_KEY, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS || 30 * 60 * 1000);
const STANDARD_SESSION_MS = Number(import.meta.env.VITE_SESSION_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const REMEMBER_SESSION_MS = Number(import.meta.env.VITE_REMEMBER_ME_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);
const LAST_ACTIVITY_KEY = 'creatoros:lastActivity';
const SESSION_STARTED_KEY = 'creatoros:sessionStartedAt';
const SESSION_MESSAGE_KEY = 'creatoros:sessionMessage';

function isRemembered() {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

function activeTokenStorage() {
  return isRemembered() ? localStorage : sessionStorage;
}

function storeToken(token) {
  activeTokenStorage().setItem('token', token);
  const inactiveStorage = activeTokenStorage() === localStorage ? sessionStorage : localStorage;
  inactiveStorage.removeItem('token');
}

function markActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

function markSessionStarted() {
  if (!localStorage.getItem(SESSION_STARTED_KEY)) {
    localStorage.setItem(SESSION_STARTED_KEY, Date.now().toString());
  }
}

function getSessionExpiryReason() {
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  const startedAt = Number(localStorage.getItem(SESSION_STARTED_KEY));
  const maxAge = isRemembered() ? REMEMBER_SESSION_MS : STANDARD_SESSION_MS;

  if (lastActivity > 0 && Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
    return 'Your session expired after 30 minutes of inactivity. Please sign in again.';
  }

  if (startedAt > 0 && Date.now() - startedAt > maxAge) {
    return isRemembered()
      ? 'Your remembered session expired after 30 days. Please sign in again.'
      : 'Your session expired. Please sign in again.';
  }

  return '';
}

function clearSessionCache(message = '') {
  clearStoredAuth();
  if (message) localStorage.setItem(SESSION_MESSAGE_KEY, message);
}

async function expireSession(message, setUser) {
  await supabase.auth.signOut();
  clearSessionCache(message);
  setUser(null);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        clearSessionCache();
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const expiryReason = getSessionExpiryReason();
      if (expiryReason) {
        await expireSession(expiryReason, setUser);
        if (isMounted) setLoading(false);
        return;
      }

      markSessionStarted();
      markActivity();
      storeToken(token);

      try {
        const profile = await api('/auth/me');
        if (isMounted) setUser(profile);
      } catch {
        clearSessionCache('Your session could not be verified. Please sign in again.');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token) {
        clearSessionCache();
        setUser(null);
        return;
      }

      const expiryReason = getSessionExpiryReason();
      if (expiryReason) {
        await expireSession(expiryReason, setUser);
        return;
      }

      markSessionStarted();
      markActivity();
      storeToken(session.access_token);

      try {
        const profile = await api('/auth/me');
        setUser(profile);
      } catch {
        await expireSession('Your session could not be verified. Please sign in again.', setUser);
      }
    });

    const refreshActivity = () => {
      if (getStoredToken()) markActivity();
    };

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, refreshActivity, { passive: true }));

    const timeoutCheck = window.setInterval(async () => {
      const expiryReason = getStoredToken() ? getSessionExpiryReason() : '';
      if (expiryReason) {
        await expireSession(expiryReason, setUser);
      }
    }, 30 * 1000);

    const handleAuthExpired = async () => {
      await expireSession('Your session expired. Please sign in again.', setUser);
    };

    window.addEventListener('creatoros:auth-expired', handleAuthExpired);

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
      activityEvents.forEach((event) => window.removeEventListener(event, refreshActivity));
      window.removeEventListener('creatoros:auth-expired', handleAuthExpired);
      window.clearInterval(timeoutCheck);
    };
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw new Error('Could not sign in. Check your email/password, or continue with Google if you used Google before.');
    }

    localStorage.setItem(SESSION_STARTED_KEY, Date.now().toString());
    markActivity();
    storeToken(data.session.access_token);
    const profile = await api('/auth/me');
    const passwordState = await api('/auth/password-set', { method: 'POST' }).catch(() => null);
    const updatedProfile = passwordState ? { ...profile, has_password: true } : profile;
    setUser(updatedProfile);
    return updatedProfile;
  };

  const register = async (email, password, name, handle, rememberMe = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name, handle },
        emailRedirectTo: `${appUrl}/login`,
      },
    });

    if (error) {
      throw new Error(error.message.includes('already') ? 'An account already exists with this email. Please sign in instead.' : error.message);
    }
    if (!data.session) {
      return { needsEmailConfirmation: true };
    }

    localStorage.setItem(SESSION_STARTED_KEY, Date.now().toString());
    markActivity();
    storeToken(data.session.access_token);
    const profile = await api('/auth/me');
    const passwordState = await api('/auth/password-set', { method: 'POST' }).catch(() => null);
    const updatedProfile = passwordState ? { ...profile, has_password: true } : profile;
    setUser(updatedProfile);
    return updatedProfile;
  };

  const setPassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) throw new Error(error.message);

    await api('/auth/password-set', { method: 'POST' });
    setUser(currentUser => currentUser ? { ...currentUser, has_password: true } : currentUser);
  };

  const refreshProfile = async () => {
    const profile = await api('/auth/me');
    setUser(profile);
    return profile;
  };

  const updateProfile = async (profile) => {
    const updatedProfile = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    setUser(updatedProfile);
    return updatedProfile;
  };

  const updateEmail = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.updateUser(
      { email: normalizedEmail },
      { emailRedirectTo: `${appUrl}/profile` }
    );

    if (error) throw new Error(error.message);
    return normalizedEmail;
  };

  const sendPasswordReset = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${appUrl}/login`,
    });

    if (error) throw new Error(error.message);
  };

  const loginWithGoogle = async (rememberMe = false) => {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: appUrl,
      },
    });

    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearSessionCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      loginWithGoogle,
      setPassword,
      updateProfile,
      updateEmail,
      sendPasswordReset,
      refreshProfile,
      logout,
      loading
    }}>
      {children}
      {user && !user.has_password && <PasswordSetupPrompt />}
    </AuthContext.Provider>
  );
}

function PasswordSetupPrompt() {
  const { setPassword } = useAuth();
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Use at least 12 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await setPassword(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/45 backdrop-blur-sm password-overlay-enter">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl password-modal-enter">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Set a password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add a password so this account can be opened with Google or email and password.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              minLength={12}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              minLength={12}
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function consumeSessionMessage() {
  const message = localStorage.getItem(SESSION_MESSAGE_KEY);
  localStorage.removeItem(SESSION_MESSAGE_KEY);
  return message;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
