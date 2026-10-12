// Arma todos los casos de uso con sus dependencias. La capa HTTP solo habla con lo que devuelve esta función.

import { createAuthenticateUser } from './authenticateUser.js';
import { createDeleteUserBackup } from './deleteUserBackup.js';
import { createGetExchangeRate } from './getExchangeRate.js';
import { createGetHealth } from './getHealth.js';
import { createGetPublicConfig } from './getPublicConfig.js';
import { createRateLimiter } from './rateLimiter.js';
import { createSyncBackup } from './syncBackup.js';

/**
 * @param {Object} dependencies
 * @param {{googleClientId: string, cloudSync: boolean, requestsPerMinute: number, fallbackExchangeRate: number}} dependencies.settings
 * @param {import('./ports.js').Cache} dependencies.cache
 * @param {import('./ports.js').BackupStore|null} dependencies.backupStore  null si el respaldo está apagado.
 * @param {import('./ports.js').TokenVerifier} dependencies.tokenVerifier
 * @param {import('./ports.js').ExchangeRateSource|null} dependencies.exchangeRateSource
 * @param {{ warn?: (...args: unknown[]) => void }} [dependencies.log]
 */
export function createUseCases({ settings, cache, backupStore, tokenVerifier, exchangeRateSource, log }) {
  const isBackupEnabled = Boolean(settings.cloudSync && backupStore);
  const ensureWithinLimit = createRateLimiter({ cache });

  return {
    isBackupEnabled,
    ensureWithinLimit,
    getPublicConfig: createGetPublicConfig({ googleClientId: settings.googleClientId, isBackupEnabled }),
    getHealth: createGetHealth({ cache, backupStore }),
    getExchangeRate: createGetExchangeRate({
      cache,
      exchangeRateSource,
      fallbackRate: settings.fallbackExchangeRate,
      log,
    }),
    authenticateUser: createAuthenticateUser({
      cache,
      tokenVerifier,
      ensureWithinLimit,
      expectedClientId: settings.googleClientId,
      requestsPerMinute: settings.requestsPerMinute,
    }),
    syncBackup: backupStore && createSyncBackup({ backupStore }),
    deleteUserBackup: backupStore && createDeleteUserBackup({ backupStore }),
  };
}
