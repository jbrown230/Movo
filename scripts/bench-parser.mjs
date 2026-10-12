// Medición reproducible del lector y de la base local.
// Uso: npm run bench            (por defecto 2000 correos)
//      node scripts/bench-parser.mjs 10000
import initSqlJs from 'sql.js';
import { parseEmail } from '../web/js/parser.js';
import { buildEmail, MERCHANTS, PEOPLE } from '../web/js/demo-emails.js';
import { migrate, createRepo } from '../web/js/repo.js';

const N = Number(process.argv[2] || 2000);
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const cases = [];
const now = Date.now();
for (let i = 0; i < N; i++) {
  const bank = pick(['BAC', 'BN', 'BCR']), type = pick(['sinpe', 'tarjeta']);
  const dir = type === 'sinpe' && rnd() < 0.2 ? 'in' : 'out';
  const cur = type === 'tarjeta' && rnd() < 0.15 ? 'USD' : 'CRC';
  const amount = cur === 'USD' ? Math.round(rnd() * 20000) / 100 + 1 : Math.round(rnd() * 9000000) / 100 + 100;
  const who = type === 'sinpe' ? pick(PEOPLE) : pick(MERCHANTS);
  const date = new Date(now - Math.floor(rnd() * 25) * 86400e3); date.setSeconds(0, 0);
  cases.push({ truth: { bank, type, dir, cur, cents: Math.round(amount * 100), who, date: date.toISOString() }, mail: buildEmail({ bank, type, dir, who, amount, cur, date: date.toISOString() }) });
}

const ok = { monto: 0, comercio: 0, fecha: 0, tipo: 0, direccion: 0, todo: 0 };
const t0 = performance.now();
for (const c of cases) {
  const p = parseEmail(c.mail), t = c.truth;
  if (!p.ok) continue;
  const m = p.amountCents === t.cents && p.cur === t.cur, w = p.who === t.who, f = p.date === t.date, ty = p.type === t.type, d = p.dir === t.dir;
  ok.monto += m; ok.comercio += w; ok.fecha += f; ok.tipo += ty; ok.direccion += d; ok.todo += m && w && f && ty && d;
}
const tParse = performance.now() - t0;

const SQL = await initSqlJs();
const db = new SQL.Database(); migrate(db); const repo = createRepo(db);
const t1 = performance.now();
for (const c of cases) repo.ingestMail(c.mail, { fx: 510 });
const tIngest = performance.now() - t1;
const t2 = performance.now(); for (let i = 0; i < 20; i++) repo.monthSummary(); const tSum = (performance.now() - t2) / 20;
const t3 = performance.now(); for (const c of cases.slice(0, 500)) repo.ingestMail(c.mail); const tDup = performance.now() - t3;

const pct = (n) => ((n / N) * 100).toFixed(2) + ' %';
console.log(`\nMovo · benchmark con ${N} correos sintéticos (semilla fija)\n`);
console.log('Precisión del lector');
for (const [k, v] of Object.entries(ok)) console.log(`  ${k.padEnd(10)} ${pct(v)}`);
console.log('\nRendimiento (en este equipo)');
console.log(`  lectura          ${(tParse / N * 1000).toFixed(1)} µs por correo`);
console.log(`  ingesta SQLite   ${(tIngest / N).toFixed(3)} ms por correo (${N} en ${tIngest.toFixed(0)} ms)`);
console.log(`  resumen del mes  ${tSum.toFixed(2)} ms con ${repo.counts().tx} movimientos`);
console.log(`  duplicados       ${(tDup / 500).toFixed(3)} ms por correo repetido (descartado)`);
console.log(`  tamaño de la base ${(db.export().length / 1024).toFixed(0)} KB\n`);
