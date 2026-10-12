// Pruebas contra un MongoDB real. Se ejecutan si MONGO_URL está definido
// (en GitHub Actions y con docker compose). Usa una base de datos de prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mongoStore } from '../src/store.js';

const url = process.env.MONGO_URL;
test('MongoDB: separación por usuario, último en escribir gana y borrado', { skip: !url && 'MONGO_URL no definido' }, async () => {
  const u = new URL(url); u.pathname = '/movo_test_' + Date.now();
  const s = mongoStore(u.toString(), {});
  const rec = (id, updatedAt, cat) => ({ kind: 'tx', id, updatedAt, deleted: false, data: { cat } });
  await s.push('ana', [rec('m1', 2, 'super'), rec('m2', 1, 'ocio')]);
  await s.push('ana', [rec('m1', 1, 'viejo')]);          // más viejo: se ignora
  await s.push('beto', [rec('m1', 9, 'de-beto')]);       // mismo id, otro usuario
  const ana = await s.pull('ana', 0);
  assert.equal(ana.length, 2);
  assert.equal(ana.find((r) => r.id === 'm1').data.cat, 'super');
  assert.equal((await s.pull('beto', 0))[0].data.cat, 'de-beto');
  assert.equal(await s.wipe('ana'), 2);
  assert.equal((await s.pull('beto', 0)).length, 1);
  await s.close();
});
