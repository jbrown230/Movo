// Pruebas de la API completa: peticiones HTTP reales contra un servidor de prueba (todo en memoria).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApp } from '../../src/adapters/http/createHttpApp.js';
import { CLIENT_ID, createTestUseCases, TOKENS } from '../helpers/fakes.js';

const openServers = [];
after(() => openServers.forEach((server) => server.close()));

async function startApi(overrides = {}) {
  const { useCases, tokenVerifier } = createTestUseCases(overrides);
  const server = await new Promise((resolve) => {
    const listening = createHttpApp({ useCases }).listen(0, () => resolve(listening));
  });
  openServers.push(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function call(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  return { call, tokenVerifier, baseUrl };
}

const transaction = (id, updatedAt, data = {}) => ({
  id,
  updatedAt,
  isDeleted: false,
  data: {
    date: '2026-01-15T12:00:00.000Z',
    amountCents: 150000,
    currency: 'CRC',
    crcCents: 150000,
    counterparty: 'SODA',
    category: 'comida',
    type: 'sinpe',
    direction: 'out',
    ...data,
  },
});
const sync = (token, body) => ({ method: 'POST', token, body });

test('config expone el client id y el estado del respaldo', async () => {
  const api = await startApi();
  const { body } = await api.call('/config');
  assert.equal(body.googleClientId, CLIENT_ID);
  assert.equal(body.cloudSync, true);
});

test('health responde sin pedir token', async () => {
  const api = await startApi();
  const { status, body } = await api.call('/health');
  assert.equal(status, 200);
  assert.deepEqual(body, { ok: true, redis: false, mongo: true });
});

test('una ruta que no existe responde 404 en JSON', async () => {
  const api = await startApi();
  assert.deepEqual(await api.call('/no-existe'), { status: 404, body: { error: 'No encontrado.' } });
});

test('sync exige un token válido de ESTA aplicación', async () => {
  const api = await startApi();
  assert.equal((await api.call('/sync', sync(undefined, {}))).status, 401);
  assert.equal((await api.call('/sync', sync(TOKENS.unknown, {}))).status, 401);
  assert.equal((await api.call('/sync', sync(TOKENS.otherApp, {}))).status, 401);
});

test('los datos quedan separados por persona', async () => {
  const api = await startApi();
  const first = await api.call(
    '/sync',
    sync(TOKENS.ana, { since: 0, changes: { transactions: [transaction('m1', 1000)] } }),
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.changes.transactions.length, 1);

  const beto = await api.call('/sync', sync(TOKENS.beto, { since: 0, changes: {} }));
  assert.equal(beto.body.changes.transactions.length, 0, 'Beto no ve los movimientos de Ana');
  assert.equal((await api.call('/me', { method: 'DELETE', token: TOKENS.beto })).body.deleted, 0, 'ni puede borrarlos');

  const ana = await api.call('/sync', sync(TOKENS.ana, { since: 0, changes: {} }));
  assert.equal(ana.body.changes.transactions.length, 1);
});

test('gana el cambio más reciente y el cursor evita reenvíos', async () => {
  const api = await startApi();
  const first = await api.call(
    '/sync',
    sync(TOKENS.ana, { since: 0, changes: { transactions: [transaction('m1', 2000, { category: 'super' })] } }),
  );
  await api.call(
    '/sync',
    sync(TOKENS.ana, {
      since: first.body.cursor,
      changes: { transactions: [transaction('m1', 1000, { category: 'ocio' })] },
    }),
  );

  const everything = await api.call('/sync', sync(TOKENS.ana, { since: 0, changes: {} }));
  assert.equal(everything.body.changes.transactions[0].data.category, 'super', 'el cambio viejo no pisa al nuevo');

  const nothingNew = await api.call('/sync', sync(TOKENS.ana, { since: everything.body.cursor, changes: {} }));
  assert.equal(nothingNew.body.changes.transactions.length, 0);
  assert.equal(nothingNew.body.hasMore, false);
});

test('un registro eliminado viaja marcado como eliminado', async () => {
  const api = await startApi();
  await api.call(
    '/sync',
    sync(TOKENS.ana, { changes: { transactions: [{ ...transaction('m1', 5), isDeleted: true }] } }),
  );
  const { body } = await api.call('/sync', sync(TOKENS.ana, { since: 0, changes: {} }));
  assert.equal(body.changes.transactions[0].isDeleted, true);
});

test('el respaldo acepta reglas de categoría y ajustes conocidos', async () => {
  const api = await startApi();
  const rule = {
    id: 'NETFLIX',
    updatedAt: 3,
    isDeleted: false,
    data: { counterpartyKey: 'NETFLIX', category: 'ocio' },
  };
  const budget = { id: 'budget', updatedAt: 3, isDeleted: false, data: { value: 40_000_000 } };
  await api.call('/sync', sync(TOKENS.ana, { changes: { categoryRules: [rule], settings: [budget] } }));

  const { body } = await api.call('/sync', sync(TOKENS.ana, { since: 0, changes: {} }));
  assert.deepEqual(body.changes.categoryRules[0].data, { counterpartyKey: 'NETFLIX', category: 'ocio' });
  assert.deepEqual(body.changes.settings[0].data, { value: 40_000_000 });
});

test('valida y limpia lo que llega del teléfono', async () => {
  const api = await startApi();
  const injectedId = { ...transaction('a', 1), id: '{"$gt":""}' };
  assert.equal((await api.call('/sync', sync(TOKENS.ana, { changes: { transactions: [injectedId] } }))).status, 400);

  const dirty = transaction('ok1', 5, { $where: 'x', hack: 1, type: 'robo' });
  const unknownSetting = { id: 'otra', updatedAt: 1, data: { value: 1 } };
  const { body } = await api.call(
    '/sync',
    sync(TOKENS.ana, { changes: { transactions: [dirty], settings: [unknownSetting] } }),
  );

  const stored = body.changes.transactions[0].data;
  assert.equal(stored.hack, undefined);
  assert.equal(stored.$where, undefined);
  assert.equal(stored.type, 'transferencia');
  assert.equal(body.changes.settings.length, 0, 'solo ajustes conocidos');
});

test('rechaza listas mal formadas y demasiados cambios', async () => {
  const api = await startApi();
  assert.equal((await api.call('/sync', sync(TOKENS.ana, { changes: { transactions: 'no-es-lista' } }))).status, 400);

  const tooMany = Array.from({ length: 501 }, (_, index) => transaction(`m${index}`, 5));
  assert.equal((await api.call('/sync', sync(TOKENS.ana, { changes: { transactions: tooMany } }))).status, 400);
});

test('un JSON mal formado responde 400, no 500', async () => {
  const api = await startApi();
  const response = await fetch(api.baseUrl + '/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKENS.ana },
    body: '{esto no es json',
  });
  assert.equal(response.status, 400);
});

test('el token se valida una vez y luego sale de la caché', async () => {
  const api = await startApi();
  for (let attempt = 0; attempt < 3; attempt++) await api.call('/sync', sync(TOKENS.ana, { changes: {} }));
  assert.equal(api.tokenVerifier.callCount, 1);
});

test('límite de solicitudes por persona', async () => {
  const api = await startApi({ settings: { requestsPerMinute: 3 } });
  const codes = [];
  for (let attempt = 0; attempt < 5; attempt++)
    codes.push((await api.call('/sync', sync(TOKENS.beto, { changes: {} }))).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('tipo de cambio: valor de referencia si no hay BCCR', async () => {
  const api = await startApi();
  assert.equal((await api.call('/fx')).body.rate, 510);
});

test('sin respaldo habilitado, sync responde 404 y config lo indica', async () => {
  const api = await startApi({ settings: { cloudSync: false } });
  assert.equal((await api.call('/config')).body.cloudSync, false);
  assert.equal((await api.call('/sync', sync(TOKENS.ana, {}))).status, 404);
  assert.equal((await api.call('/me', { method: 'DELETE', token: TOKENS.ana })).status, 404);
});

test('el respaldo acepta movimientos "entre mis cuentas"', async () => {
  const api = await startApi();
  const ownTransfer = transaction('own', 9, { direction: 'self', category: 'propias' });
  const { body } = await api.call('/sync', sync(TOKENS.ana, { changes: { transactions: [ownTransfer] } }));
  assert.equal(body.changes.transactions[0].data.direction, 'self');
});
