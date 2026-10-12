// Cliente de la API de Movo (server/). Es opcional: sin servidor la app sigue funcionando.

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
  syncBackup: ({ token, since, changes }) => request('/sync', { token, method: 'POST', body: { since, changes } }),
  deleteMyData: ({ token }) => request('/me', { token, method: 'DELETE' }),
};
