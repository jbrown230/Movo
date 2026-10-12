// Pruebas del lector de correos bancarios (dominio puro: sin base de datos ni DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { parseAmount } from '../../web/src/domain/emailParser/amount.js';
import { categorize } from '../../web/src/domain/categories.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import {
  BCR_SINPE_ENVIADO, BCR_SINPE_RECIBIDO, BCR_SINPE_PROPIO, BCR_TARJETA_NEGADA,
} from '../fixtures/bcrMails.js';

test('parseAmount entiende formatos de Costa Rica y de EE. UU.', () => {
  assert.equal(parseAmount('15,000.00'), 15000);
  assert.equal(parseAmount('15.000,00'), 15000);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('7.99'), 7.99);
  assert.equal(parseAmount('2 500,50'), 2500.5);
  assert.equal(parseAmount('.15'), 0.15);
  assert.ok(Number.isNaN(parseAmount('abc')));
});

// Plantillas sintéticas de la demo: cada banco y tipo se lee completo.
for (const bank of ['BAC', 'BN', 'BCR']) {
  for (const type of ['sinpe', 'tarjeta']) {
    test(`plantilla ${bank} ${type}`, () => {
      const date = '2026-01-15T19:42:00.000Z';
      const mail = buildBankMail({ bank, type, counterparty: 'SODA DONA ROSA', amount: 3450.5, date });
      const parsed = parseFirstApproved(mail);

      assert.ok(parsed.ok);
      assert.equal(parsed.bank, bank);
      assert.equal(parsed.amountCents, 345050);
      assert.equal(parsed.counterparty, 'SODA DONA ROSA');
      assert.equal(parsed.type, type);
      assert.equal(parsed.direction, 'out');
      assert.equal(new Date(parsed.date).getTime(), new Date(date).getTime());
    });
  }
}

test('un SINPE recibido se lee como ingreso', () => {
  for (const bank of ['BAC', 'BN', 'BCR']) {
    const mail = buildBankMail({ bank, type: 'sinpe', direction: 'in', counterparty: 'ANA EJEMPLO V', amount: 20000 });
    assert.equal(parseFirstApproved(mail).direction, 'in', bank);
  }
});

test('compra en dólares', () => {
  const mail = buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'NETFLIX.COM', amount: 7.99, currency: 'USD' });
  const parsed = parseFirstApproved(mail);
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 799);
});

test('el lector genérico entiende un formato desconocido', () => {
  const parsed = parseFirstApproved({
    from: 'avisos@banco-x.example',
    subject: 'Aviso de compra',
    body: 'Estimado cliente, se registró una compra.\nEstablecimiento: PANADERIA LA ESQUINA\nImporte: ₡4.500,00\nFecha: 03/01/2026 08:15',
  });
  assert.ok(parsed.ok);
  assert.equal(parsed.amountCents, 450000);
  assert.equal(parsed.counterparty, 'PANADERIA LA ESQUINA');
  assert.equal(parsed.template, 'genérica');
});

test('un correo sin monto no genera movimiento', () => {
  const result = parseMail({ subject: 'Estado de cuenta', body: 'Ya puede consultar su estado de cuenta.' });
  assert.equal(result.ok, false);
});

test('el pie de página "recibió este correo" no convierte una compra en ingreso', () => {
  const mail = buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'PIZZA ROMA', amount: 9000 });
  mail.body += '\nUsted recibió este correo porque tiene alertas activas.';
  assert.equal(parseFirstApproved(mail).direction, 'out');
});

// ---- Formatos del BCR ----

test('BCR: SINPE enviado con monto ".15" y hora PM/AM', () => {
  const parsed = parseFirstApproved(BCR_SINPE_ENVIADO);
  assert.equal(parsed.template, 'BCR SINPE');
  assert.equal(parsed.bank, 'BCR');
  assert.equal(parsed.amountCents, 15);
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.counterparty, 'PERSONA DESTINO PRUEBA');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30));
  assert.match(parsed.note, /Motivo: prueba SINPE/);
});

test('BCR: SINPE recibido es ingreso', () => {
  const parsed = parseFirstApproved(BCR_SINPE_RECIBIDO);
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 500000);
  assert.equal(parsed.counterparty, 'PERSONA ORIGEN PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 16, 9, 0));
  assert.equal(categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category, 'ingreso');
});

test('BCR: una compra con tarjeta NEGADA queda marcada como negada', () => {
  const result = parseMail(BCR_TARJETA_NEGADA);
  assert.equal(result.template, 'BCR tarjeta');
  assert.equal(result.items.length, 1);

  const [item] = result.items;
  assert.equal(item.declined, true);
  assert.equal(item.status, 'Negada');
  assert.equal(item.currency, 'USD');
  assert.equal(item.amountCents, 2000);
  assert.equal(item.counterparty, 'SERVICIO DIGITAL SUB 00000000000 US');
  assert.equal(item.date, costaRicaIso(2026, 1, 15, 9, 5, 0));
  assert.equal(item.note, 'Tarjeta ****0000');
});

test('BCR: la misma tabla copiada con espacios (sin tabuladores)', () => {
  const body = BCR_TARJETA_NEGADA.body.replace(/\t/g, ' ').replace('Negada', 'Aprobada');
  const parsed = parseFirstApproved({ ...BCR_TARJETA_NEGADA, body });
  assert.ok(parsed.ok);
  assert.equal(parsed.amountCents, 2000);
  assert.equal(parsed.counterparty, 'SERVICIO DIGITAL SUB 00000000000 US');
});

test('BCR: SINPE a mí mismo desde otra entidad se lee como "entre mis cuentas"', () => {
  const parsed = parseFirstApproved(BCR_SINPE_PROPIO);
  assert.equal(parsed.direction, 'self');
  assert.equal(parsed.amountCents, 1000000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 17, 14, 0));
  assert.match(parsed.note, /Entre tus cuentas/);
  assert.match(parsed.note, /COOPENAE/);
});

test('el remitente manda sobre la plantilla para decidir el banco', () => {
  const mail = { ...BCR_SINPE_ENVIADO, from: 'Avisos <avisos@davivienda.example>' };
  assert.equal(parseMail(mail).bank, 'DAVIVIENDA');
});
