// Medición de la base local (SQLite en sql.js): plan de cada consulta, con y sin índices, y respaldo.
// Uso: npm run bench:sqlite              (10.000 correos repartidos en un año)
//      npm run bench:sqlite -- 50000
//
// La base se llena con el lector real de la app (los mismos correos sintéticos de npm run bench, con
// semilla fija). Después, cada escenario abre una copia idéntica de esa base (db.export() → new Database),
// cambia los índices y mide las mismas consultas. Cada medición se repite RUNS veces y se reporta la mediana.
import initSqlJs from 'sql.js';
import { buildBankMail } from '../web/src/demo/mailBuilder.js';
import { MERCHANTS, PEOPLE } from '../web/src/demo/sampleData.js';
import { createSqliteStorage } from '../web/src/infrastructure/sqlite/createSqliteStorage.js';
import { createServices } from '../web/src/application/createServices.js';

const MAIL_COUNT = Number(process.argv[2] || 10000);
const NEW_MAILS = 500; // correos nuevos que se leen en cada escenario, para medir lo que cuestan los índices al escribir
const RUNS = 5;
const MIN_RUN_MS = 200; // cada ejecución repite la consulta hasta juntar al menos este tiempo
const DAYS = 365;
const MS_PER_DAY = 86400e3;

let seed = 42;
const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (list) => list[Math.floor(random() * list.length)];

function buildMails(count, prefix) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const bank = pick(['BAC', 'BN', 'BCR']);
    const type = pick(['sinpe', 'tarjeta']);
    const direction = type === 'sinpe' && random() < 0.2 ? 'in' : 'out';
    const currency = 'CRC';
    const amount = Math.round(random() * 9_000_000) / 100 + 100;
    const counterparty = type === 'sinpe' ? pick(PEOPLE) : pick(MERCHANTS);
    const date = new Date(now - Math.floor(random() * DAYS * MS_PER_DAY));
    date.setSeconds(0, 0);
    const mail = buildBankMail({ bank, type, direction, counterparty, amount, currency, date: date.toISOString() });
    return { ...mail, id: `${prefix}-${index}`, messageId: `<${prefix}-${index}@movo.bench>` };
  });
}

const openServices = (db) =>
  createServices({
    storage: createSqliteStorage(db),
    mailSource: { listNewMailIds: async () => [], fetchMail: async () => ({}) },
    backend: {},
    buildDemoMails: () => [],
  });

const median = (values) => {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Repite `operation` RUNS veces; cada vez, tantas repeticiones como quepan en MIN_RUN_MS. Devuelve ms por operación. */
function measure(operation) {
  operation(); // calentamiento
  const perRun = [];
  for (let run = 0; run < RUNS; run++) {
    let repetitions = 0;
    const startedAt = performance.now();
    do {
      operation();
      repetitions++;
    } while (performance.now() - startedAt < MIN_RUN_MS);
    perRun.push((performance.now() - startedAt) / repetitions);
  }
  return { median: median(perRun), min: Math.min(...perRun), max: Math.max(...perRun) };
}

function runStatement(db, sql, params) {
  const statement = db.prepare(sql);
  return () => {
    statement.bind(params);
    while (statement.step()) statement.get();
    statement.reset();
  };
}

const queryPlan = (db, sql, params) =>
  db
    .exec(`EXPLAIN QUERY PLAN ${sql}`, params)[0]
    .values.map((row) => row[3])
    .join(' · ');

// Las consultas principales de la app, copiadas de web/src/infrastructure/sqlite/*Repository.js.
function mainQueries(db) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY).toISOString();
  const [{ values }] = db.exec(
    'SELECT mail_key FROM transactions WHERE mail_key IS NOT NULL ORDER BY id LIMIT 1 OFFSET 777',
  );
  const mailKey = values[0][0];
  return [
    {
      name: 'Resumen del mes',
      where: 'transactionRepository.summarizeMonth',
      sql: `SELECT category, SUM(amount_crc_cents) AS total, COUNT(*) AS count FROM transactions
            WHERE is_deleted=0 AND direction=? AND occurred_at>=? AND occurred_at<?
            GROUP BY category ORDER BY total DESC`,
      params: ['out', monthStart, nextMonth],
    },
    {
      name: 'Lista de movimientos',
      where: 'transactionRepository.list (sin filtros)',
      sql: 'SELECT * FROM transactions WHERE is_deleted=0 ORDER BY occurred_at DESC LIMIT ?',
      params: [400],
    },
    {
      name: 'Lista de la última semana',
      where: 'transactionRepository.list (filtro de fechas)',
      sql: 'SELECT * FROM transactions WHERE is_deleted=0 AND occurred_at>=? AND occurred_at<? ORDER BY occurred_at DESC LIMIT ?',
      params: [weekAgo, now.toISOString(), 400],
    },
    {
      name: 'Movimientos de un correo',
      where: 'transactionRepository.listForMail',
      sql: 'SELECT * FROM transactions WHERE mail_key=? AND is_deleted=0 ORDER BY occurred_at',
      params: [mailKey],
    },
    {
      name: '¿Ya se leyó este correo?',
      where: 'mailRepository (antes de leer cada correo)',
      sql: 'SELECT 1 AS found FROM mails WHERE id=? OR (message_id IS NOT NULL AND message_id=?)',
      params: ['no-existe', mailKey],
    },
  ];
}

