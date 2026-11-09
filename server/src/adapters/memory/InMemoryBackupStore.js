// Respaldo en memoria. Tiene la misma lógica que el de MongoDB, y sirve para las pruebas.

import { nextServerSequence, shouldReplace, toBackupSummary } from '../../domain/backupRecord.js';

const KEY_SEPARATOR = String.fromCharCode(0); // un carácter que no aparece en ids ni en nombres
const recordKey = (userId, kind, id) => [userId, kind, id].join(KEY_SEPARATOR);

/** @returns {import('../../application/ports.js').BackupStore} */
export function createInMemoryBackupStore() {
  /** @type {Map<string, import('../../domain/backupRecord.js').StoredBackupRecord & {userId: string}>} */
  const storedRecords = new Map();

  return {
    async saveChanges(userId, records) {
      let savedCount = 0;
      for (const record of records) {
        const key = recordKey(userId, record.kind, record.id);
        if (!shouldReplace(record, storedRecords.get(key))) continue;
        storedRecords.set(key, { ...record, userId, serverSequence: nextServerSequence() });
        savedCount++;
      }
      return savedCount;
    },

    async findChangesAfter(userId, cursor, limit) {
      return [...storedRecords.values()]
        .filter((record) => record.userId === userId && record.serverSequence > cursor)
        .sort((first, second) => first.serverSequence - second.serverSequence)
        .slice(0, limit)
        .map(({ userId: _owner, ...record }) => record);
    },

    async deleteAll(userId) {
      let deletedCount = 0;
      for (const [key, record] of storedRecords) {
        if (record.userId !== userId) continue;
        storedRecords.delete(key);
        deletedCount++;
      }
      return deletedCount;
    },

    async summarize(userId) {
      const rowsByKind = new Map();
      for (const record of storedRecords.values()) {
        if (record.userId !== userId) continue;
        const row = rowsByKind.get(record.kind) ?? { kind: record.kind, active: 0, deleted: 0, lastUpdatedAt: 0 };
        row[record.isDeleted ? 'deleted' : 'active']++;
        row.lastUpdatedAt = Math.max(row.lastUpdatedAt, record.updatedAt);
        rowsByKind.set(record.kind, row);
      }
      return toBackupSummary([...rowsByKind.values()]);
    },

    async ping() {
      return true;
    },

    async close() {},
  };
}
