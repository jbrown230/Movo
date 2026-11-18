// Pruebas con el HTML de notificaciones de Wink (anonimizadas): conversión a texto + lector + registro en la app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';
import { costaRicaIso } from '../helpers/costaRica.js';
import { createTestApp } from '../helpers/createTestApp.js';
import { parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import {
  WINK_PAGO_TARJETA_CREDITO,
  WINK_SINPE_ENVIADO,
  WINK_SINPE_RECIBIDO,
  WINK_TARJETA_COMPRA,
  WINK_TEXTO_PLANO,
} from '../fixtures/winkMails.js';

globalThis.DOMParser ??= LinkedomParser; // en el navegador ya existe
const { htmlToText } = await import('../../web/src/infrastructure/gmail/htmlToText.js');
const { decodeGmailMessage } = await import('../../web/src/infrastructure/gmail/mailDecoder.js');

const readFixture = (name) => readFileSync(new URL(`../fixtures/wink-html/${name}`, import.meta.url), 'utf8');
const SENDER = 'transacciones@holawink.com';

const NOTICES = [
  { html: 'sinpe-enviado.html', mail: WINK_SINPE_ENVIADO, plain: WINK_TEXTO_PLANO.sinpeEnviado },
  { html: 'tarjeta-compra.html', mail: WINK_TARJETA_COMPRA, plain: WINK_TEXTO_PLANO.tarjetaCompra },
  { html: 'pago-tarjeta-credito.html', mail: WINK_PAGO_TARJETA_CREDITO, plain: WINK_TEXTO_PLANO.pagoTarjetaCredito },
  { html: 'sinpe-recibido.html', mail: WINK_SINPE_RECIBIDO, plain: WINK_TEXTO_PLANO.sinpeRecibido },
];

test('el HTML de Wink se convierte en las líneas "Etiqueta: valor" que usan las pruebas de texto', () => {
  for (const { html, mail } of NOTICES) {
    assert.equal(htmlToText(readFixture(html)), mail.body, html);
  }
});

test('las cuatro notificaciones de Wink en HTML se leen, y dan lo mismo que su texto plano', () => {
  const MAIL_DATE = '2026-01-15T19:40:42.000Z';
  for (const { html, mail, plain } of NOTICES) {
    const fromHtml = parseFirstApproved({ ...mail, body: htmlToText(readFixture(html)), date: MAIL_DATE });
    const fromPlain = parseFirstApproved({ ...mail, body: plain, date: MAIL_DATE });
    assert.equal(fromHtml.ok, true, html);
    assert.deepEqual(fromHtml, fromPlain, html);
  }
});

test('un mensaje de Gmail de Wink (texto plano y HTML) se lee por el camino real de la app', () => {
  const toBase64Url = (text) => Buffer.from(text, 'utf8').toString('base64url');
  const gmailMessage = ({ subject }, html, plain) => ({
    internalDate: String(Date.UTC(2026, 0, 15, 16, 30, 41)),
    payload: {
      headers: [
        { name: 'From', value: SENDER },
        { name: 'Subject', value: subject },
        { name: 'Message-ID', value: '<wink-prueba@holawink.com>' },
      ],
      parts: [
        { mimeType: 'text/plain', body: { data: toBase64Url(plain) } },
        { mimeType: 'text/html', body: { data: toBase64Url(html) } },
      ],
    },
  });

  const message = gmailMessage(WINK_SINPE_ENVIADO, readFixture('sinpe-enviado.html'), WINK_TEXTO_PLANO.sinpeEnviado);
  const mail = decodeGmailMessage('id-wink-1', message);
  assert.equal(mail.body, WINK_SINPE_ENVIADO.body, 'trae tablas: se prefiere el HTML');

  const parsed = parseFirstApproved(mail);
  assert.equal(parsed.bank, 'WINK');
  assert.equal(parsed.amountCents, 350000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30));
});

test('el SINPE enviado de Wink se registra como movimiento y el mismo correo no se duplica', () => {
  const { services, queries } = createTestApp();
  const mail = {
    id: 'wink-sinpe-1',
    messageId: '<wink-sinpe-1@holawink.com>',
    ...WINK_SINPE_ENVIADO,
    fromName: 'Wink',
    body: htmlToText(readFixture('sinpe-enviado.html')),
    date: '2026-01-15T16:30:41.000Z',
  };

  const first = services.readMail(mail);
  assert.equal(first.status, 'registrado');
  assert.equal(first.transaction.bank, 'WINK');
  assert.equal(first.transaction.amountCents, 350000);
  assert.equal(queries.countTransactions(), 1);

  assert.equal(services.readMail(mail).status, 'duplicado');
  assert.equal(queries.countTransactions(), 1);
});

test('el pago de la tarjeta de crédito de Wink queda como "entre mis cuentas" y no suma al gasto del mes', () => {
  const { services, queries } = createTestApp();
  const now = new Date();
  const mail = {
    id: 'wink-pago-1',
    messageId: '<wink-pago-1@holawink.com>',
    ...WINK_PAGO_TARJETA_CREDITO,
    fromName: 'Wink',
    body: htmlToText(readFixture('pago-tarjeta-credito.html')),
    date: now.toISOString(),
  };

  const result = services.readMail(mail);
  assert.equal(result.status, 'registrado');
  assert.equal(result.transaction.direction, 'self');
  assert.equal(result.transaction.category, 'propias');
  assert.equal(queries.getMonthSummary().spentCents, 0, 'pagar la tarjeta no es un gasto nuevo');
});