const SCENARIOS = [
  { name: 'Con los índices de la app', setup: () => {} },
  {
    name: 'Sin índices',
    setup: (db) =>
      db.exec(`DROP INDEX transactions_by_date; DROP INDEX transactions_by_mail_key; DROP INDEX mails_by_message_id;`),
  },
];

// ---- 1. Base de partida ----
const SQL = await initSqlJs();
const original = new SQL.Database();
const builder = openServices(original);
let startedAt = performance.now();
for (const mail of buildMails(MAIL_COUNT, 'bench')) builder.readMail(mail);
const buildSeconds = (performance.now() - startedAt) / 1000;
const transactionCount = builder.queries.countTransactions();
const snapshot = original.export();
const newMails = buildMails(NEW_MAILS, 'nuevo');

console.log(`\nMovo · SQLite con ${MAIL_COUNT} correos en ${DAYS} días (${transactionCount} movimientos)`);
console.log(`Base armada con el lector real en ${buildSeconds.toFixed(1)} s · ${RUNS} ejecuciones por medición\n`);

// ---- 2. Plan y tiempo de cada consulta, por escenario ----
const results = [];
for (const scenario of SCENARIOS) {
  const db = new SQL.Database(snapshot);
  const services = openServices(db); // la base ya está migrada: no vuelve a crear los índices
  scenario.setup(db);

  console.log(`## ${scenario.name}\n`);
  for (const query of mainQueries(db)) {
    const plan = queryPlan(db, query.sql, query.params);
    const time = measure(runStatement(db, query.sql, query.params));
    results.push({ scenario: scenario.name, query: query.name, ...time });
    console.log(`${query.name} (${query.where})`);
    console.log(`  plan     ${plan}`);
    console.log(
      `  mediana  ${time.median.toFixed(3)} ms  (mín. ${time.min.toFixed(3)}, máx. ${time.max.toFixed(3)})\n`,
    );
  }

  // Leer correos nuevos: con índices hay que mantenerlos; sin índices, cada búsqueda de duplicados recorre la tabla.
  startedAt = performance.now();
  for (const mail of newMails) services.readMail(mail);
  const ingestMs = (performance.now() - startedAt) / NEW_MAILS;
  results.push({ scenario: scenario.name, query: `Leer ${NEW_MAILS} correos nuevos`, median: ingestMs });
  console.log(`Leer ${NEW_MAILS} correos nuevos: ${ingestMs.toFixed(3)} ms por correo\n`);
  db.close();
}

console.log('## Comparación (mediana, ms)\n');
console.log(`| Consulta | ${SCENARIOS.map((scenario) => scenario.name).join(' | ')} | Veces más lenta sin índices |`);
console.log(`|---|${SCENARIOS.map(() => '---').join('|')}|---|`);
for (const query of [...new Set(results.map((result) => result.query))]) {
  const times = SCENARIOS.map(
    (scenario) => results.find((result) => result.scenario === scenario.name && result.query === query).median,
  );
  console.log(
    `| ${query} | ${times.map((time) => time.toFixed(3)).join(' | ')} | ${(times[1] / times[0]).toFixed(1)} |`,
  );
}

// ---- 3. Respaldo: el equivalente a .backup en sql.js ----
// sql.js corre en memoria y no tiene archivo ni modo WAL. La app guarda la base completa en IndexedDB con
// db.export() (web/src/infrastructure/sqlite/openUserDatabase.js) y la abre con new SQL.Database(bytes).
const exportTime = measure(() => original.export());
const restoreTime = measure(() => new SQL.Database(snapshot).close());
const restored = new SQL.Database(snapshot);
const [[integrity]] = restored.exec('PRAGMA integrity_check')[0].values;
const [[restoredCount]] = restored.exec('SELECT COUNT(*) FROM transactions WHERE is_deleted=0')[0].values;

console.log('\n## Respaldo de la base (db.export)\n');
console.log(`  tamaño        ${(snapshot.length / 1024).toFixed(0)} KB`);
console.log(
  `  exportar      mediana ${exportTime.median.toFixed(2)} ms (mín. ${exportTime.min.toFixed(2)}, máx. ${exportTime.max.toFixed(2)})`,
);
console.log(
  `  restaurar     mediana ${restoreTime.median.toFixed(2)} ms (mín. ${restoreTime.min.toFixed(2)}, máx. ${restoreTime.max.toFixed(2)})`,
);
console.log(
  `  restaurada    ${restoredCount} movimientos (igual: ${restoredCount === transactionCount}), integrity_check: ${integrity}\n`,
);
