import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryCache } from '../../src/adapters/cache/InMemoryCache.js';
import { createRedisCache } from '../../src/adapters/cache/RedisCache.js';
import { createResilientCache } from '../../src/adapters/cache/ResilientCache.js';

const redisUrl = process.env.REDIS_URL;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('caché en memoria', () => {
  test('guarda un valor y lo devuelve; lo que no existe devuelve null', async () => {
    const cache = createInMemoryCache();
    await cache.set('clave', 'valor', 5);
    assert.equal(await cache.get('clave'), 'valor');
    assert.equal(await cache.get('otra'), null);
  });

  test('un valor vencido ya no se devuelve', async () => {
    const cache = createInMemoryCache();
    await cache.set('clave', 'valor', -1);
    assert.equal(await cache.get('clave'), null);
  });

  runStructures(async () => createInMemoryCache());
});

/** La MISMA batería de estructuras corre contra la memoria y contra Redis real: las dos deben comportarse igual. */
function runStructures(openCache) {
  const unique = (name) => `t:${name}:${Date.now()}:${Math.random()}`;

  test('la ventana deslizante cuenta las solicitudes de cada clave', async () => {
    const cache = await openCache();
    const visits = unique('visitas');
    assert.equal(await cache.countInSlidingWindow(visits, 5), 1);
    assert.equal(await cache.countInSlidingWindow(visits, 5), 2);
    assert.equal(await cache.countInSlidingWindow(unique('otro'), 5), 1);
    await cache.close();
  });

  test('la ventana deslizante olvida las solicitudes que salieron de la ventana', async () => {
    const cache = await openCache();
    const visits = unique('ventana');
    await cache.countInSlidingWindow(visits, 0.3);
    await cache.countInSlidingWindow(visits, 0.3);
    await wait(400);
    assert.equal(await cache.countInSlidingWindow(visits, 0.3), 1);
    await cache.close();
  });

  test('un hash guarda varios campos, se reemplaza completo y devuelve null si no existe', async () => {
    const cache = await openCache();
    const key = unique('hash');
    assert.equal(await cache.getHash(key), null);

    await cache.setHash(key, { 'kind:transaction': 53, deleted: 2 }, 5);
    assert.deepEqual(await cache.getHash(key), { 'kind:transaction': '53', deleted: '2' });

    await cache.setHash(key, { deleted: 0 }, 5);
    assert.deepEqual(await cache.getHash(key), { deleted: '0' });
    await cache.close();
  });

  test('borrar una clave la invalida al momento, sin esperar su vencimiento', async () => {
    const cache = await openCache();
    const key = unique('borrar');
    await cache.setHash(key, { deleted: 1 }, 60);
    await cache.delete(key);
    assert.equal(await cache.getHash(key), null);
    await cache.close();
  });
}

describe('caché resistente', () => {
  test('sin Redis configurado, todo funciona en memoria', async () => {
    const cache = createResilientCache({ redis: null, memory: createInMemoryCache() });
    await cache.set('x', '1', 5);
    assert.equal(await cache.get('x'), '1');
    assert.equal(cache.isSharedCacheReady(), false);
  });

  test('si Redis se cae a mitad de camino, la caché sigue funcionando en memoria', async () => {
    const brokenRedis = {
      isReady: () => true,
      get: async () => {
        throw new Error('Redis cayó');
      },
      set: async () => {
        throw new Error('Redis cayó');
      },
      countInSlidingWindow: async () => {
        throw new Error('Redis cayó');
      },
      getHash: async () => {
        throw new Error('Redis cayó');
      },
      setHash: async () => {
        throw new Error('Redis cayó');
      },
      delete: async () => {
        throw new Error('Redis cayó');
      },
      close: async () => {},
    };
    const cache = createResilientCache({ redis: brokenRedis, memory: createInMemoryCache() });

    await cache.set('x', '1', 5);
    assert.equal(await cache.get('x'), '1');
    assert.equal(await cache.countInSlidingWindow('y', 5), 1);
    await cache.setHash('h', { a: 1 }, 5);
    assert.deepEqual(await cache.getHash('h'), { a: '1' });
    await cache.delete('h');
    assert.equal(await cache.getHash('h'), null);
  });

  test('invalidar borra también la copia en memoria que quedó mientras Redis estuvo caído', async () => {
    let redisUp = false;
    const redisData = new Map();
    const flakyRedis = {
      isReady: () => redisUp,
      getHash: async (key) => redisData.get(key) ?? null,
      setHash: async (key, fields) => redisData.set(key, fields),
      delete: async (key) => redisData.delete(key),
      close: async () => {},
    };
    const cache = createResilientCache({ redis: flakyRedis, memory: createInMemoryCache() });

    await cache.setHash('resumen', { deleted: 1 }, 60); // Redis caído: queda en memoria
    redisUp = true;
    await cache.delete('resumen');
    redisUp = false; // si Redis vuelve a caer, la memoria no debe devolver el resumen viejo
    assert.equal(await cache.getHash('resumen'), null);
  });

  test('con una dirección de Redis que no responde, el servidor sigue funcionando', async () => {
    const redis = createRedisCache('redis://127.0.0.1:1', {});
    const cache = createResilientCache({ redis, memory: createInMemoryCache() });

    await cache.set('x', '1', 5);
    assert.equal(await cache.get('x'), '1');
    assert.equal(await cache.countInSlidingWindow('y', 5), 1);
    await cache.close();
  });
});

describe('caché en Redis', { skip: !redisUrl && 'REDIS_URL no definido' }, () => {
  async function openRedis() {
    const redis = createRedisCache(redisUrl, {});
    for (let attempt = 0; attempt < 50 && !redis.isReady(); attempt++) await wait(50);
    assert.ok(redis.isReady(), 'Redis listo');
    return redis;
  }

  test('guarda con vencimiento', async () => {
    const redis = await openRedis();
    await redis.set('t:k', 'v', 2);
    assert.equal(await redis.get('t:k'), 'v');
    await redis.close();
  });

  runStructures(openRedis);
});
