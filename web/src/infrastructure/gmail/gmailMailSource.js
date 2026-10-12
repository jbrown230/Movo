// Lectura de Gmail DESDE EL TELÉFONO. El servidor nunca ve los correos: el navegador
// habla directo con la API de Google usando un token de acceso de corta duración
// (cerca de 1 hora, solo lectura).

import { decodeGmailMessage } from './mailDecoder.js';

const GMAIL_MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const PAGE_SIZE = '100';
const MAX_MAILS_PER_SCAN = 300;
const FIRST_SCAN_WINDOW = 'newer_than:45d';
const ONE_DAY_SECONDS = 86400;

/** El token de Google venció o no tiene permiso. La app pide reconectar. */
export class GmailAuthError extends Error {
  constructor() {
    super('auth');
    this.auth = true;
  }
}

async function getJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 401 || response.status === 403) throw new GmailAuthError();
  if (!response.ok) throw new Error('Gmail respondió ' + response.status);
  return response.json();
}

/** La primera vez se revisan 45 días; después, desde la última lectura (con un día de margen). */
const withTimeWindow = (query, since) =>
  query + (since ? ` after:${Math.floor(since / 1000) - ONE_DAY_SECONDS}` : ` ${FIRST_SCAN_WINDOW}`);

/** @type {import('../../application/ports.js').MailSource} */
export const gmailMailSource = {
  async listNewMailIds({ token, query, since, isKnown }) {
    const search = withTimeWindow(query, since);
    const ids = [];
    let pageToken = '';

    do {
      const url = new URL(GMAIL_MESSAGES_URL);
      url.searchParams.set('q', search);
      url.searchParams.set('maxResults', PAGE_SIZE);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const page = await getJson(url, token);
      for (const message of page.messages || []) if (!isKnown(message.id)) ids.push(message.id);
      pageToken = page.nextPageToken || '';
    } while (pageToken && ids.length < MAX_MAILS_PER_SCAN);

    return ids;
  },

  async fetchMail({ token, id }) {
    const message = await getJson(`${GMAIL_MESSAGES_URL}/${id}?format=full`, token);
    return decodeGmailMessage(id, message);
  },
};

/** Datos básicos de la cuenta de Google (id, correo, nombre y foto). */
export function fetchGoogleProfile(token) {
  return getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
}
