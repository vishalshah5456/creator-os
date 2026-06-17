import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getStoredToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

export function clearStoredAuth() {
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
  localStorage.removeItem('creatoros:lastActivity');
  localStorage.removeItem('creatoros:sessionStartedAt');
}

export async function api(endpoint, options = {}) {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    if (res.status === 401) {
      clearStoredAuth();
      window.dispatchEvent(new CustomEvent('creatoros:auth-expired'));
    }
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}
