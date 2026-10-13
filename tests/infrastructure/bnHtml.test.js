// Pruebas con el HTML del "Voucher Digital" del Banco Nacional (anonimizado): conversión a texto + lector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { createTestApp } from '../helpers/createTestApp.js';
import { parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { BN_VOUCHER_COMPRA } from '../fixtures/bnMails.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/bn-html/${name}`, import.meta.url), 'utf8');
const VOUCHER_SENDER = 'BN Contacto Digital <bncontacto@bncr.fi.cr>';

test('el voucher queda con la frase del comprobante en una línea y el total en su fila', () => {
  const body = htmlToText(readFixture('voucher-compra.html'));
  assert.match(
    body,
    /^Por este medio .* comprobante de Compra realizada en .* el 20 de Octubre de 2026 a las 2:15 p\.m\.$/m,
  );
  assert.match(body, /^TOTAL:\tCRC 3500,00$/m);
  assert.ok(body.startsWith(BN_VOUCHER_COMPRA.body.split('\nEstimado cliente')[0]), 'coincide con la versión en texto');
});

test('el voucher del HTML real se lee como compra con tarjeta', () => {
  const parsed = parseFirstApproved({
    from: VOUCHER_SENDER,
    subject: 'Voucher Digital',
    body: htmlToText(readFixture('voucher-compra.html')),
  });
  assert.equal(parsed.template, 'BN voucher');
  assert.equal(parsed.bank, 'BN');
  assert.equal(parsed.amountCents, 350000);
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.counterparty, 'SUPERMERCADO DE PRUEBA SAN JOSE');
  assert.equal(parsed.date, costaRicaIso(2026, 10, 20, 14, 15));
});

test('el voucher se registra como movimiento y el mismo correo no se duplica', () => {
  const { services, queries } = createTestApp();
  const mail = {
    id: 'bn-voucher',
    messageId: '<voucher@bncr>',
    from: VOUCHER_SENDER,
    subject: 'Voucher Digital',
    body: htmlToText(readFixture('voucher-compra.html')),
  };
  assert.equal(services.readMail(mail).status, 'registrado');
  assert.equal(services.readMail(mail).status, 'duplicado');
  assert.equal(queries.countTransactions(), 1);
});
