// Caso de uso: sincronizar el respaldo de una persona.
// Guarda los cambios que manda el teléfono y devuelve lo que cambió desde su último cursor.

import { MAX_RECORDS_PER_RESPONSE } from '../../../shared/backupContract.js';

/** @param {{ backupStore: import('./ports.js').BackupStore }} dependencies */
export function createSyncBackup({ backupStore }) {
  /**
   * @param {{ userId: string, cursor: number, records: import('../domain/backupRecord.js').BackupRecord[] }} request
   * @returns {Promise<{ cursor: number, hasMore: boolean, records: import('../domain/backupRecord.js').StoredBackupRecord[] }>}
   */
  return async function syncBackup({ userId, cursor, records }) {
    await backupStore.saveChanges(userId, records);

    const changedRecords = await backupStore.findChangesAfter(userId, cursor, MAX_RECORDS_PER_RESPONSE);
    const lastRecord = changedRecords.at(-1);
    return {
      cursor: lastRecord ? lastRecord.serverSequence : cursor,
      hasMore: changedRecords.length === MAX_RECORDS_PER_RESPONSE,
      records: changedRecords,
    };
  };
}
