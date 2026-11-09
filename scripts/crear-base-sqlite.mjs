// Recrea desde cero una base SQLite de Movo, con datos SINTÉTICOS, en un archivo.
// Uso: npm run db:sqlite                        (data/movo.sqlite con 200 correos, semilla 7)
//      npm run db:sqlite -- 1000 42 data/otra.sqlite
//
// En el teléfono la base vive en el navegador (sql.js + IndexedDB) y se crea sola al abrir la app.
// Este script hace lo mismo fuera del navegador: aplica las migraciones de la app (el esquema, en
// web/src/infrastructure/sqlite/migrations.js) y lee los correos del dataset con el lector real.
// El archivo resultante se abre con cualquier cliente de SQLite (sqlite3, DB Browser for SQLite).
// Los archivos .sqlite no se versionan (.gitignore): se recrean con este script.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import initSqlJs from 'sql.js';
import { buildDataset } from './dataset.mjs';
import { createServices } from '../web/src/application/createServices.js';
import { createSqliteStorage } from '../web/src/infrastructure/sqlite/createSqliteStorage.js';

const [count = 200, seed = 7] = process.argv.slice(2, 4).map(Number);
const outputPath = process.argv[4] || 'data/movo.sqlite';
const DAYS = 45; // lo mismo que revisa la primera lectura de Gmail
const DAY_MS = 86400e3;

if (!Number.isInteger(count) || count < 0 || !Number.isInteger(seed)) {
  throw new Error('Uso: npm run db:sqlite -- <cantidad> <semilla> [archivo]');
}

const SQL = await initSqlJs();
const db = new SQL.Database();
const services = createServices({
  storage: createSqliteStorage(db), // crea las tablas y los índices con las migraciones de la app
  mailSource: { listNewMailIds: async () => [], fetchMail: async () => ({}) },
  backend: {},
  buildDemoMails: () => [],
});

const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS);
const mails = buildDataset({ count, seed, days: DAYS, now: today }).map(({ mail }, index) => ({
  ...mail,
  id: `dataset-${seed}-${index}`,
  messageId: `<dataset-${seed}-${index}@movo.dataset>`,
}));
for (const mail of mails) services.readMail(mail);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, db.export());

const tables = db
  .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
  .values.map(([name]) => name);
const [[version]] = db.exec('PRAGMA user_version')[0].values;
console.log(`Movo · base SQLite recreada en ${outputPath}`);
console.log(`  esquema      versión ${version}: ${tables.join(', ')}`);
console.log(`  correos      ${mails.length} leídos (semilla ${seed})`);
console.log(`  movimientos  ${services.queries.countTransactions()}`);
