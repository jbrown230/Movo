// Pruebas de leer correos y registrar movimientos (base SQLite real en memoria).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { buildDemoSeedMails } from '../../web/src/demo/seedMails.js';
import { BCR_TARJETA_NEGADA, BCR_SINPE_ENVIADO, BCR_SINPE_PROPIO } from '../fixtures/bcrMails.js';

const mailOf = (overrides) => buildBankMail({ bank: 'BN', type: 'sinpe', counterparty: 'SODA DONA ROSA', amount: 1500, ...overrides });

test('el mismo correo no se registra dos veces', () => {
  const { services, queries } = createTestApp();
  const mail = mailOf({});

  assert.equal(services.readMail(mail).status, 'registrado');
  assert.equal(services.readMail(mail).status, 'duplicado');
  assert.equal(services.readMail({ ...mail, id: 'otro-id-de-gmail' }).status, 'duplicado', 'mismo Message-ID');
  assert.equal(queries.countTransactions(), 1);
});

test('dos teléfonos generan el mismo id para el mismo correo', () => {
  const mail = buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'UBER *TRIP', amount: 4380 });
  const first = createTestApp().services.readMail(mail).transaction;
  const second = createTestApp().services.readMail({ ...mail, id: 'gmail-otro-telefono' }).transaction;
  assert.equal(first.id, second.id);
});

test('una compra en dólares se convierte con el tipo de cambio recibido', () => {
  const { services } = createTestApp();
  const mail = buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'NETFLIX.COM', amount: 7.99, currency: 'USD' });
  const { transaction } = services.readMail(mail);

  assert.equal(transaction.amountCents, 799);
  assert.equal(transaction.currency, 'USD');
  assert.equal(transaction.exchangeRate, 510, 'usa el tipo de cambio de reserva');
  assert.equal(transaction.crcCents, 799 * 510);
});

test('un correo sin monto queda como "sin movimiento" y se puede ver en la bandeja', () => {
  const { services, queries } = createTestApp();
  const result = services.readMail({ id: 'estado', messageId: '<estado@bac>', subject: 'Estado de cuenta', body: 'Ya puede consultar su estado.' });

  assert.equal(result.status, 'sin_movimiento');
  assert.equal(queries.countTransactions(), 0);
  assert.equal(queries.getMail('estado').status, 'sin_movimiento');
  assert.match(queries.getMail('estado').note, /No se encontró un monto/);
});

test('un texto vacío o inválido no rompe la lectura', () => {
  const { services } = createTestApp();
  assert.equal(services.readMail({ id: 'vacio', body: '' }).status, 'sin_movimiento');
  assert.equal(services.readMail({ id: 'basura', body: '\u0000\u0001 ???', subject: undefined }).status, 'sin_movimiento');
});

test('una compra NEGADA del BCR no se registra como gasto', () => {
  const { services, queries } = createTestApp();
  const result = services.readMail({ id: 'neg', messageId: '<neg@bcr>', ...BCR_TARJETA_NEGADA });

  assert.equal(result.status, 'negada');
  assert.equal(queries.countTransactions(), 0);
  assert.match(queries.getMail('neg').note, /Negada/);
});

test('una tabla con varias transacciones registra las aprobadas y avisa de las negadas', () => {
  const { services, queries } = createTestApp();
  const body = BCR_TARJETA_NEGADA.body.replace(
    /(15\/01\/2026 09:05:00.*Negada)/,
    '$1\n15/01/2026 10:00:00\t000001\t000000000005\t18,750.00\tCOLONES\tAUTOMERCADO ESCAZU\tAprobada' +
    '\n15/01/2026 11:15:00\t000002\t000000000006\t3,200.00\tCOLONES\tSODA LA CEIBA\tAprobada',
  );
  const mail = { id: 'multi', messageId: '<multi@bcr>', ...BCR_TARJETA_NEGADA, body };

  const result = services.readMail(mail);
  assert.equal(result.status, 'registrado');
  assert.deepEqual(
    result.transactions.map((t) => [t.counterparty, t.crcCents, t.category]),
    [['AUTOMERCADO ESCAZU', 1875000, 'super'], ['SODA LA CEIBA', 320000, 'comida']],
  );
  assert.match(queries.getMail('multi').note, /1 transacción\(es\) negada/);
  assert.equal(services.readMail(mail).status, 'duplicado');
});

test('el resumen del mes separa gastos, ingresos y convierte los dólares', () => {
  const { services, queries } = createTestApp();
  for (const mail of buildDemoSeedMails()) services.readMail(mail);

  const summary = queries.getMonthSummary();
  assert.equal(summary.incomeCents, 2000000);
  assert.equal(summary.byCategory.find((row) => row.category === 'ocio').totalCents, 799 * 510);
  assert.equal(summary.spentCents, summary.byCategory.reduce((sum, row) => sum + row.totalCents, 0));
});

test('un SINPE a mí mismo no cuenta como gasto ni como ingreso', () => {
  const { services, queries } = createTestApp();
  const result = services.readMail({ id: 'own', messageId: '<own@bcr>', ...BCR_SINPE_PROPIO, date: costaRicaIso(2026, 1, 17, 14, 0) });

  assert.equal(result.transaction.category, 'propias');
  const summary = queries.getMonthSummary(new Date(2026, 0, 15));
  assert.equal(summary.spentCents, 0);
  assert.equal(summary.incomeCents, 0);
  assert.equal(summary.movedBetweenOwnAccountsCents, 1000000);
});

test('la base guardada se vuelve a abrir con los mismos datos', async () => {
  const { reopenDatabase } = await import('../helpers/createTestApp.js');
  const first = createTestApp();
  first.services.readMail(mailOf({}));

  const second = createTestApp({ database: reopenDatabase(first.db) });
  assert.equal(second.queries.countTransactions(), 1);
});

test('si falla a mitad de la lectura no queda nada a medias', () => {
  const { services, queries, storage } = createTestApp();
  const failingInsert = storage.transactions.insert;
  storage.transactions.insert = () => { throw new Error('disco lleno'); };

  assert.throws(() => services.readMail({ id: 'x', messageId: '<x@bcr>', ...BCR_SINPE_ENVIADO }), /disco lleno/);
  storage.transactions.insert = failingInsert;

  assert.equal(queries.countMails(), 0, 'el correo no se guardó');
  assert.equal(services.readMail({ id: 'x', messageId: '<x@bcr>', ...BCR_SINPE_ENVIADO }).status, 'registrado', 'se puede reintentar');
});
