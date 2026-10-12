// Medición reproducible del lector de correos y de la base local.
// Uso: npm run bench            (por defecto, 2000 correos)
//      node scripts/bench-parser.mjs 10000
import initSqlJs from 'sql.js';
import { parseFirstApproved } from '../web/src/domain/emailParser/parseMail.js';
import { buildBankMail } from '../web/src/demo/mailBuilder.js';
import { MERCHANTS, PEOPLE } from '../web/src/demo/sampleData.js';
import { createSqliteStorage } from '../web/src/infrastructure/sqlite/createSqliteStorage.js';
import { createServices } from '../web/src/application/createServices.js';

const MAIL_COUNT = Number(process.argv[2] || 2000);
const EXCHANGE_RATE = 510;
const SUMMARY_RUNS = 20;
const DUPLICATE_SAMPLE = 500;
const MS_PER_DAY = 86400e3;

// Generador de números al azar con semilla fija: el benchmark da siempre los mismos correos.
let seed = 42;
const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(random() * list.length)];

function buildCases() {
  const now = Date.now();
  return Array.from({ length: MAIL_COUNT }, () => {
    const bank = pick(['BAC', 'BN', 'BCR']);
    const type = pick(['sinpe', 'tarjeta']);
    const direction = type === 'sinpe' && random() < 0.2 ? 'in' : 'out';
    const currency = type === 'tarjeta' && random() < 0.15 ? 'USD' : 'CRC';
    const amount = currency === 'USD' ? Math.round(random() * 20000) / 100 + 1 : Math.round(random() * 9_000_000) / 100 + 100;
    const counterparty = type === 'sinpe' ? pick(PEOPLE) : pick(MERCHANTS);
    const date = new Date(now - Math.floor(random() * 25) * MS_PER_DAY);
    date.setSeconds(0, 0);

    return {
      expected: { type, direction, currency, amountCents: Math.round(amount * 100), counterparty, date: date.toISOString(), bank },
      mail: buildBankMail({ bank, type, direction, counterparty, amount, currency, date: date.toISOString() }),
    };
  });
}

function measureAccuracy(cases) {
  const correct = { monto: 0, comercio: 0, fecha: 0, tipo: 0, direccion: 0, todo: 0 };
  const startedAt = performance.now();
  for (const { mail, expected } of cases) {
    const parsed = parseFirstApproved(mail);
    if (!parsed.ok) continue;
    const checks = {
      monto: parsed.amountCents === expected.amountCents && parsed.currency === expected.currency,
      comercio: parsed.counterparty === expected.counterparty,
      fecha: parsed.date === expected.date,
      tipo: parsed.type === expected.type,
      direccion: parsed.direction === expected.direction,
    };
    for (const [field, isCorrect] of Object.entries(checks)) correct[field] += isCorrect;
    correct.todo += Object.values(checks).every(Boolean);
  }
  return { correct, parseMs: performance.now() - startedAt };
}

async function measureDatabase(cases) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const services = createServices({
    storage: createSqliteStorage(db),
    mailSource: { listNewMailIds: async () => [], fetchMail: async () => ({}) },
    backend: {},
  });

  let startedAt = performance.now();
  for (const { mail } of cases) services.readMail(mail);
  const ingestMs = performance.now() - startedAt;

  startedAt = performance.now();
  for (let run = 0; run < SUMMARY_RUNS; run++) services.queries.getMonthSummary();
  const summaryMs = (performance.now() - startedAt) / SUMMARY_RUNS;

  startedAt = performance.now();
  for (const { mail } of cases.slice(0, DUPLICATE_SAMPLE)) services.readMail(mail);
  const duplicatesMs = performance.now() - startedAt;

  return {
    ingestMs, summaryMs, duplicatesMs,
    transactionCount: services.queries.countTransactions(),
    sizeKb: db.export().length / 1024,
  };
}

const cases = buildCases();
const { correct, parseMs } = measureAccuracy(cases);
const database = await measureDatabase(cases);
const percent = (n) => ((n / MAIL_COUNT) * 100).toFixed(2) + ' %';

console.log(`\nMovo · benchmark con ${MAIL_COUNT} correos sintéticos (semilla fija)\n`);
console.log('Precisión del lector');
for (const [field, count] of Object.entries(correct)) console.log(`  ${field.padEnd(10)} ${percent(count)}`);
console.log('\nRendimiento (en este equipo)');
console.log(`  lectura          ${((parseMs / MAIL_COUNT) * 1000).toFixed(1)} µs por correo`);
console.log(`  ingesta SQLite   ${(database.ingestMs / MAIL_COUNT).toFixed(3)} ms por correo (${MAIL_COUNT} en ${database.ingestMs.toFixed(0)} ms)`);
console.log(`  resumen del mes  ${database.summaryMs.toFixed(2)} ms con ${database.transactionCount} movimientos`);
console.log(`  duplicados       ${(database.duplicatesMs / DUPLICATE_SAMPLE).toFixed(3)} ms por correo repetido (descartado)`);
console.log(`  tamaño de la base ${database.sizeKb.toFixed(0)} KB\n`);
