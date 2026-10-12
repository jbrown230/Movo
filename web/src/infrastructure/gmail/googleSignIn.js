// Inicio de sesión con Google (OAuth 2.0 para apps de navegador, `response_type=token`).
// Funciona con redirección, así que sirve también dentro de una PWA instalada.
//
// Flujo: la app manda a la persona a Google -> Google la regresa a esta misma página
// con el token en la dirección (#access_token=...) -> `readSignInRedirect` lo recoge.

const SCOPES = 'openid email profile https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const TOKEN_KEY = 'movo:google_token';
const STATE_KEY = 'movo:oauth_state';
const SILENT_KEY = 'movo:oauth_silent';

const ONE_HOUR_SECONDS = 3600;
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Manda a la persona a Google para que dé permiso.
 * Con `silent` no se muestra ninguna pantalla: sirve para renovar el token si la sesión de Google sigue activa.
 */
export function startGoogleSignIn(clientId, { hint = '', silent = false } = {}) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(SILENT_KEY, silent ? '1' : '');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: location.origin + '/',
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
  });
  if (hint) params.set('login_hint', hint);
  if (silent) params.set('prompt', 'none');
  location.assign(`${GOOGLE_AUTH_URL}?${params}`);
}

/**
 * Lee el resultado de la redirección de Google, si la página se abrió desde ahí.
 * @returns {null | {token: string, exp: number} | {error: string, silent?: boolean}}
 *          null si la página no viene de Google.
 */
export function readSignInRedirect() {
  const cameFromGoogle = location.hash && /access_token|error=/.test(location.hash);
  if (!cameFromGoogle) return null;

  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search); // limpia el token de la barra de direcciones

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const wasSilent = sessionStorage.getItem(SILENT_KEY) === '1';
  sessionStorage.removeItem(STATE_KEY);

  if (!expectedState || params.get('state') !== expectedState) return { error: 'state_mismatch' };
  if (params.get('error')) return { error: params.get('error'), silent: wasSilent };
  if (!/gmail\.readonly/.test(params.get('scope') || '')) return { error: 'scope_denied' };

  const lifetimeSeconds = Number(params.get('expires_in')) || ONE_HOUR_SECONDS;
  const saved = { token: params.get('access_token'), exp: Date.now() + lifetimeSeconds * 1000 };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(saved));
  return saved;
}

/** Token guardado que todavía sirve, o null. */
export function getSavedToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY));
    return saved && saved.exp > Date.now() + EXPIRY_MARGIN_MS ? saved.token : null;
  } catch {
    return null;
  }
}

export const clearSavedToken = () => localStorage.removeItem(TOKEN_KEY);
