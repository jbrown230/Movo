// Caso de uso: estado de salud del servidor, para monitoreo (docker, balanceadores).

/**
 * @param {{ cache: import('./ports.js').Cache, backupStore: import('./ports.js').BackupStore|null }} dependencies
 */
export function createGetHealth({ cache, backupStore }) {
  return async function getHealth() {
    return {
      ok: true,
      redis: cache.isSharedCacheReady(),
      mongo: backupStore ? await backupStore.ping() : null,
    };
  };
}
