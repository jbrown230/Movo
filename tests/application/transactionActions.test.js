import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { BCR_SINPE_PROPIO, BCR_SINPE_ENVIADO } from '../fixtures/bcrMails.js';

const sinpeTo = (bank, counterparty, amount) => buildBankMail({ bank, type: 'sinpe', counterparty, amount });

test('cambiar la categoría crea una regla y la aplica a los movimientos del mismo comercio', () => {
  const { services } = createTestApp();
  const first = services.readMail(sinpeTo('BAC', 'JUAN EJEMPLO', 1000)).transaction;
  services.readMail(sinpeTo('BN', 'JUAN EJEMPLO', 2000));

  assert.equal(services.recategorize(first.id, 'comida'), 2, 'cambió los dos movimientos');

  const third = services.readMail(sinpeTo('BCR', 'JUAN EJEMPLO', 3000)).transaction;
  assert.equal(third.category, 'comida');
  assert.equal(third.categoryOrigin, 'tu regla');
});

test('la persona puede cambiar cómo se cuenta un movimiento', () => {
  const { services, queries } = createTestApp();
  const { transaction } = services.readMail({ id: 'own', messageId: '<own@bcr>', ...BCR_SINPE_PROPIO });

  assert.equal(services.setDirection(transaction.id, 'in').category, 'ingreso');
  assert.equal(services.setDirection(transaction.id, 'self').category, 'propias');
  assert.equal(queries.getTransaction(transaction.id).categoryOrigin, 'elegida por ti');
});

test('una dirección inválida se rechaza sin cambiar nada', () => {
  const { services, queries } = createTestApp();
  const { transaction } = services.readMail({ id: 'e', messageId: '<e@bcr>', ...BCR_SINPE_ENVIADO });

  assert.equal(services.setDirection(transaction.id, 'cualquier-cosa'), null);
  assert.equal(services.setDirection('no-existe', 'in'), null);
  assert.equal(queries.getTransaction(transaction.id).direction, 'out');
});

test('un gasto en efectivo se guarda a mano', () => {
  const { services, queries } = createTestApp();
  const saved = services.addManualTransaction({ amountCents: 250000, counterparty: 'PAN DE LA ESQUINA', category: 'comida' });

  assert.equal(saved.type, 'efectivo');
  assert.equal(saved.crcCents, 250000);
  assert.equal(saved.categoryOrigin, 'elegida por ti');
  assert.equal(queries.countTransactions(), 1);
});

test('registrar a mano un correo no entendido lo marca como registrado', () => {
  const { services, queries } = createTestApp();
  services.readMail({ id: 'raro', messageId: '<raro@banco>', subject: 'Aviso', body: 'Algo sin monto' });

  const saved = services.addManualTransaction({
    amountCents: 500000, counterparty: 'TIENDA', category: 'otros', type: 'transferencia', mailId: 'raro',
  });

  const mail = queries.getMail('raro');
  assert.equal(mail.status, 'registrado');
  assert.equal(mail.transactionId, saved.id);
  assert.deepEqual(queries.getTransactionsOfMail(mail).map((t) => t.id), [saved.id]);
  assert.equal(queries.getMailOfTransaction(saved).id, 'raro');
});

test('eliminar un movimiento no reaparece al volver a leer el correo', () => {
  const { services, queries } = createTestApp();
  const { transaction } = services.readMail({ id: 'e1', messageId: '<e1@bcr>', ...BCR_SINPE_ENVIADO });

  services.deleteTransaction(transaction.id);

  assert.equal(queries.getMail('e1').status, 'descartado');
  assert.equal(queries.countTransactions(), 0);
  assert.equal(services.reparseMail('e1').status, 'duplicado', 'un correo descartado no se vuelve a leer');
  assert.equal(services.readMail({ id: 'e1', messageId: '<e1@bcr>', ...BCR_SINPE_ENVIADO }).status, 'duplicado');
});
