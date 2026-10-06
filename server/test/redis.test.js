// Se ejecuta solo si hay un Redis disponible en REDIS_URL (por ejemplo, en docker compose).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/cache.js';

const url = process.env.REDIS_URL;
test('caché en Redis: set/get con TTL y contador', { skip: !url && 'REDIS_URL no definido' }, async () => {
  const c = createCache(url, {});
  for (let i = 0; i < 50 && !c.ready(); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(c.ready(), 'Redis listo');
  await c.set('t:k', 'v', 2);
  assert.equal(await c.get('t:k'), 'v');
  const k = 't:n:' + Date.now();
  assert.equal(await c.hit(k, 5), 1); assert.equal(await c.hit(k, 5), 2);
  await c.close();
});

test('si Redis se cae, la caché sigue funcionando en memoria', async () => {
  const c = createCache('redis://127.0.0.1:1', {});
  await c.set('x', '1', 5);
  assert.equal(await c.get('x'), '1');
  assert.equal(await c.hit('y', 5), 1);
  await c.close();
});
