// Medición del respaldo en MongoDB: explain() de la sincronización y del resumen (aggregation pipeline),
// con y sin índice, y el resumen con y sin la caché de Redis.
// Uso: npm run bench:mongo                 (200 personas con 500 registros cada una = 100.000 documentos)
//      npm run bench:mongo -- 500 1000     (500 personas con 1000 registros)
//
// Necesita MONGO_URL (y REDIS_URL para la parte de la caché) en el .env. Trabaja en una base aparte,
// "movo_bench", que borra al terminar: nunca toca los respaldos de la base configurada.
// "Sin índice" no borra los índices: fuerza el recorrido de la colección con hint({ $natural: 1 }).
import { createRequire } from 'node:module';
import {
  backupSummaryPipeline,
  changesAfterQuery,
  createMongoBackupStore,
} from '../server/src/adapters/mongo/MongoBackupStore.js';
import { createInMemoryCache } from '../server/src/adapters/cache/InMemoryCache.js';
import { createRedisCache } from '../server/src/adapters/cache/RedisCache.js';
import { createResilientCache } from '../server/src/adapters/cache/ResilientCache.js';
import { createGetBackupSummary } from '../server/src/application/getBackupSummary.js';
import { MAX_RECORDS_PER_RESPONSE } from '../shared/backupContract.js';

// El controlador de MongoDB es dependencia del servidor (server/node_modules), no de la raíz.
const { MongoClient } = createRequire(new URL('../server/package.json', import.meta.url))('mongodb');

const [userCount = 200, recordsPerUser = 500] = process.argv.slice(2, 4).map(Number);
const RUNS = 5;
const MIN_RUN_MS = 300;
const BENCH_DATABASE = 'movo_bench';
const MEASURED_USER = 'persona-0';
const NO_INDEX = { $natural: 1 };

if (!process.env.MONGO_URL) throw new Error('Falta MONGO_URL en el .env (ver .env.example).');
const benchUrl = new URL(process.env.MONGO_URL);
benchUrl.pathname = `/${BENCH_DATABASE}`;

const median = (values) => {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function measure(operation) {
  await operation(); // calentamiento
  const perRun = [];
  for (let run = 0; run < RUNS; run++) {
    let repetitions = 0;
    const startedAt = performance.now();
    do {
      await operation();
      repetitions++;
    } while (performance.now() - startedAt < MIN_RUN_MS);
    perRun.push((performance.now() - startedAt) / repetitions);
  }
  return { median: median(perRun), min: Math.min(...perRun), max: Math.max(...perRun) };
}

const transactionData = (index) => ({
  date: new Date(Date.UTC(2026, 0, 1) + index * 3600e3).toISOString(),
  amountCents: 100000 + index,
  currency: 'CRC',
  crcCents: 100000 + index,
  exchangeRate: null,
  counterparty: 'COMERCIO DE PRUEBA',
  category: ['comida', 'super', 'transporte', 'ocio'][index % 4],
  categoryOrigin: null,
  type: 'tarjeta',
  direction: 'out',
  bank: 'BAC',
  mailKey: null,
  note: null,
});

/** Registros sintéticos de una persona: casi todos movimientos, algunas reglas y ajustes, y un 5 % eliminados. */
function recordsFor(count) {
  return Array.from({ length: count }, (_, index) => {
    if (index % 50 === 1) {
      const key = `COMERCIO ${index}`;
      return {
        kind: 'category_rule',
        id: key,
        updatedAt: index + 1,
        isDeleted: false,
        data: { counterpartyKey: key, category: 'comida' },
      };
    }
    if (index === 2)
      return { kind: 'setting', id: 'budget', updatedAt: index + 1, isDeleted: false, data: { value: 40000000 } };
    return {
      kind: 'transaction',
      id: `m${index}`,
      updatedAt: index + 1,
      isDeleted: index % 20 === 0,
      data: transactionData(index),
    };
  });
}

/** Etapas del plan ganador (IXSCAN, COLLSCAN, FETCH, GROUP…), buscadas en todo el explain. */
function planStages(explain) {
  const stages = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.stage === 'string') stages.push(node.indexName ? `${node.stage} (${node.indexName})` : node.stage);
    for (const value of Object.values(node)) visit(value);
  };
  const findWinningPlans = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.winningPlan) visit(node.winningPlan);
    else for (const value of Object.values(node)) findWinningPlans(value);
  };
  findWinningPlans(explain);
  // En un aggregate, lo que no se resuelve con el índice aparece después, en `stages` ($group, $sort…).
  const pipelineStages = (explain.stages ?? [])
    .map((stage) => Object.keys(stage)[0])
    .filter((name) => name !== '$cursor');
  return [...new Set(stages)].join(' → ') + pipelineStages.map((name) => ` → ${name}`).join('');
}

function executionStats(explain) {
  let stats = null;
  const find = (node) => {
    if (stats || !node || typeof node !== 'object') return;
    if (node.executionStats) stats = node.executionStats;
    else for (const value of Object.values(node)) find(value);
  };
  find(explain);
  return stats;
}

function printExplain(label, explain) {
  const stats = executionStats(explain);
  console.log(`  ${label}`);
  console.log(`    plan              ${planStages(explain)}`);
  console.log(
    `    claves leídas     ${stats.totalKeysExamined} · documentos leídos ${stats.totalDocsExamined} · devueltos ${stats.nReturned}`,
  );
  return stats;
}

