import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/utils.js';
import { appUrl, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'creatoros:lastActivity';

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);

    markActivity();
    localStorage.setItem('token', data.session.access_token);
    const profile = await api('/auth/me');
    setUser(profile);
    return profile;
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
    setUser(profile);
    return profile;
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
