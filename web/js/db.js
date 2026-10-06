// Carga SQLite (sql.js, WebAssembly) en el navegador y guarda el archivo de la
// base en IndexedDB. Hay UNA base por usuario (clave "db:<sub>") y otra para el
// modo demo, así los datos de distintas personas nunca se mezclan en el teléfono.

import { migrate, createRepo } from './repo.js';

const IDB_NAME = 'puraplata', STORE = 'kv';

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbOp(mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
    const req = fn(s);
    t.oncomplete = () => { res(req?.result); d.close(); };
    t.onerror = () => { rej(t.error); d.close(); };
  });
}
export const idbGet = (k) => idbOp('readonly', (s) => s.get(k));
export const idbSet = (k, v) => idbOp('readwrite', (s) => s.put(v, k));
export const idbDel = (k) => idbOp('readwrite', (s) => s.delete(k));

let SQL = null;
async function sqlJs() {
  if (!SQL) SQL = await window.initSqlJs({ locateFile: (f) => `/vendor/${f}` });
  return SQL;
}

/** Abre (o crea) la base local de un usuario. */
export async function openUserDb(userKey) {
  const S = await sqlJs();
  const key = `db:${userKey}`;
  const bytes = await idbGet(key).catch(() => null);
  const db = bytes ? new S.Database(new Uint8Array(bytes)) : new S.Database();
  migrate(db);

  let timer = null, saving = Promise.resolve();
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { saving = saving.then(() => idbSet(key, db.export())).catch(console.error); }, 250);
  };
  const flush = async () => { clearTimeout(timer); await saving; await idbSet(key, db.export()); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  const repo = createRepo(db, { onChange: persist });
  repo.flush = flush;
  repo.wipe = async () => { clearTimeout(timer); db.close(); await idbDel(key); };
  if (!bytes) await flush();
  return repo;
}
