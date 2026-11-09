// Caso de uso: borrar todo lo que el servidor guarda de una persona.

import { backupSummaryKey } from './getBackupSummary.js';

/**
 * @param {Object} dependencies
 * @param {import('./ports.js').BackupStore} dependencies.backupStore
 * @param {import('./ports.js').Cache} [dependencies.cache]  Para invalidar el resumen guardado (ver getBackupSummary).
 */
export function createDeleteUserBackup({ backupStore, cache }) {
  /** @returns {Promise<number>} Cuántos registros se eliminaron. */
  return async (userId) => {
    const deletedCount = await backupStore.deleteAll(userId);
    await cache?.delete(backupSummaryKey(userId));
    return deletedCount;
  };
}
