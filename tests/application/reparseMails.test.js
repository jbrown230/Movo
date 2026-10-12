import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { BCR_SINPE_ENVIADO, BCR_SINPE_PROPIO } from '../fixtures/bcrMails.js';

test('los correos no reconocidos se vuelven a leer cuando mejora el lector', () => {
  const { services, storage, queries } = createTestApp();

  // Lo que dejó una versión anterior: el SINPE del BCR quedó como "sin movimiento".
  storage.mails.insert({
    id: 'g1', messageId: '<g1@bcr>', bank: 'BCR', fromAddress: BCR_SINPE_ENVIADO.from, fromName: 'BCR Mensajero',
    subject: BCR_SINPE_ENVIADO.subject, body: BCR_SINPE_ENVIADO.body, receivedAt: new Date().toISOString(),
    status: 'sin_movimiento',
  });
  storage.meta.set('parser_version', 1);

  assert.equal(services.reparseIfParserChanged(), 1);
  assert.equal(queries.getMail('g1').status, 'registrado');
  assert.equal(queries.listTransactions()[0].amountCents, 15);
  assert.equal(services.reparseIfParserChanged(), 0, 'solo corre una vez por versión');
});

test('al actualizar el lector, un SINPE propio registrado como ingreso se corrige', () => {
  const { services, storage, queries } = createTestApp();
  const { transaction } = services.readMail({ id: 'old', messageId: '<old@bcr>', ...BCR_SINPE_PROPIO });

  // Como lo dejó una versión anterior del lector.
  storage.transactions.update(transaction.id, { direction: 'in', category: 'ingreso' });
  storage.meta.set('parser_version', 2);

  assert.equal(services.reparseIfParserChanged(), 1);
  assert.equal(queries.getTransaction(transaction.id).direction, 'self');
});

test('lo que la persona eligió a mano no se toca al actualizar el lector', () => {
  const { services, storage, queries } = createTestApp();
  const { transaction } = services.readMail({ id: 'mine', messageId: '<mine@bcr>', ...BCR_SINPE_PROPIO });

  services.setDirection(transaction.id, 'in');
  storage.meta.set('parser_version', 2);
  services.reparseIfParserChanged();

  assert.equal(queries.getTransaction(transaction.id).direction, 'in');
});

test('volver a leer un correo que no existe no rompe nada', () => {
  const { services } = createTestApp();
  assert.equal(services.reparseMail('no-existe').status, 'no_existe');
});
