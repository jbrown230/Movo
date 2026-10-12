// Abre la base SQLite (sql.js, WebAssembly) de un usuario y la guarda en IndexedDB.
// Hay UNA base por usuario (clave "db:<id>") y otra para el modo demo, así los
// datos de distintas personas nunca se mezclan en el teléfono.

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readValue, writeValue, removeValue } from '../browser/indexedDb.js';
import { createSqliteStorage } from './createSqliteStorage.js';

const SAVE_DELAY_MS = 250;

let sqlJsPromise = null;
const loadSqlJs = () => (sqlJsPromise ??= initSqlJs({ locateFile: () => sqlWasmUrl }));

/**
 * @param {string} userKey  Id del usuario de Google, o "demo".
 * @returns {Promise<{storage: ReturnType<typeof createSqliteStorage>, flush: () => Promise<void>, wipe: () => Promise<void>}>}
 */
export async function openUserDatabase(userKey) {
  const SQL = await loadSqlJs();
  const storageKey = `db:${userKey}`;
  const savedBytes = await readValue(storageKey).catch(() => null);
  const db = savedBytes ? new SQL.Database(new Uint8Array(savedBytes)) : new SQL.Database();

  // Guardado: se espera un momento después del último cambio para no escribir en cada operación.
  let saveTimer = null;
  let lastSave = Promise.resolve();
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      lastSave = lastSave.then(() => writeValue(storageKey, db.export())).catch(console.error);
    }, SAVE_DELAY_MS);
  };
  const flush = async () => {
    clearTimeout(saveTimer);
    await lastSave;
    await writeValue(storageKey, db.export());
  };
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', flushWhenHidden);

  const storage = createSqliteStorage(db, { onChange: saveSoon });
  if (!savedBytes) await flush();

  /** Borra la base de este teléfono. */
  const wipe = async () => {
    clearTimeout(saveTimer);
    document.removeEventListener('visibilitychange', flushWhenHidden);
    db.close();
    await removeValue(storageKey);
  };

  return { storage, flush, wipe };
}
