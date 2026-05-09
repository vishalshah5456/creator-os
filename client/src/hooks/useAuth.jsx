import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/utils.js';
import { appUrl, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'creatoros:lastActivity';
const PASSWORD_PROMPT_DISMISSED_KEY = 'creatoros:passwordPromptDismissed';

function markActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

function isSessionExpired() {
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return lastActivity > 0 && Date.now() - lastActivity > SESSION_TIMEOUT_MS;
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
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (isSessionExpired()) {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
        markActivity();
      }

      localStorage.setItem('token', token);

      try {
        const profile = await api('/auth/me');
        if (isMounted) setUser(profile);
      } catch {
        localStorage.removeItem('token');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token) {
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setUser(null);
        return;
      }

      if (isSessionExpired()) {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setUser(null);
        return;
      }

      localStorage.setItem('token', session.access_token);
      markActivity();

      try {
        const profile = await api('/auth/me');
        setUser(profile);
      } catch {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setUser(null);
      }
    });

    const refreshActivity = () => {
      if (localStorage.getItem('token')) {
        markActivity();
      }
    };

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, refreshActivity, { passive: true }));

    const timeoutCheck = window.setInterval(async () => {
      if (localStorage.getItem('token') && isSessionExpired()) {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setUser(null);
      }
    }, 30 * 1000);

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
      activityEvents.forEach((event) => window.removeEventListener(event, refreshActivity));
      window.clearInterval(timeoutCheck);
    };
  }, []);

  const login = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const emailCheck = await api(`/auth/email-exists?email=${encodeURIComponent(normalizedEmail)}`).catch(() => null);

      if (emailCheck?.exists) {
        throw new Error('This email is already registered. If you used Google before, continue with Google. If you created a password account, check your password.');
      }

      throw new Error(error.message);
    }

    markActivity();
    localStorage.setItem('token', data.session.access_token);
    const profile = await api('/auth/me');
    const passwordState = await api('/auth/password-set', { method: 'POST' }).catch(() => null);
    const updatedProfile = passwordState ? { ...profile, has_password: true } : profile;
    setUser(updatedProfile);
    return updatedProfile;
  };

  const register = async (email, password, name, handle) => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailCheck = await api(`/auth/email-exists?email=${encodeURIComponent(normalizedEmail)}`);

    if (emailCheck.exists) {
      throw new Error('An account already exists with this email. Please sign in with Google or use the sign in form.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name, handle },
        emailRedirectTo: `${appUrl}/login`,
      },
    });

    if (error) throw new Error(error.message);
    if (!data.session) {
      return { needsEmailConfirmation: true };
    }

    markActivity();
    localStorage.setItem('token', data.session.access_token);
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
    sessionStorage.removeItem(PASSWORD_PROMPT_DISMISSED_KEY);
    setUser(currentUser => currentUser ? { ...currentUser, has_password: true } : currentUser);
  };

  const loginWithGoogle = async () => {
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
    localStorage.removeItem('token');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(PASSWORD_PROMPT_DISMISSED_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, setPassword, logout, loading }}>
      {children}
      {user && !user.has_password && <PasswordSetupPrompt />}
    </AuthContext.Provider>
  );
}

function PasswordSetupPrompt() {
  const { setPassword } = useAuth();
  const [dismissed, setDismissed] = useState(sessionStorage.getItem(PASSWORD_PROMPT_DISMISSED_KEY) === 'true');
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (dismissed) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use at least 8 characters.');
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

  const dismissPrompt = () => {
    sessionStorage.setItem(PASSWORD_PROMPT_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
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
              minLength={8}
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
              minLength={8}
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={dismissPrompt}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Later
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
