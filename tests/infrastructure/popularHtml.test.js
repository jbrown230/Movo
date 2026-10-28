// Pruebas con el HTML de notificaciones de Banco Popular (anonimizadas): conversión a texto + lector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { parseFirstApproved, parseMail } from '../../web/src/domain/emailParser/parseMail.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/popular-html/${name}`, import.meta.url), 'utf8');
const fromHtml = (name, from) => ({ from, subject: 'Aviso', body: htmlToText(readFixture(name)) });
const CARD_SENDER = 'Banco Popular <tarjetaBPnotifica@bancopopularinforma.fi.cr>';
const NOTICES_SENDER = '<BPNotifica@bpdc.fi.cr>';

test('la compra con tarjeta de Banco Popular en HTML (dentro de un <pre>) se lee completa', () => {
  const parsed = parseFirstApproved(fromHtml('tarjeta-colones.html', CARD_SENDER));
  assert.equal(parsed.template, 'Popular tarjeta');
  assert.equal(parsed.counterparty, 'VERDULERIA DE PRUEBA GUANACASTE CR', 'los espacios de relleno se colapsan');
  assert.equal(parsed.amountCents, 1250000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 16, 49));
});

test('la compra en dólares de Banco Popular en HTML', () => {
  const parsed = parseFirstApproved(fromHtml('tarjeta-dolares.html', CARD_SENDER));
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 2550);
});

test('la tabla del comprobante SINPE de Banco Popular en HTML se lee (enviado y recibido)', () => {
  const sent = parseFirstApproved(fromHtml('sinpe-enviado.html', NOTICES_SENDER));
  assert.equal(sent.template, 'Popular SINPE');
  assert.equal(sent.direction, 'out');
  assert.equal(sent.amountCents, 350000);
  assert.equal(sent.counterparty, 'PERSONA DESTINO PRUEBA');

  const received = parseFirstApproved(fromHtml('sinpe-recibido.html', NOTICES_SENDER));
  assert.equal(received.direction, 'in');
  assert.equal(received.amountCents, 15000000);
  assert.equal(received.counterparty, 'PERSONA ORIGEN PRUEBA');
  assert.equal(received.date, costaRicaIso(2026, 1, 16, 12, 31, 32));
});

test('el aviso de la cuenta, el DTR y el comprobante en PDF de Banco Popular en HTML no se leen', () => {
  for (const name of ['cuenta-credito.html', 'dtr-enviado.html', 'banca-movil-comprobante-pdf.html']) {
    assert.equal(parseMail(fromHtml(name, NOTICES_SENDER)).ok, false, name);
  }
});
