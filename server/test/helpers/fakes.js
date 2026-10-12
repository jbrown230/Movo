// Dobles de prueba: versiones simples de lo que los casos de uso necesitan del exterior.

import { createInMemoryBackupStore } from '../../src/adapters/memory/InMemoryBackupStore.js';
import { createInMemoryCache } from '../../src/adapters/cache/InMemoryCache.js';
import { createResilientCache } from '../../src/adapters/cache/ResilientCache.js';
import { createUseCases } from '../../src/application/createUseCases.js';

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';

/** Tokens de prueba y la persona a la que pertenece cada uno. Los tokens miden 20+ caracteres a propósito. */
export const TOKENS = {
  ana: 'token-ana-xxxxxxxxxxxxxxxx',
  beto: 'token-beto-xxxxxxxxxxxxxxx',
  otherApp: 'token-otra-app-xxxxxxxxxxx',
  unknown: 'token-desconocido-xxxxxxxx',
};

const GOOGLE_ANSWERS = {
  [TOKENS.ana]: { userId: 'ana', audience: CLIENT_ID, expiresInSeconds: 3000 },
  [TOKENS.beto]: { userId: 'beto', audience: CLIENT_ID, expiresInSeconds: 3000 },
  [TOKENS.otherApp]: { userId: 'eva', audience: 'otra-app', expiresInSeconds: 3000 },
};

/** Verificador de Google falso. Cuenta cuántas veces se le preguntó. */
export function createFakeTokenVerifier() {
  const verifier = {
    callCount: 0,
    async verifyAccessToken(token) {
      verifier.callCount++;
      return GOOGLE_ANSWERS[token] ?? null;
    },
  };
  return verifier;
}

export const createMemoryOnlyCache = () => createResilientCache({ redis: null, memory: createInMemoryCache() });

/** Casos de uso completos con piezas en memoria. `overrides` cambia lo que cada prueba necesite. */
export function createTestUseCases(overrides = {}) {
  const tokenVerifier = overrides.tokenVerifier ?? createFakeTokenVerifier();
  const cache = overrides.cache ?? createMemoryOnlyCache();
  const useCases = createUseCases({
    settings: {
      googleClientId: CLIENT_ID,
      cloudSync: true,
      requestsPerMinute: 60,
      fallbackExchangeRate: 510,
      ...overrides.settings,
    },
    cache,
    backupStore: overrides.backupStore === undefined ? createInMemoryBackupStore() : overrides.backupStore,
    tokenVerifier,
    exchangeRateSource: overrides.exchangeRateSource ?? null,
    log: overrides.log ?? {},
  });
  return { useCases, tokenVerifier, cache };
}
