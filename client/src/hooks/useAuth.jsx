import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/utils.js';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

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
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
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
        setUser(null);
        return;
      }

      localStorage.setItem('token', session.access_token);
      const profile = await api('/auth/me');
      setUser(profile);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);

    localStorage.setItem('token', data.session.access_token);
    const profile = await api('/auth/me');
    setUser(profile);
    return profile;
  };

  const register = async (email, password, name, handle) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, handle },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) throw new Error(error.message);
    if (!data.session) {
      return { needsEmailConfirmation: true };
    }

    localStorage.setItem('token', data.session.access_token);
    const profile = await api('/auth/me');
    setUser(profile);
    return profile;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
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
