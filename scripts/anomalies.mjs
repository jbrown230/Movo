// Mide el prototipo de cargos anómalos (issue 31) sobre el dataset sintético de scripts/dataset.mjs.
// Uso: npm run anomalias                  (30 semillas, 400 correos en 90 días por semilla)
//      node scripts/anomalies.mjs 20 600  (semillas, correos por semilla)
//
// Cada semilla simula a una persona durante 90 días. Los correos pasan por el lector y las categorías
// reales, igual que en la app. Se corre dos veces:
//   1. Sin cargos raros: todo lo que se marque es un falso positivo.
//   2. Con un 2 % de gastos inflados (con etiqueta): se mide qué se detecta y qué se escapa.
// Resultados comentados en docs/ANOMALIAS.md.
import { parseFirstApproved } from '../web/src/domain/emailParser/parseMail.js';
import { categorize } from '../web/src/domain/categories.js';
import { ANOMALY_DEFAULTS, AnomalyBasis, detectAnomalies } from '../web/src/domain/anomalies.js';
import { buildDataset } from './dataset.mjs';

const SEEDS = Number(process.argv[2] || 30);
const MAILS_PER_SEED = Number(process.argv[3] || 400);
const DAYS = 90;
const ANOMALY_RATE = 0.02;
const THRESHOLDS = [2.5, 3, 3.5, 4, 5];
const NOW = new Date('2026-10-20T12:00:00Z');

/** Correos → movimientos, con el lector y las categorías de la app. Guarda la etiqueta de cada uno. */
function toTransactions(dataset) {
  const labels = new Map();
  const transactions = dataset.map((entry, index) => {
    const parsed = parseFirstApproved(entry.mail);
    if (!parsed.ok) throw new Error(`El lector no reconoció el correo ${index}: ${parsed.reason}`);
    const id = `t${index}`;
    labels.set(id, entry);
    return {
      id,
      date: parsed.date,
      crcCents: parsed.amountCents, // el dataset es todo en colones
      counterparty: parsed.counterparty,
      category: categorize(parsed).category,
      direction: parsed.direction,
    };
  });
  return { transactions, labels };
}

const buildRuns = (anomalyRate) =>
  Array.from({ length: SEEDS }, (_, seed) =>
    toTransactions(buildDataset({ count: MAILS_PER_SEED, seed: seed + 1, days: DAYS, anomalyRate, now: NOW })),
  );

const countUp = (counts, key) => (counts[key] = (counts[key] ?? 0) + 1);

/** Grupos en los que se cuenta un cargo inflado, para medir la detección de cada uno. */
function groupsOf(entry, result) {
  const hasHistory = result.basis !== AnomalyBasis.NONE;
  const groups = [entry.anomaly.kind, entry.type];
  if (!hasHistory) groups.push('sin historial');
  if (hasHistory && entry.type === 'tarjeta') groups.push(`${entry.anomaly.kind} en tarjeta con historial`);
  return groups;
}

function evaluate(runs, options) {
  const totals = { judged: 0, coldStart: 0, flagged: 0, truePositives: 0, falsePositives: 0, labeled: 0 };
  const labeledBy = {};
  const detectedBy = {};
  const falsePositivesByBasis = {};
  const falsePositivesByCounterparty = {};

  const tally = (entry, result) => {
    totals[result.basis === AnomalyBasis.NONE ? 'coldStart' : 'judged']++;
    if (result.isAnomaly) totals.flagged++;
    if (!entry.anomaly) {
      if (!result.isAnomaly) return;
      totals.falsePositives++;
      countUp(falsePositivesByBasis, result.basis);
      countUp(falsePositivesByCounterparty, entry.counterparty);
      return;
    }
    totals.labeled++;
    if (result.isAnomaly) totals.truePositives++;
    for (const group of groupsOf(entry, result)) {
      countUp(labeledBy, group);
      if (result.isAnomaly) countUp(detectedBy, group);
    }
  };

  for (const { transactions, labels } of runs) {
    for (const result of detectAnomalies(transactions, options)) tally(labels.get(result.id), result);
  }
  const recallOf = (group) => percent(detectedBy[group] ?? 0, labeledBy[group] ?? 0);
  return { ...totals, labeledBy, recallOf, falsePositivesByBasis, falsePositivesByCounterparty };
}

const percent = (part, whole) => (whole ? ((part / whole) * 100).toFixed(1) + ' %' : '—');
const months = (SEEDS * DAYS) / 30;
const perMonth = (count) => (count / months).toFixed(2);
const row = (cells, widths) => '   ' + cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
const listCounts = (counts) =>
  Object.entries(counts)
    .sort((first, second) => second[1] - first[1])
    .map(([name, count]) => `${name} ${count}`)
    .join(', ') || '—';

const cleanRuns = buildRuns(0);
const injectedRuns = buildRuns(ANOMALY_RATE);
const CONFIGS = [
  ['solo comercio (por defecto)', { categoryFallback: false }],
  ['comercio + categoría', { categoryFallback: true }],
];

console.log(`\nMovo · cargos anómalos: ${SEEDS} personas simuladas × ${MAILS_PER_SEED} correos en ${DAYS} días`);
console.log(
  `Fijo: historial mínimo ${ANOMALY_DEFAULTS.minHistory}, dispersión mínima ${ANOMALY_DEFAULTS.minSpread}, ` +
    `exceso mínimo ₡${ANOMALY_DEFAULTS.minExcessCents / 100}. Inflados: ${ANOMALY_RATE * 100} % de los gastos.`,
);

for (const [name, config] of CONFIGS) {
  console.log(`\n== ${name} ==`);
  const widths = [6, 8, 13, 10, 13, 9, 9, 9, 9];
  console.log(
    row(
      [
        'umbral',
        'juzgados',
        'sin historial',
        'FP (limpio)',
        'FP por mes',
        'precisión',
        'detección',
        'grosero',
        'moderado',
      ],
      widths,
    ),
  );
  for (const threshold of THRESHOLDS) {
    const clean = evaluate(cleanRuns, { ...config, threshold });
    const injected = evaluate(injectedRuns, { ...config, threshold });
    console.log(
      row(
        [
          threshold,
          clean.judged,
          clean.coldStart,
          percent(clean.falsePositives, clean.judged),
          perMonth(clean.falsePositives),
          percent(injected.truePositives, injected.flagged),
          percent(injected.truePositives, injected.labeled),
          injected.recallOf('grosero'),
          injected.recallOf('moderado'),
        ],
        widths,
      ),
    );
  }

  const reference = evaluate(injectedRuns, { ...config, threshold: ANOMALY_DEFAULTS.threshold });
  const clean = evaluate(cleanRuns, { ...config, threshold: ANOMALY_DEFAULTS.threshold });
  console.log(`   Con umbral ${ANOMALY_DEFAULTS.threshold}:`);
  console.log(
    `     detección por medio: tarjeta ${reference.recallOf('tarjeta')}, SINPE ${reference.recallOf('sinpe')}; ` +
      `inflados sin historial para juzgarlos: ${reference.labeledBy['sin historial'] ?? 0} de ${reference.labeled}`,
  );
  console.log(
    `     tarjeta con historial: grosero ${reference.recallOf('grosero en tarjeta con historial')}, ` +
      `moderado ${reference.recallOf('moderado en tarjeta con historial')}`,
  );
  console.log(`     FP (limpio) según la base: ${listCounts(clean.falsePositivesByBasis)}`);
  console.log(`     FP (limpio) por contraparte: ${listCounts(clean.falsePositivesByCounterparty)}`);
}
console.log('\nFP = falsos positivos. "limpio" = corrida sin cargos inflados.\n');
