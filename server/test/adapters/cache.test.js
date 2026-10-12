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

  test('el contador de ventana suma de uno en uno', async () => {
    const cache = createInMemoryCache();
    assert.equal(await cache.incrementWindowCounter('visitas', 5), 1);
    assert.equal(await cache.incrementWindowCounter('visitas', 5), 2);
    assert.equal(await cache.incrementWindowCounter('otro', 5), 1);
  });
});

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
      incrementWindowCounter: async () => {
        throw new Error('Redis cayó');
      },
      close: async () => {},
    };
    const cache = createResilientCache({ redis: brokenRedis, memory: createInMemoryCache() });

    await cache.set('x', '1', 5);
    assert.equal(await cache.get('x'), '1');
    assert.equal(await cache.incrementWindowCounter('y', 5), 1);
  });

  test('con una dirección de Redis que no responde, el servidor sigue funcionando', async () => {
    const redis = createRedisCache('redis://127.0.0.1:1', {});
    const cache = createResilientCache({ redis, memory: createInMemoryCache() });

    await cache.set('x', '1', 5);
    assert.equal(await cache.get('x'), '1');
    assert.equal(await cache.incrementWindowCounter('y', 5), 1);
    await cache.close();
  });
});

describe('caché en Redis', { skip: !redisUrl && 'REDIS_URL no definido' }, () => {
  test('guarda con vencimiento y cuenta', async () => {
    const redis = createRedisCache(redisUrl, {});
    for (let attempt = 0; attempt < 50 && !redis.isReady(); attempt++) await wait(50);
    assert.ok(redis.isReady(), 'Redis listo');

    await redis.set('t:k', 'v', 2);
    assert.equal(await redis.get('t:k'), 'v');

    const counter = 't:n:' + Date.now();
    assert.equal(await redis.incrementWindowCounter(counter, 5), 1);
    assert.equal(await redis.incrementWindowCounter(counter, 5), 2);
    await redis.close();
  });
});
