// Medición del efecto de Redis en el tipo de cambio (issue 17 del backlog; resultados en docs/MEDICIONES.md).
//
// Levanta la API real en este mismo proceso con tres configuraciones y le hace solicitudes
// seguidas a GET /api/fx, midiendo el tiempo de cada una desde el cliente:
//   1. Sin caché: cada solicitud consulta al BCCR (la API real, con BCCR_TOKEN).
//   2. Caché en memoria del proceso: lo que usa la API cuando no hay Redis.
//   3. Redis: lo que usa la API en producción (REDIS_URL).
// El límite de solicitudes por minuto se deja activo (cuesta lo mismo que en producción), pero sin tope.
//
// Uso: node --env-file=.env scripts/bench-fx.mjs [solicitudes]     (por defecto, 200)
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { createUseCases } from '../server/src/application/createUseCases.js';
import { createBccrExchangeRateSource } from '../server/src/adapters/bccr/BccrExchangeRateSource.js';
import { createInMemoryCache } from '../server/src/adapters/cache/InMemoryCache.js';
import { createRedisCache } from '../server/src/adapters/cache/RedisCache.js';
import { createResilientCache } from '../server/src/adapters/cache/ResilientCache.js';
import { createHttpApp } from '../server/src/adapters/http/createHttpApp.js';

// El cliente de Redis está instalado en server/ (npm ci --prefix server), no en la raíz.
const { createClient } = createRequire(new URL('../server/package.json', import.meta.url))('redis');

const REQUESTS = Number(process.argv[2] || 200);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const BCCR_TOKEN = process.env.BCCR_TOKEN || '';
const EXCHANGE_RATE_KEYS = ['fx:usd', 'fx:usd:last']; // ver docs/ARQUITECTURA.md, "Claves en Redis"
const PERCENTILE_95 = 0.95;
const REDIS_READY_TIMEOUT_MS = 5000;
const READY_POLL_MS = 50;
/**
 * Pausa entre solicitudes sin caché. El BCCR rechaza con 429 más de unas 40 consultas por minuto, y cada
 * solicitud sin caché le hace dos (dólar y euro): sin pausa, casi todas terminan en el valor de reserva.
 */
const BCCR_PAUSE_MS = 3500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SETTINGS = { googleClientId: '', cloudSync: false, requestsPerMinute: 60, fallbackExchangeRate: 510 };
const quietLog = { info: () => {}, warn: () => {} };

/** Caché que nunca guarda nada: cada solicitud termina consultando al BCCR. */
const noCache = {
  get: async () => null,
  set: async () => {},
  incrementWindowCounter: async () => 1,
  isSharedCacheReady: () => false,
  close: async () => {},
};

// ---- estadísticas ----
const median = (sorted) =>
  sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted.at(sorted.length / 2 - 1) + sorted.at(sorted.length / 2)) / 2;
/** Percentil por rango más cercano sobre una lista ordenada. */
const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
const round2 = (value) => Math.round(value * 100) / 100;

function summarize(durations) {
  const sorted = [...durations].sort((first, second) => first - second);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    median: round2(median(sorted)),
    p95: round2(percentile(sorted, PERCENTILE_95)),
    mean: round2(mean),
    min: round2(sorted[0]),
    max: round2(sorted.at(-1)),
  };
}

// ---- la API con una caché dada ----
async function startApi(cache) {
  const exchangeRateSource = BCCR_TOKEN ? createBccrExchangeRateSource({ token: BCCR_TOKEN }) : null;
  const useCases = createUseCases({
    settings: SETTINGS,
    cache,
    backupStore: null,
    tokenVerifier: { verifyAccessToken: async () => null },
    exchangeRateSource,
    log: quietLog,
  });
  // El contador del límite se sigue incrementando en la caché, como en producción, pero sin tope.
  const ensureWithinLimit = (options) => useCases.ensureWithinLimit({ ...options, limitPerMinute: Infinity });
  const app = createHttpApp({ useCases: { ...useCases, ensureWithinLimit } });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  return { url: `http://127.0.0.1:${server.address().port}/api/fx`, close: () => server.close() };
}

/** Una solicitud medida. `fromBccr` es falso si la API respondió con el valor de reserva (el BCCR falló). */
async function timedRequest(url) {
  const start = performance.now();
  const response = await fetch(url);
  const body = await response.json();
  return { ms: performance.now() - start, ok: response.ok, fromBccr: Boolean(body.date) };
}

/** Primera solicitud (caché vacía) aparte, y luego `REQUESTS` solicitudes seguidas. */
async function measure(name, cache, { pauseMs = 0 } = {}) {
  const api = await startApi(cache);
  try {
    const first = await timedRequest(api.url);
    const results = [];
    for (let index = 0; index < REQUESTS; index++) {
      if (pauseMs) await sleep(pauseMs);
      results.push(await timedRequest(api.url));
    }
    return {
      name,
      firstMs: round2(first.ms),
      ...summarize(results.map((result) => result.ms)),
      httpErrors: results.filter((result) => !result.ok).length,
      bccrFailures: results.filter((result) => !result.fromBccr).length,
    };
  } finally {
    api.close();
  }
}

// ---- Redis ----
async function waitUntilReady(redis) {
  const deadline = Date.now() + REDIS_READY_TIMEOUT_MS;
  while (!redis.isReady()) {
    if (Date.now() > deadline) throw new Error(`Redis no responde en ${REDIS_URL}. Levántalo antes de medir.`);
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
}

/** Borra el tipo de cambio guardado, para que la primera solicitud consulte al BCCR. */
async function clearExchangeRateKeys() {
  const client = createClient({ url: REDIS_URL });
  await client.connect();
  await client.del(EXCHANGE_RATE_KEYS);
  await client.quit();
}

async function measureRedis() {
  await clearExchangeRateKeys();
  const redis = createRedisCache(REDIS_URL, quietLog);
  await waitUntilReady(redis);
  try {
    return await measure('Redis', createResilientCache({ redis, memory: createInMemoryCache() }));
  } finally {
    await redis.close();
  }
}

// ---- informe ----
function printTable(rows) {
  console.log(
    `\n${REQUESTS} solicitudes seguidas a GET /api/fx por escenario (tiempos en ms, medidos desde el cliente)\n`,
  );
  console.log('| Escenario | 1.ª solicitud | Mediana | p95 | Media | Mín. | Máx. | Errores HTTP | BCCR falló |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const cells = [
      row.name,
      row.firstMs,
      row.median,
      row.p95,
      row.mean,
      row.min,
      row.max,
      row.httpErrors,
      row.bccrFailures,
    ];
    console.log(`| ${cells.join(' | ')} |`);
  }
}

async function main() {
  if (!BCCR_TOKEN) {
    console.error(
      'Falta BCCR_TOKEN: sin él no se puede medir la consulta directa al BCCR. Ejecuta con --env-file=.env.',
    );
    process.exit(1);
  }
  const bccrMinutes = Math.ceil((REQUESTS * BCCR_PAUSE_MS) / 60_000);
  console.log(
    `Midiendo ${REQUESTS} solicitudes por escenario. Sin caché se espera entre una y otra: unos ${bccrMinutes} min…`,
  );
  const rows = [];
  rows.push(await measure('Caché en memoria', createInMemoryCache()));
  rows.push(await measureRedis());
  rows.push(await measure('Sin caché (BCCR directo)', noCache, { pauseMs: BCCR_PAUSE_MS }));
  printTable(rows);
}

await main();