const client = new MongoClient(benchUrl.toString());
const store = createMongoBackupStore(benchUrl.toString(), {}); // crea la colección con su validador y sus índices
try {
  // ---- 1. Carga ----
  await client.connect();
  const db = client.db();
  await db.collection('backup_records').deleteMany({});
  const startedAt = performance.now();
  for (let user = 0; user < userCount; user++) await store.saveChanges(`persona-${user}`, recordsFor(recordsPerUser));
  const records = db.collection('backup_records');
  const total = await records.countDocuments();
  console.log(`\nMovo · MongoDB con ${userCount} personas × ${recordsPerUser} registros = ${total} documentos`);
  console.log(
    `Carga con el almacén real en ${((performance.now() - startedAt) / 1000).toFixed(1)} s · ${RUNS} ejecuciones por medición\n`,
  );
  console.log('Índices:', (await records.indexes()).map((index) => JSON.stringify(index.key)).join(', '), '\n');

  // ---- 2. Sincronización: lo de una persona después de su cursor ----
  const [middle] = await records
    .find({ userId: MEASURED_USER })
    .sort({ serverSequence: 1 })
    .skip(Math.floor(recordsPerUser / 2))
    .limit(1)
    .toArray();
  const syncCases = [
    { name: 'Sincronización completa (cursor 0)', cursor: 0 },
    { name: 'Sincronización a mitad (cursor en el registro del medio)', cursor: middle.serverSequence },
  ];
  const syncFind = ({ cursor }, hint) => {
    const { filter, sort } = changesAfterQuery(MEASURED_USER, cursor);
    const cursorQuery = records
      .find(filter, { projection: { _id: 0, userId: 0 } })
      .sort(sort)
      .limit(MAX_RECORDS_PER_RESPONSE);
    return hint ? cursorQuery.hint(hint) : cursorQuery;
  };
  const summaryAggregate = (hint) => records.aggregate(backupSummaryPipeline(MEASURED_USER), hint ? { hint } : {});

  const rows = [];
  console.log('## explain("executionStats")\n');
  for (const syncCase of syncCases) {
    console.log(syncCase.name);
    for (const [label, hint] of [
      ['con índice', null],
      ['sin índice', NO_INDEX],
    ]) {
      printExplain(label, await syncFind(syncCase, hint).explain('executionStats'));
      const time = await measure(() => syncFind(syncCase, hint).toArray());
      rows.push({ query: syncCase.name, label, ...time });
      console.log(
        `    mediana           ${time.median.toFixed(2)} ms (mín. ${time.min.toFixed(2)}, máx. ${time.max.toFixed(2)})`,
      );
    }
    console.log();
  }

  console.log('Resumen del respaldo (aggregation pipeline)');
  for (const [label, hint] of [
    ['con índice', null],
    ['sin índice', NO_INDEX],
  ]) {
    printExplain(label, await summaryAggregate(hint).explain('executionStats'));
    const time = await measure(() => summaryAggregate(hint).toArray());
    rows.push({ query: 'Resumen del respaldo (pipeline)', label, ...time });
    console.log(
      `    mediana           ${time.median.toFixed(2)} ms (mín. ${time.min.toFixed(2)}, máx. ${time.max.toFixed(2)})`,
    );
  }
  console.log('  resultado', JSON.stringify(await summaryAggregate().toArray()), '\n');

  console.log('## Comparación (mediana, ms)\n');
  console.log('| Consulta | Con índice | Sin índice (COLLSCAN) | Veces más lenta sin índice |');
  console.log('|---|---|---|---|');
  for (const query of [...new Set(rows.map((row) => row.query))]) {
    const withIndex = rows.find((row) => row.query === query && row.label === 'con índice').median;
    const without = rows.find((row) => row.query === query && row.label === 'sin índice').median;
    console.log(`| ${query} | ${withIndex.toFixed(2)} | ${without.toFixed(2)} | ${(without / withIndex).toFixed(1)} |`);
  }

  // ---- 3. Resumen con y sin la caché de Redis (hash bk:summary:<persona>) ----
  if (process.env.REDIS_URL) {
    const redis = createRedisCache(process.env.REDIS_URL, {});
    for (let attempt = 0; attempt < 50 && !redis.isReady(); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    const cache = createResilientCache({ redis, memory: createInMemoryCache() });
    const getBackupSummary = createGetBackupSummary({ backupStore: store, cache });
    const noCache = await measure(async () => {
      await cache.delete(`bk:summary:${MEASURED_USER}`); // invalidación explícita: obliga a correr el pipeline
      return getBackupSummary(MEASURED_USER);
    });
    await getBackupSummary(MEASURED_USER);
    const withCache = await measure(() => getBackupSummary(MEASURED_USER));
    await cache.delete(`bk:summary:${MEASURED_USER}`);
    await cache.close();
    console.log('\n## Resumen del respaldo con y sin Redis (caso de uso completo)\n');
    console.log(`  sin caché (invalidar + pipeline + guardar hash)  mediana ${noCache.median.toFixed(2)} ms`);
    console.log(`  con el hash en Redis                            mediana ${withCache.median.toFixed(2)} ms`);
    console.log(`  ${(noCache.median / withCache.median).toFixed(1)} veces más rápido con Redis\n`);
  }
} finally {
  await client
    .db()
    .dropDatabase()
    .catch(() => {});
  await Promise.all([client.close(), store.close()]);
}
