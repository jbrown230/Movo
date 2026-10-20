// Caídas reales de Redis y MongoDB a mitad de ejecución, con la API completa encima.
// Un intermediario TCP (helpers/tcpProxy.js) se pone entre la API y el servicio, y se corta durante la prueba.
// Corren solo si hay Redis y MongoDB de verdad (REDIS_URL y MONGO_URL, como en GitHub Actions).
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApp } from '../../src/adapters/http/createHttpApp.js';
import { createInMemoryCache } from '../../src/adapters/cache/InMemoryCache.js';
import { createRedisCache } from '../../src/adapters/cache/RedisCache.js';
import { createResilientCache } from '../../src/adapters/cache/ResilientCache.js';
import { createMongoBackupStore } from '../../src/adapters/mongo/MongoBackupStore.js';
import { createTestUseCases, TOKENS } from '../helpers/fakes.js';
import { startTcpProxy } from '../helpers/tcpProxy.js';

const redisUrl = process.env.REDIS_URL;
const mongoUrl = process.env.MONGO_URL;
const BACKUP_UNAVAILABLE = 'Respaldo no disponible por ahora.';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const cleanups = [];
after(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

async function startApi(overrides) {
  const { useCases } = createTestUseCases(overrides);
  const server = await new Promise((resolve) => {
    const listening = createHttpApp({ useCases }).listen(0, '127.0.0.1', () => resolve(listening));
  });
  cleanups.push(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  /** Una solicitud, con lo que tardó. */
  return async function call(path, { token, method = 'GET', body } = {}) {
    const start = Date.now();
    const response = await fetch(baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json(), ms: Date.now() - start };
  };
}

const targetOf = (url) => {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port) };
};

describe('Redis se cae a mitad de ejecución', { skip: !redisUrl && 'REDIS_URL no definido' }, () => {
  test('la API sigue respondiendo el tipo de cambio, ahora con la caché en memoria', async () => {
    const proxy = await startTcpProxy(targetOf(redisUrl));
    const redis = createRedisCache(`redis://127.0.0.1:${proxy.port}`, {});
    cleanups.push(
      () => redis.close(),
      () => proxy.close(),
    );
    for (let attempt = 0; attempt < 100 && !redis.isReady(); attempt++) await wait(20);
    // Se vacía el tipo de cambio guardado (un Redis local puede traer el valor real del BCCR).
    for (const key of ['fx:usd', 'fx:usd:last']) await redis.set(key, '', 1);

    let sourceCalls = 0;
    const exchangeRateSource = {
      fetchLatestRate: async () => {
        sourceCalls++;
        return { rate: 505.5, date: '2026-01-15', source: 'prueba', euro: null, history: [] };
      },
    };
    const call = await startApi({
      cache: createResilientCache({ redis, memory: createInMemoryCache() }),
      exchangeRateSource,
    });

    assert.deepEqual((await call('/health')).body.redis, true, 'Redis arriba al empezar');
    assert.equal((await call('/fx')).body.rate, 505.5);

    await proxy.cut(); // Redis se cae

    const afterOutage = [];
    for (let index = 0; index < 5; index++) afterOutage.push(await call('/fx'));
    assert.ok(afterOutage.every((response) => response.status === 200 && response.body.rate === 505.5));
    assert.ok(
      afterOutage.every((response) => response.ms < 1000),
      'ninguna solicitud se queda esperando a Redis',
    );
    assert.equal(sourceCalls, 2, 'se consulta la fuente una vez más y luego sale de la memoria');
    assert.equal((await call('/health')).body.redis, false, 'el estado de salud dice que Redis no está');
  });
});

describe('MongoDB no responde', { skip: !mongoUrl && 'MONGO_URL no definido' }, () => {
  /** Respaldo en MongoDB pasando por un intermediario; `listening: false` lo crea con Mongo ya caído. */
  async function mongoBehindProxy(options) {
    const proxy = await startTcpProxy(targetOf(mongoUrl), options);
    const url = `mongodb://127.0.0.1:${proxy.port}/movo_test_caidas_${Date.now()}?directConnection=true`;
    const backupStore = createMongoBackupStore(url, {});
    cleanups.push(
      () => backupStore.close(),
      () => proxy.close(),
    );
    return { proxy, backupStore };
  }

  const sync = (call) =>
    call('/sync', {
      method: 'POST',
      token: TOKENS.ana,
      body: { since: 0, changes: { transactions: [], categoryRules: [], settings: [] } },
    });

  test('si Mongo se cae a mitad de ejecución, el respaldo responde 503 con un mensaje claro', async () => {
    const { proxy, backupStore } = await mongoBehindProxy();
    const call = await startApi({ backupStore });
    assert.equal((await sync(call)).status, 200, 'Mongo arriba al empezar');

    await proxy.cut(); // Mongo se cae

    const response = await sync(call);
    assert.equal(response.status, 503);
    assert.equal(response.body.error, BACKUP_UNAVAILABLE);
    assert.equal((await call('/health')).body.mongo, false);
    assert.equal((await call('/config')).status, 200, 'lo que no usa Mongo sigue funcionando');
  });

  test('si Mongo estaba caído al arrancar, el respaldo se recupera solo cuando vuelve', async () => {
    const { proxy, backupStore } = await mongoBehindProxy({ listening: false });
    const call = await startApi({ backupStore });

    const whileDown = await sync(call);
    assert.equal(whileDown.status, 503);
    assert.equal(whileDown.body.error, BACKUP_UNAVAILABLE);

    await proxy.restore(); // Mongo vuelve, sin reiniciar la API
    assert.equal((await sync(call)).status, 200);
  });
});
