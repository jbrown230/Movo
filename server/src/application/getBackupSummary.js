// Caso de uso: resumen del respaldo de una persona (cuántos movimientos, reglas, ajustes y metas guarda).
//
// Lo calcula MongoDB con un aggregation pipeline y se guarda en la caché como un hash de Redis,
// un campo por tipo de registro. No se espera a que venza: syncBackup y deleteUserBackup borran
// la clave en cuanto cambia el respaldo (invalidación explícita). El TTL solo es una red de seguridad.

const SUMMARY_CACHE_SECONDS = 60 * 60;
const DELETED_FIELD = 'deleted';
const LAST_UPDATED_FIELD = 'lastUpdatedAt';
const KIND_PREFIX = 'kind:';

export const backupSummaryKey = (userId) => `bk:summary:${userId}`;

/** @param {import('./ports.js').BackupSummary} summary */
function toHashFields(summary) {
  const fields = { [DELETED_FIELD]: summary.deleted, [LAST_UPDATED_FIELD]: summary.lastUpdatedAt };
  for (const [kind, count] of Object.entries(summary.activeByKind)) fields[KIND_PREFIX + kind] = count;
  return fields;
}

/** @returns {import('./ports.js').BackupSummary} */
function fromHashFields(fields) {
  const activeByKind = {};
  for (const [name, value] of Object.entries(fields)) {
    if (name.startsWith(KIND_PREFIX)) activeByKind[name.slice(KIND_PREFIX.length)] = Number(value);
  }
  return { activeByKind, deleted: Number(fields[DELETED_FIELD]), lastUpdatedAt: Number(fields[LAST_UPDATED_FIELD]) };
}

/**
 * @param {{ backupStore: import('./ports.js').BackupStore, cache: import('./ports.js').Cache }} dependencies
 */
export function createGetBackupSummary({ backupStore, cache }) {
  /** @returns {Promise<import('./ports.js').BackupSummary & { fromCache: boolean }>} */
  return async function getBackupSummary(userId) {
    const cached = await cache.getHash(backupSummaryKey(userId));
    if (cached) return { ...fromHashFields(cached), fromCache: true };

    const summary = await backupStore.summarize(userId);
    await cache.setHash(backupSummaryKey(userId), toHashFields(summary), SUMMARY_CACHE_SECONDS);
    return { ...summary, fromCache: false };
  };
}
