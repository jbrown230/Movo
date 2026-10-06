// Lectura de Gmail DESDE EL TELÉFONO. El servidor nunca ve los correos ni el
// token de Gmail con fines de lectura: el navegador habla directo con la API de
// Google usando un token de acceso de corta duración (≈1 h, solo lectura).
//
// Flujo OAuth 2.0 para apps del lado del cliente (response_type=token) con
// redirección, que funciona dentro de una PWA instalada.

import { htmlToText } from './html.js';
export { htmlToText };

const SCOPES = 'openid email profile https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY = 'pp:gtoken';

export const DEFAULT_QUERY =
  '(from:baccr.com OR from:credomatic OR from:bncr.fi.cr OR from:bancobcr.com OR from:davivienda OR from:promerica OR subject:SINPE)';

export function startAuth(clientId, { hint = '', silent = false } = {}) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('pp:oauth_state', state);
  sessionStorage.setItem('pp:oauth_silent', silent ? '1' : '');
  const p = new URLSearchParams({
    client_id: clientId, redirect_uri: location.origin + '/', response_type: 'token',
    scope: SCOPES, include_granted_scopes: 'true', state,
  });
  if (hint) p.set('login_hint', hint);
  if (silent) p.set('prompt', 'none');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p);
}

/** Lee el resultado de la redirección (#access_token=…). */
export function handleRedirect() {
  if (!location.hash || !/access_token|error=/.test(location.hash)) return null;
  const h = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const expected = sessionStorage.getItem('pp:oauth_state');
  const silent = sessionStorage.getItem('pp:oauth_silent') === '1';
  sessionStorage.removeItem('pp:oauth_state');
  if (!expected || h.get('state') !== expected) return { error: 'state_mismatch' };
  if (h.get('error')) return { error: h.get('error'), silent };
  const tok = { token: h.get('access_token'), exp: Date.now() + (Number(h.get('expires_in')) || 3600) * 1000 };
  if (!/gmail\.readonly/.test(h.get('scope') || '')) return { error: 'scope_denied' };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tok));
  return tok;
}

export function getToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY));
    return t && t.exp > Date.now() + 60e3 ? t.token : null;
  } catch { return null; }
}
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

class AuthError extends Error { constructor() { super('auth'); this.auth = true; } }

async function gfetch(url, token) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 401 || r.status === 403) throw new AuthError();
  if (!r.ok) throw new Error('Gmail respondió ' + r.status);
  return r.json();
}

export async function fetchProfile(token) {
  return gfetch('https://openidconnect.googleapis.com/v1/userinfo', token);
}

function b64urlToText(data) {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
function bodyOf(payload) {
  let plain = null, html = null;
  (function walk(p) {
    if (!p) return;
    if (p.body?.data) {
      if (p.mimeType === 'text/plain' && !plain) plain = b64urlToText(p.body.data);
      if (p.mimeType === 'text/html' && !html) html = b64urlToText(p.body.data);
    }
    (p.parts || []).forEach(walk);
  })(payload);
  // Si el HTML trae tablas se prefiere: conserva las columnas (Monto, Moneda, Estado…).
  if (html && /<t[dh][\s>]/i.test(html)) return htmlToText(html);
  return (plain && plain.trim()) || (html ? htmlToText(html) : '');
}
const header = (msg, name) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';

/**
 * Busca correos nuevos de bancos y los entrega a `ingest` (idempotente).
 * @returns {{nuevos:number, registrados:number, sinMovimiento:number}}
 */
export async function scanInbox(token, { query = DEFAULT_QUERY, since = null, knows, ingest, onProgress = () => {} }) {
  const q = query + (since ? ` after:${Math.floor(since / 1000) - 86400}` : ' newer_than:45d');
  const ids = [];
  let pageToken = '';
  do {
    const u = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    u.searchParams.set('q', q); u.searchParams.set('maxResults', '100');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const r = await gfetch(u, token);
    (r.messages || []).forEach((m) => { if (!knows(m.id)) ids.push(m.id); });
    pageToken = r.nextPageToken || '';
  } while (pageToken && ids.length < 300);

  const out = { nuevos: ids.length, registrados: 0, sinMovimiento: 0 };
  let done = 0;
  const worker = async () => {
    while (ids.length) {
      const id = ids.shift();
      const m = await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, token);
      const from = header(m, 'from');
      const res = ingest({
        id, messageId: header(m, 'message-id') || null, from,
        fromName: from.replace(/<.*>/, '').replace(/"/g, '').trim() || from,
        subject: header(m, 'subject'), body: bodyOf(m.payload),
        date: new Date(Number(m.internalDate) || Date.now()).toISOString(),
      });
      if (res.status === 'registrado') out.registrados++;
      if (res.status === 'sin_movimiento') out.sinMovimiento++;
      onProgress(++done, out.nuevos);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}
