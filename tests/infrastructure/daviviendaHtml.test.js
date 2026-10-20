// Pruebas con el HTML de notificaciones de Davivienda (anonimizadas): conversión a texto + lector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { parseFirstApproved, parseMail } from '../../web/src/domain/emailParser/parseMail.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/davivienda-html/${name}`, import.meta.url), 'utf8');
const SENDER = 'NOTIFICACIONES Davivienda <bancavirtual@davivienda.cr>';
const fromHtml = (name, subject) => ({ from: SENDER, subject, body: htmlToText(readFixture(name)) });

test('el HTML de Davivienda es un fragmento suelto (empieza con <img>) y aun así se convierte', () => {
  const html = readFixture('cuenta-debito.html');
  assert.match(html, /^<img/);
  const body = htmlToText(html);
  assert.match(body, /^Monto:\tCRC 12500\.00$/m);
  assert.match(body, /^Fecha y hora:\t15\/01\/2026, a las 10:30:15$/m);
});

test('el débito en la cuenta de Davivienda en HTML se lee como gasto', () => {
  const parsed = parseFirstApproved(fromHtml('cuenta-debito.html', 'TRANSACCIÓN DAVIVIENDA 15/01/2026 10:30:22 AM'));
  assert.equal(parsed.template, 'Davivienda cuenta');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.amountCents, 1250000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30, 15));
});

test('el crédito en la cuenta de Davivienda en HTML se lee como ingreso', () => {
  const parsed = parseFirstApproved(fromHtml('cuenta-credito.html', 'TRANSACCIÓN DAVIVIENDA 31/01/2026 23:49:50 PM'));
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 150);
  assert.equal(parsed.counterparty, 'Pago intereses');
});

test('la compra con tarjeta de Davivienda en HTML se lee completa', () => {
  const parsed = parseFirstApproved(fromHtml('tarjeta-compra.html', 'Notificación por transacción de Davivienda'));
  assert.equal(parsed.template, 'Davivienda tarjeta');
  assert.equal(parsed.counterparty, 'RESTAURANTE DE PRUEBA');
  assert.equal(parsed.amountCents, 875000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 17, 18, 15, 31));
  assert.equal(parsed.note, 'Tarjeta ****0000');
});

test('la transferencia recibida de Davivienda en HTML se lee como ingreso', () => {
  const parsed = parseFirstApproved(fromHtml('transferencia-recibida.html', 'TRANSFERENCIA REALIZADA'));
  assert.equal(parsed.template, 'Davivienda transferencia');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 25000000);
  assert.equal(parsed.counterparty, 'EMPRESA DE PRUEBA SOCIEDAD ANONIMA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 12, 11, 46));
});

test('los avisos de Davivienda en HTML no generan movimientos', () => {
  for (const name of ['inicio-sesion.html', 'cambio-dispositivo.html', 'retiro-sin-tarjeta.html']) {
    assert.equal(parseMail(fromHtml(name, 'Aviso')).ok, false, name);
  }
});
