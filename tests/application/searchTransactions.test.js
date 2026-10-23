// Pruebas de la búsqueda de movimientos con filtros, sobre una base SQLite real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';

/** Inserta un movimiento con lo mínimo; `date` es la hora local del teléfono. */
function insert(storage, id, { date, crcCents, category = 'otros', direction = 'out', bank = 'BCR' }) {
  storage.transactions.insert({
    id,
    date: date.toISOString(),
    amountCents: crcCents,
    currency: 'CRC',
    crcCents,
    exchangeRate: null,
    counterparty: id.toUpperCase(),
    category,
    categoryOrigin: 'regla automática',
    type: 'tarjeta',
    direction,
    bank,
    mailKey: null,
    note: null,
  });
}

function sampleApp() {
  const app = createTestApp();
  insert(app.storage, 'cafe', {
    date: new Date(2026, 0, 14, 23, 50),
    crcCents: 250000,
    category: 'comida',
    bank: 'BAC',
  });
  insert(app.storage, 'super', {
    date: new Date(2026, 0, 15, 0, 5),
    crcCents: 1800000,
    category: 'super',
    bank: 'BCR',
  });
  insert(app.storage, 'salario', {
    date: new Date(2026, 0, 15, 9, 0),
    crcCents: 50000000,
    category: 'ingreso',
    direction: 'in',
    bank: 'BN',
  });
  insert(app.storage, 'uber', {
    date: new Date(2026, 0, 16, 22, 0),
    crcCents: 450000,
    category: 'transporte',
    bank: 'BAC',
  });
  return app;
}

const ids = (transactions) => transactions.map((transaction) => transaction.id).sort();

test('sin filtros devuelve todo, del más reciente al más antiguo', () => {
  const { queries } = sampleApp();
  assert.deepEqual(
    queries.searchTransactions({}).map((transaction) => transaction.id),
    ['uber', 'salario', 'super', 'cafe'],
  );
});

test('las fechas son días completos: incluye desde la medianoche hasta el final del día', () => {
  const { queries } = sampleApp();
  assert.deepEqual(ids(queries.searchTransactions({ fromDay: '2026-01-15', toDay: '2026-01-15' })), [
    'salario',
    'super',
  ]);
  assert.deepEqual(ids(queries.searchTransactions({ toDay: '2026-01-14' })), ['cafe']);
  assert.deepEqual(ids(queries.searchTransactions({ fromDay: '2026-01-16' })), ['uber']);
});

test('categoría, tipo y banco', () => {
  const { queries } = sampleApp();
  assert.deepEqual(ids(queries.searchTransactions({ category: 'comida' })), ['cafe']);
  assert.deepEqual(ids(queries.searchTransactions({ direction: 'in' })), ['salario']);
  assert.deepEqual(ids(queries.searchTransactions({ bank: 'BAC' })), ['cafe', 'uber']);
});

test('montos: mayores a, menores a y un rango (en colones, extremos incluidos)', () => {
  const { queries } = sampleApp();
  assert.deepEqual(ids(queries.searchTransactions({ minCents: 1800000 })), ['salario', 'super']);
  assert.deepEqual(ids(queries.searchTransactions({ maxCents: 450000 })), ['cafe', 'uber']);
  assert.deepEqual(ids(queries.searchTransactions({ minCents: 300000, maxCents: 2000000 })), ['super', 'uber']);
});

test('los filtros se combinan, y los vacíos no filtran', () => {
  const { queries } = sampleApp();
  const filters = { bank: 'BAC', direction: 'out', fromDay: '2026-01-15', category: '', minCents: null };
  assert.deepEqual(ids(queries.searchTransactions(filters)), ['uber']);
});

test('un movimiento eliminado no aparece', () => {
  const { queries, services } = sampleApp();
  services.deleteTransaction('uber');
  assert.deepEqual(ids(queries.searchTransactions({ bank: 'BAC' })), ['cafe']);
});

test('la búsqueda de texto encuentra parte del nombre sin importar mayúsculas, y se combina con otros filtros', () => {
  const { queries } = sampleApp();
  assert.deepEqual(ids(queries.searchTransactions({ text: 'ub' })), ['uber']);
  assert.deepEqual(ids(queries.searchTransactions({ text: '  CAF ' })), ['cafe']);
  assert.deepEqual(ids(queries.searchTransactions({ text: 'u', bank: 'BAC' })), ['uber']);
  assert.deepEqual(ids(queries.searchTransactions({ text: 'xyz' })), []);
  assert.deepEqual(ids(queries.searchTransactions({ text: '   ' })), ['cafe', 'salario', 'super', 'uber']);
});

test('en la búsqueda de texto, % y _ no son comodines', () => {
  const { queries } = sampleApp();
  assert.deepEqual(ids(queries.searchTransactions({ text: '%' })), []);
  assert.deepEqual(ids(queries.searchTransactions({ text: '_' })), []);
});
