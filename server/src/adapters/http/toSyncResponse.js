// Arma la respuesta de POST /api/sync: agrupa los registros en listas (ver SyncResponse en shared/backupContract.js).

import { CHANGE_LIST_NAMES, RECORD_KIND_BY_LIST } from '../../../../shared/backupContract.js';

const toWireRecord = ({ id, updatedAt, isDeleted, data }) => ({ id, updatedAt, isDeleted, data });

/**
 * @param {{ cursor: number, hasMore: boolean, records: import('../../domain/backupRecord.js').StoredBackupRecord[] }} syncResult
 * @returns {import('../../../../shared/backupContract.js').SyncResponse}
 */
export function toSyncResponse({ cursor, hasMore, records }) {
  const changes = {};
  for (const listName of CHANGE_LIST_NAMES) {
    changes[listName] = records.filter((record) => record.kind === RECORD_KIND_BY_LIST[listName]).map(toWireRecord);
  }
  return { cursor, hasMore, changes };
}
