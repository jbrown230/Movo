// Pruebas con el HTML de notificaciones del BCR (anonimizado): conversión a texto + lector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { createTestApp } from '../helpers/createTestApp.js';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { categorize } from '../../web/src/domain/categories.js';
import { BCR_TARJETA_VARIAS_FILAS_HTML } from '../fixtures/bcrMails.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/bcr-html/${name}`, import.meta.url), 'utf8');
const SINPE_SENDER = '"BCR Mensajero" <mensajero@bancobcr.com>';
const CARD_SENDER = 'BCR Tarjetas <bcrtarjestcta@bancobcr.com>';

test('el SINPE no usa tablas y parte las etiquetas con saltos de línea', () => {
  const body = htmlToText(readFixture('sinpe-enviado.html'));
  assert.match(body, /^Estimado \(a\): APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2$/m, '"Estimado\\r\\n(a):" queda en una línea');

  const parsed = parseFirstApproved({ from: SINPE_SENDER, subject: 'SINPEMOVIL - Notificación de transacción realizada', body });
  assert.equal(parsed.template, 'BCR SINPE');
  assert.equal(parsed.amountCents, 15);
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.counterparty, 'PERSONA DESTINO PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30));
});

test('un SINPE desde otra entidad a mi cuenta es "entre mis cuentas"', () => {
  const parsed = parseFirstApproved({ from: SINPE_SENDER, subject: 'SINPEMOVIL', body: htmlToText(readFixture('sinpe-propio.html')) });
  assert.equal(parsed.direction, 'self');
  assert.equal(parsed.amountCents, 1000000);
  assert.match(parsed.note, /COOPENAE/);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 17, 14, 0));
});

test('la tabla de tarjeta queda con las columnas alineadas pese a los tabuladores del código fuente', () => {
  const body = htmlToText(readFixture('tarjeta-aprobada.html'));
  assert.match(body, /^Fecha\tAutorización\tNo\.Referencia\tMonto\tMoneda\tComercio\tEstado$/m);

  const { items } = parseMail({ from: CARD_SENDER, subject: 'Notificación de Transacciones BCR', body });
  assert.equal(items.length, 1);
  const [item] = items;
  assert.deepEqual(
    [item.currency, item.amountCents, item.counterparty, item.status, item.declined],
    ['USD', 2000, 'SERVICIO DIGITAL SUB 00000000000 US', 'Aprobada', false],
  );
  assert.equal(item.date, costaRicaIso(2026, 1, 15, 9, 0, 0));
  assert.equal(categorize({ counterparty: item.counterparty, type: item.type, direction: item.direction }).category, 'otros');
});

test('una tabla de tarjeta con varias filas se convierte fila por fila', () => {
  const body = htmlToText(BCR_TARJETA_VARIAS_FILAS_HTML);
  const { items } = parseMail({ from: CARD_SENDER, subject: 'Notificación de Transacciones BCR', body });

  assert.deepEqual(
    items.map((item) => [item.counterparty, item.amountCents, item.declined]),
    [['AUTOMERCADO ESCAZU', 1875000, false], ['STEAM GAMES', 999, true], ['SODA LA CEIBA', 320000, false]],
  );
});

test('una tarjeta negada del HTML real no se registra', () => {
  const { services, queries } = createTestApp();
  const result = services.readMail({
    id: 'n', messageId: '<n@bcr>', from: CARD_SENDER, subject: 'Notificación de Transacciones BCR',
    body: htmlToText(readFixture('tarjeta-negada.html')),
  });
  assert.equal(result.status, 'negada');
  assert.equal(queries.countTransactions(), 0);
});

test('un HTML vacío o sin estructura no rompe la conversión', () => {
  assert.equal(htmlToText('<html><body></body></html>'), '');
  assert.equal(htmlToText('<html><body><p>Solo texto</p></body></html>'), 'Solo texto');
});
