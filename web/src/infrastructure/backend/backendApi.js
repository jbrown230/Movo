// Cliente de la API de Movo (server/). Es opcional: sin servidor la app sigue funcionando.
// La descripción de la API está en docs/API.md.

import { fromWireChanges, toWireChanges } from './backupWireFormat.js';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Error ' + response.status);
    error.status = response.status;
    throw error;
  }
  return data;
}

/** @type {import('../../application/ports.js').BackendApi & {getConfig: () => Promise<{googleClientId: string|null, cloudSync: boolean}>}} */
export const backendApi = {
  getConfig: () => request('/config'),
  getExchangeRate: () => request('/fx'),

  async syncBackup({ token, since, changes }) {
    const response = await request('/sync', {
      token,
      method: 'POST',
      body: { since, changes: toWireChanges(changes) },
    });
    return { cursor: response.cursor, hasMore: response.hasMore, changes: fromWireChanges(response.changes) };
  },

  deleteMyData: ({ token }) => request('/me', { token, method: 'DELETE' }),
};
