import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { createCache } from '../src/cache.js';
import { memoryStore } from '../src/store.js';

const CLIENT = 'test-client.apps.googleusercontent.com';
const TOKENS = {
  'token-ana-xxxxxxxxxxxxxxxx': { sub: 'ana', aud: CLIENT, expires_in: 3000 },
  'token-beto-xxxxxxxxxxxxxxx': { sub: 'beto', aud: CLIENT, expires_in: 3000 },
  'token-otra-app-xxxxxxxxxxx': { sub: 'eva', aud: 'otra-app', expires_in: 3000 },
};
let verifyCalls = 0;
const verify = async (t) => { verifyCalls++; return TOKENS[t] || null; };

async function start(over = {}) {
  const cfg = { googleClientId: CLIENT, cloudSync: true, fxFallback: 510, rateLimitPerMin: 60, ...over };
  const app = buildApp({ cfg, cache: createCache(''), store: memoryStore(), verify });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { token, method = 'GET', body } = {}) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { call, close: () => server.close() };
}
const tx = (id, updatedAt, extra = {}) => ({ id, updatedAt, deleted: false, data: { date: '2026-10-05T12:00:00.000Z', amountCents: 150000, cur: 'CRC', crcCents: 150000, who: 'SODA', cat: 'comida', type: 'sinpe', dir: 'out', ...extra } });

test('config expone el client id y el estado del respaldo', async () => {
  const s = await start();
  const r = await s.call('/config');
  assert.equal(r.body.googleClientId, CLIENT);
  assert.equal(r.body.cloudSync, true);
  s.close();
});

test('sync exige token válido de ESTA aplicación', async () => {
  const s = await start();
  assert.equal((await s.call('/sync', { method: 'POST', body: {} })).status, 401);
  assert.equal((await s.call('/sync', { method: 'POST', token: 'token-desconocido-xxxxxxxx', body: {} })).status, 401);
  assert.equal((await s.call('/sync', { method: 'POST', token: 'token-otra-app-xxxxxxxxxxx', body: {} })).status, 401);
  s.close();
});

test('los datos quedan separados por usuario', async () => {
  const s = await start();
  const A = 'token-ana-xxxxxxxxxxxxxxxx', B = 'token-beto-xxxxxxxxxxxxxxx';
  const r1 = await s.call('/sync', { method: 'POST', token: A, body: { since: 0, changes: { tx: [tx('m1', 1000)] } } });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.changes.tx.length, 1);
  const rb = await s.call('/sync', { method: 'POST', token: B, body: { since: 0, changes: {} } });
  assert.equal(rb.body.changes.tx.length, 0, 'Beto no ve los movimientos de Ana');
  const del = await s.call('/me', { method: 'DELETE', token: B });
  assert.equal(del.body.deleted, 0, 'Beto no puede borrar datos de Ana');
  const ra = await s.call('/sync', { method: 'POST', token: A, body: { since: 0, changes: {} } });
  assert.equal(ra.body.changes.tx.length, 1);
  s.close();
});

test('gana el cambio más reciente y el cursor evita reenvíos', async () => {
  const s = await start();
  const A = 'token-ana-xxxxxxxxxxxxxxxx';
  const r1 = await s.call('/sync', { method: 'POST', token: A, body: { since: 0, changes: { tx: [tx('m1', 2000, { cat: 'super' })] } } });
  await s.call('/sync', { method: 'POST', token: A, body: { since: r1.body.cursor, changes: { tx: [tx('m1', 1000, { cat: 'ocio' })] } } });
  const all = await s.call('/sync', { method: 'POST', token: A, body: { since: 0, changes: {} } });
  assert.equal(all.body.changes.tx[0].data.cat, 'super', 'el cambio viejo no pisa al nuevo');
  const again = await s.call('/sync', { method: 'POST', token: A, body: { since: all.body.cursor, changes: {} } });
  assert.equal(again.body.changes.tx.length, 0);
  s.close();
});

test('valida y limpia lo que llega del teléfono', async () => {
  const s = await start();
  const A = 'token-ana-xxxxxxxxxxxxxxxx';
  const bad = await s.call('/sync', { method: 'POST', token: A, body: { changes: { tx: [{ ...tx('a', 1), id: '{"$gt":""}' }] } } });
  assert.equal(bad.status, 400);
  const r = await s.call('/sync', { method: 'POST', token: A, body: { changes: { tx: [tx('ok1', 5, { $where: 'x', hack: 1, type: 'robo' })], setting: [{ id: 'otra', updatedAt: 1, data: { v: 1 } }] } } });
  const d = r.body.changes.tx[0].data;
  assert.equal(d.hack, undefined); assert.equal(d.$where, undefined); assert.equal(d.type, 'transferencia');
  assert.equal(r.body.changes.setting.length, 0, 'solo ajustes conocidos');
  s.close();
});

test('el token se valida una vez y luego sale de la caché', async () => {
  const s = await start();
  const before = verifyCalls;
  for (let i = 0; i < 3; i++) await s.call('/sync', { method: 'POST', token: 'token-ana-xxxxxxxxxxxxxxxx', body: { changes: {} } });
  assert.equal(verifyCalls - before, 1);
  s.close();
});

test('límite de solicitudes por usuario', async () => {
  const s = await start({ rateLimitPerMin: 3 });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await s.call('/sync', { method: 'POST', token: 'token-beto-xxxxxxxxxxxxxxx', body: { changes: {} } })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  s.close();
});

test('tipo de cambio: valor de referencia si no hay BCCR', async () => {
  const s = await start();
  const r = await s.call('/fx');
  assert.equal(r.body.rate, 510);
  s.close();
});

test('sin respaldo habilitado, sync responde 404 y config lo indica', async () => {
  const s = await start({ cloudSync: false });
  assert.equal((await s.call('/config')).body.cloudSync, false);
  assert.equal((await s.call('/sync', { method: 'POST', token: 'token-ana-xxxxxxxxxxxxxxxx', body: {} })).status, 404);
  s.close();
});

test('el respaldo acepta movimientos "entre mis cuentas"', async () => {
  const s = await start();
  const r = await s.call('/sync', { method: 'POST', token: 'token-ana-xxxxxxxxxxxxxxxx', body: { changes: { tx: [tx('own', 9, { dir: 'self', cat: 'propias' })] } } });
  assert.equal(r.body.changes.tx[0].data.dir, 'self');
  s.close();
});
