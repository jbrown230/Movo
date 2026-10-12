// Respaldo por usuario en MongoDB.
//
// Una sola colección, "backup_records". Cada documento es:
//   { userId, kind, id, updatedAt, serverSequence, isDeleted, data }
// y TODA consulta lleva `userId` en el filtro, así los datos de cada persona quedan separados.

import { MongoClient } from 'mongodb';
import { ServiceUnavailableError } from '../../application/errors.js';
import { nextServerSequence } from '../../domain/backupRecord.js';

const COLLECTION_NAME = 'backup_records';
const CONNECTION_TIMEOUT_MS = 4000;
const DUPLICATE_KEY_ERROR_CODE = 11000;

/** E11000 = ya existe una versión más nueva de ese registro: se ignora a propósito. */
function isOnlyDuplicateKeyErrors(error) {
  const writeErrors = error.writeErrors || error.result?.getWriteErrors?.() || [];
  const isDuplicate = (writeError) => (writeError.code ?? writeError.err?.code) === DUPLICATE_KEY_ERROR_CODE;
  return writeErrors.length > 0 && writeErrors.every(isDuplicate);
}

/** Solo reemplaza el guardado si el cambio es más reciente (ver shouldReplace en el dominio). */
const toUpsertOperation = (userId, record) => ({
  updateOne: {
    filter: { userId, kind: record.kind, id: record.id, updatedAt: { $lt: record.updatedAt } },
    update: {
      $set: {
        userId,
        kind: record.kind,
        id: record.id,
        updatedAt: record.updatedAt,
        isDeleted: record.isDeleted,
        data: record.data,
        serverSequence: nextServerSequence(),
      },
    },
    upsert: true,
  },
});

/** Conecta y prepara los índices. Devuelve la colección, o null si no se pudo conectar. */
async function connectToCollection(client, log) {
  try {
    await client.connect();
    const collection = client.db().collection(COLLECTION_NAME);
    await collection.createIndex({ userId: 1, kind: 1, id: 1 }, { unique: true });
    await collection.createIndex({ userId: 1, serverSequence: 1 });
    log.info?.('[mongo] conectado');
    return collection;
  } catch (error) {
    log.warn?.('[mongo] sin conexión:', error.message);
    return null;
  }
}

/**
 * @param {string} url
 * @param {{ info?: Function, warn?: Function }} [log]
 * @returns {import('../../application/ports.js').BackupStore}
 */
export function createMongoBackupStore(url, log = console) {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: CONNECTION_TIMEOUT_MS });
  const connection = connectToCollection(client, log);

  async function collection() {
    const connected = await connection;
    if (!connected) throw new ServiceUnavailableError('Respaldo no disponible por ahora.');
    return connected;
  }

  return {
    async saveChanges(userId, changes) {
      if (!changes.length) return 0;
      const operations = changes.map((record) => toUpsertOperation(userId, record));
      try {
        const result = await (await collection()).bulkWrite(operations, { ordered: false });
        return result.upsertedCount + result.modifiedCount;
      } catch (error) {
        if (!isOnlyDuplicateKeyErrors(error)) throw error;
        return (error.result?.upsertedCount || 0) + (error.result?.modifiedCount || 0);
      }
    },

    async findChangesAfter(userId, cursor, limit) {
      return (await collection())
        .find({ userId, serverSequence: { $gt: cursor } }, { projection: { _id: 0, userId: 0 } })
        .sort({ serverSequence: 1 })
        .limit(limit)
        .toArray();
    },

    async deleteAll(userId) {
      return (await (await collection()).deleteMany({ userId })).deletedCount;
    },

    async ping() {
      try {
        await collection();
        await client.db().command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },

    async close() {
      await client.close().catch(() => {});
    },
  };
}
