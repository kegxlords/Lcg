import { supabase } from './lcg-client.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/index.html?redirect=${redirect}`);
    throw new Error('Sign in to continue.');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`
  };
  const options = { method, headers, signal, cache: 'no-store' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/index.html?redirect=${redirect}`);
    }
    throw new Error(readableError(payload.error) || `Request failed (${response.status}).`);
  }
  return payload;
}

function readableError(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.message) return String(value.message);
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function getProfile() {
  return apiRequest('/api/profile');
}

export function money(value, compact = false) {
  const amount = Number(value || 0);
  if (compact) {
    const abs = Math.abs(amount);
    if (abs >= 1e9) return `₦${(amount / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `₦${(amount / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `₦${(amount / 1e3).toFixed(1)}K`;
  }
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', options).format(date);
}

export function showPageError(container, error, retry) {
  const message = escapeHTML(readableError(error?.message || error) || 'Could not load your data.');
  container.innerHTML = `<div class="data-state data-state-error" role="alert"><strong>Couldn’t load this page</strong><p>${message}</p>${retry ? '<button class="btn btn-ghost btn-sm" data-retry>Try again</button>' : ''}</div>`;
  if (retry) container.querySelector('[data-retry]')?.addEventListener('click', retry);
}

export function showLoading(container, label = 'Loading your account…') {
  const markup = `<div class="data-state" role="status"><span class="loading-mark" aria-hidden="true"></span><span>${escapeHTML(label)}</span></div>`;
  if (container) container.innerHTML = markup;
  return markup;
}

export function showEmpty(message) {
  return `<div class="data-state data-state-empty"><strong>Nothing here yet</strong><p>${escapeHTML(message)}</p></div>`;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.assign('/index.html');
}
