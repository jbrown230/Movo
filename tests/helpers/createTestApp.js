// Arma la aplicación completa en memoria para las pruebas: una base SQLite real
// (sql.js en Node) con los casos de uso encima. El correo y el servidor se simulan.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { createSqliteStorage } from '../../web/src/infrastructure/sqlite/createSqliteStorage.js';
import { createServices } from '../../web/src/application/createServices.js';
import { buildDemoSeedMails } from '../../web/src/demo/seedMails.js';
import { writeMovementsWorkbook } from '../../web/src/infrastructure/excel/movementsWorkbook.js';

// Se le entrega el archivo .wasm directamente: así funciona también en el entorno de navegador simulado de las pruebas de interfaz.
const wasmBinary = readFileSync(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm'));
const SQL = await initSqlJs({ wasmBinary });

/** Servidor que no responde: sirve para probar lo que pasa sin conexión. */
const OFFLINE_BACKEND = {
  getExchangeRate: async () => {
    throw new Error('sin conexión');
  },
  syncBackup: async () => {
    throw new Error('sin conexión');
  },
  deleteMyData: async () => {
    throw new Error('sin conexión');
  },
};

const NO_MAIL_SOURCE = {
  listNewMailIds: async () => [],
  fetchMail: async () => {
    throw new Error('no hay correos');
  },
};

/**
 * @param {{ backend?: object, mailSource?: object, database?: import('sql.js').Database }} [options]
 */
export function createTestApp({ backend = OFFLINE_BACKEND, mailSource = NO_MAIL_SOURCE, database } = {}) {
  const db = database ?? new SQL.Database();
  const storage = createSqliteStorage(db);
  const services = createServices({
    storage,
    mailSource,
    backend,
    buildDemoMails: buildDemoSeedMails,
    writeMovementsWorkbook,
  });
  return { db, storage, services, queries: services.queries };
}

/** Abre otra vez los mismos bytes de una base (simula cerrar y volver a abrir la app). */
export const reopenDatabase = (db) => new SQL.Database(db.export());

export const newDatabase = () => new SQL.Database();
