// Respaldo por usuario en MongoDB.
//
// Una sola colección, "backup_records". Cada documento es:
//   { userId, kind, id, updatedAt, serverSequence, isDeleted, data }
// y TODA consulta lleva `userId` en el filtro, así los datos de cada persona quedan separados.
// La colección tiene un validador $jsonSchema (backupRecordSchema.js): MongoDB rechaza un documento mal formado.
//
// Si MongoDB no responde, cada operación falla con ServiceUnavailableError (503 y un mensaje claro), nunca
// con un error interno. Si estaba caído al arrancar, se vuelve a intentar la conexión en el siguiente pedido.

import { MongoClient, MongoNetworkError, MongoServerSelectionError } from 'mongodb';
import { ServiceUnavailableError } from '../../application/errors.js';
import { nextServerSequence } from '../../domain/backupRecord.js';
import { backupRecordSchema } from './backupRecordSchema.js';

const COLLECTION_NAME = 'backup_records';
const CONNECTION_TIMEOUT_MS = 4000;
const DUPLICATE_KEY_ERROR_CODE = 11000;
const NAMESPACE_EXISTS_ERROR_CODE = 48;
const BACKUP_UNAVAILABLE_MESSAGE = 'Respaldo no disponible por ahora.';

/** Errores del controlador que significan "MongoDB no responde", a diferencia de un error en los datos. */
const isConnectionError = (error) =>
  error instanceof MongoNetworkError ||
  error instanceof MongoServerSelectionError ||
  ['MongoNotConnectedError', 'MongoTopologyClosedError'].includes(error?.name);

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

/** Crea la colección con su validador $jsonSchema, o se lo pone si ya existía (ver backupRecordSchema.js). */
async function applySchemaValidator(db) {
  const validation = { validator: { $jsonSchema: backupRecordSchema }, validationLevel: 'strict' };
  const updateExisting = () => db.command({ collMod: COLLECTION_NAME, ...validation });
  const [existing] = await db.listCollections({ name: COLLECTION_NAME }, { nameOnly: true }).toArray();
  if (existing) return updateExisting();
  try {
    return await db.createCollection(COLLECTION_NAME, validation);
  } catch (error) {
    if (error.code !== NAMESPACE_EXISTS_ERROR_CODE) throw error;
    return updateExisting(); // otro proceso la creó justo antes
  }
}

/** Conecta y prepara el validador y los índices. Devuelve la colección, o null si no se pudo conectar. */
async function connectToCollection(client, log) {
  try {
    await client.connect();
    await applySchemaValidator(client.db());
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
  let connection = connectToCollection(client, log); // se intenta al arrancar, para avisar pronto si falla

  async function collection() {
    connection ??= connectToCollection(client, log);
    const connected = await connection;
    if (!connected) {
      connection = null; // el próximo pedido vuelve a intentar: MongoDB puede haber vuelto
      throw new ServiceUnavailableError(BACKUP_UNAVAILABLE_MESSAGE);
    }
    return connected;
  }

  /** Corre una operación sobre la colección; si MongoDB no responde, falla con 503 y un mensaje claro. */
  async function withCollection(operation) {
    try {
      return await operation(await collection());
    } catch (error) {
      if (isConnectionError(error)) throw new ServiceUnavailableError(BACKUP_UNAVAILABLE_MESSAGE);
      throw error;
    }
  }

  return {
    async saveChanges(userId, changes) {
      if (!changes.length) return 0;
      const operations = changes.map((record) => toUpsertOperation(userId, record));
      return withCollection(async (records) => {
        try {
          const result = await records.bulkWrite(operations, { ordered: false });
          return result.upsertedCount + result.modifiedCount;
        } catch (error) {
          if (!isOnlyDuplicateKeyErrors(error)) throw error;
          return (error.result?.upsertedCount || 0) + (error.result?.modifiedCount || 0);
        }
      });
    },

    findChangesAfter(userId, cursor, limit) {
      return withCollection((records) =>
        records
          .find({ userId, serverSequence: { $gt: cursor } }, { projection: { _id: 0, userId: 0 } })
          .sort({ serverSequence: 1 })
          .limit(limit)
          .toArray(),
      );
    },

    deleteAll(userId) {
      return withCollection(async (records) => (await records.deleteMany({ userId })).deletedCount);
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
