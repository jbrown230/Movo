// Pruebas con el HTML de notificaciones de BAC Credomatic (anonimizadas): conversión a texto + lector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { createTestApp } from '../helpers/createTestApp.js';
import { parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { categorize } from '../../web/src/domain/categories.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/bac-html/${name}`, import.meta.url), 'utf8');
const BAC_SENDER = 'BAC Credomatic <notificaciones@baccredomatic.cr>';

test('la tarjeta de BAC en HTML queda con las celdas separadas por tabulador', () => {
  const body = htmlToText(readFixture('tarjeta-aprobada.html'));
  assert.match(body, /^Comercio:\tSUPERMERCADO DE PRUEBA$/m);
  assert.match(body, /^Monto:\tCRC 15,000\.00$/m);

  const parsed = parseFirstApproved({
    from: BAC_SENDER,
    subject: 'Notificación de Transacción',
    body,
  });
  assert.equal(parsed.template, 'BAC tarjeta');
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1500000);
  assert.equal(parsed.counterparty, 'SUPERMERCADO DE PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 10, 18, 19, 15));
  assert.equal(parsed.note, 'Tarjeta ****0000');
  assert.equal(
    categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category,
    'super',
  );
});

test('el SINPE de BAC en HTML se convierte y se lee como ingreso', () => {
  const body = htmlToText(readFixture('sinpe-propio.html'));
  assert.match(body, /Notificación de Transferencia SINPE/);
  assert.match(body, /se acreditó en la cuenta IBAN/);

  const parsed = parseFirstApproved({
    from: BAC_SENDER,
    subject: 'Notificación de Transferencia SINPE',
    body,
  });
  assert.equal(parsed.template, 'BAC SINPE');
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1000000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 14, 31, 22));
  assert.match(parsed.note, /Motivo: prueba SINPE/);
  assert.match(parsed.note, /Cuenta \*\*\*\*0000/);
});

test('la compra con tarjeta de BAC se registra y no se duplica', () => {
  const { services, queries } = createTestApp();
  const mail = {
    id: 'bac-tarjeta',
    messageId: '<bac-tarjeta-1@baccredomatic.cr>',
    from: BAC_SENDER,
    subject: 'Notificación de Transacción',
    body: htmlToText(readFixture('tarjeta-aprobada.html')),
  };
  assert.equal(services.readMail(mail).status, 'registrado');
  assert.equal(services.readMail(mail).status, 'duplicado');
  assert.equal(queries.countTransactions(), 1);
});
