// Pruebas de la exportación de movimientos a CSV, sobre una base SQLite real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { UTF8_BOM } from '../../web/src/domain/csv.js';

/** Inserta un movimiento; `date` es la hora local del teléfono. */
function insert(storage, id, overrides) {
  storage.transactions.insert({
    id,
    date: overrides.date.toISOString(),
    amountCents: overrides.amountCents,
    currency: overrides.currency ?? 'CRC',
    crcCents: overrides.crcCents ?? overrides.amountCents,
    exchangeRate: overrides.exchangeRate ?? null,
    counterparty: overrides.counterparty,
    category: overrides.category ?? 'otros',
    categoryOrigin: 'regla automática',
    type: overrides.type ?? 'tarjeta',
    direction: overrides.direction ?? 'out',
    bank: overrides.bank === undefined ? 'BCR' : overrides.bank,
    mailKey: null,
    note: null,
  });
}

function sampleApp() {
  const app = createTestApp();
  insert(app.storage, 'cafe', {
    date: new Date(2026, 0, 14, 8, 5),
    amountCents: 250050,
    counterparty: 'CAFÉ "LA ESQUINA", SAN JOSÉ',
    category: 'comida',
    bank: 'BAC',
  });
  insert(app.storage, 'netflix', {
    date: new Date(2026, 0, 15, 21, 0),
    amountCents: 799,
    currency: 'USD',
    crcCents: 364024,
    exchangeRate: 455.6,
    counterparty: 'NETFLIX.COM',
    category: 'ocio',
  });
  insert(app.storage, 'pan', {
    date: new Date(2026, 0, 16, 7, 30),
    amountCents: 180000,
    counterparty: 'PAN DULCE',
    category: 'comida',
    type: 'efectivo',
    bank: null,
  });
  insert(app.storage, 'salario', {
    date: new Date(2026, 1, 1, 9, 0),
    amountCents: 50000000,
    counterparty: 'EMPRESA PRUEBA',
    category: 'ingreso',
    type: 'sinpe',
    direction: 'in',
    bank: 'BN',
  });
  return app;
}

const linesOf = (content) => content.slice(UTF8_BOM.length).trimEnd().split('\r\n');

test('exporta el rango pedido, del más viejo al más nuevo, con el encabezado en español', () => {
  const { services } = sampleApp();
  const file = services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' });

  assert.equal(file.count, 3);
  assert.equal(file.fileName, 'movo-movimientos-2026-01-14-a-2026-01-16.csv');
  assert.ok(file.content.startsWith(UTF8_BOM));
  const [header, ...rows] = linesOf(file.content);
  assert.equal(header, 'Fecha;Comercio;Monto;Moneda;Monto en colones;Categoría;Tipo;Medio;Banco');
  assert.deepEqual(
    rows.map((row) => row.split(';')[0]),
    ['2026-01-14 08:05', '2026-01-15 21:00', '2026-01-16 07:30'],
  );
});

test('con punto y coma: coma decimal, y el comercio con comillas y comas queda bien escrito', () => {
  const { services } = sampleApp();
  const [, cafe, netflix, pan] = linesOf(
    services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' }).content,
  );

  assert.equal(
    cafe,
    '2026-01-14 08:05;"CAFÉ ""LA ESQUINA"", SAN JOSÉ";2500,50;CRC;2500,50;Comida;Gasto;Tarjeta;BAC Credomatic',
  );
  assert.equal(netflix, '2026-01-15 21:00;NETFLIX.COM;7,99;USD;3640,24;Ocio;Gasto;Tarjeta;Banco de Costa Rica');
  assert.equal(pan, '2026-01-16 07:30;PAN DULCE;1800,00;CRC;1800,00;Comida;Gasto;Efectivo;', 'sin banco: celda vacía');
});

test('con coma: punto decimal, y las celdas con coma van entre comillas', () => {
  const { services } = sampleApp();
  const [header, cafe] = linesOf(
    services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-14', separator: ',' }).content,
  );
  assert.equal(header, 'Fecha,Comercio,Monto,Moneda,Monto en colones,Categoría,Tipo,Medio,Banco');
  assert.equal(
    cafe,
    '2026-01-14 08:05,"CAFÉ ""LA ESQUINA"", SAN JOSÉ",2500.50,CRC,2500.50,Comida,Gasto,Tarjeta,BAC Credomatic',
  );
});

test('sin fechas exporta todo, y un ingreso se marca como tal', () => {
  const { services } = sampleApp();
  const file = services.exportTransactions({});
  assert.equal(file.count, 4);
  assert.equal(file.fileName, 'movo-movimientos-inicio-a-hoy.csv');
  assert.match(linesOf(file.content).at(-1), /;Ingresos;Ingreso;SINPE;Banco Nacional$/);
});

test('los movimientos eliminados no se exportan, y un rango vacío da un archivo con solo el encabezado', () => {
  const { services } = sampleApp();
  services.deleteTransaction('netflix');
  assert.equal(services.exportTransactions({ fromDay: '2026-01-15', toDay: '2026-01-15' }).count, 0);
  assert.deepEqual(linesOf(services.exportTransactions({ fromDay: '2027-01-01' }).content).length, 1);
});

test('exporta solo lo que cumple los mismos filtros que la lista de movimientos', () => {
  const { services } = sampleApp();

  const byCategory = services.exportTransactions({ category: 'comida' });
  assert.equal(byCategory.count, 2);

  const byText = services.exportTransactions({ text: 'netflix' });
  assert.equal(byText.count, 1);
  assert.match(linesOf(byText.content)[1], /NETFLIX.COM/);

  const combined = services.exportTransactions({ category: 'comida', bank: 'BAC', minCents: 200000 });
  assert.equal(combined.count, 1);
  assert.match(linesOf(combined.content)[1], /LA ESQUINA/);

  assert.equal(services.exportTransactions({ text: 'no existe' }).count, 0);
});
