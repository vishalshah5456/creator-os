import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const REMEMBER_ME_KEY = 'creatoros:rememberMe';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

function activeAuthStorage() {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true' ? localStorage : sessionStorage;
}

const authStorage = {
  getItem(key) {
    return activeAuthStorage().getItem(key) || localStorage.getItem(key) || sessionStorage.getItem(key);
  },
  setItem(key, value) {
    activeAuthStorage().setItem(key, value);
    const inactiveStorage = activeAuthStorage() === localStorage ? sessionStorage : localStorage;
    inactiveStorage.removeItem(key);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
