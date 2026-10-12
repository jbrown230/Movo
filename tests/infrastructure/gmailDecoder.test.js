import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomParser } from 'linkedom';

globalThis.DOMParser ??= LinkedomParser;
const { decodeGmailMessage } = await import('../../web/src/infrastructure/gmail/mailDecoder.js');

const toBase64Url = (text) => Buffer.from(text, 'utf8').toString('base64url');

const header = (name, value) => ({ name, value });
const gmailMessage = (parts) => ({
  internalDate: String(Date.UTC(2026, 0, 15, 16, 30)),
  payload: {
    headers: [
      header('From', '"BCR Mensajero" <mensajero@bancobcr.com>'),
      header('Subject', 'SINPEMOVIL - Notificación'),
      header('Message-ID', '<abc123@bancobcr.com>'),
    ],
    parts,
  },
});

test('un mensaje de Gmail se convierte en un correo simple', () => {
  const message = gmailMessage([{ mimeType: 'text/plain', body: { data: toBase64Url('Monto: 1.000,00 ₡ ñandú') } }]);
  const mail = decodeGmailMessage('id-1', message);

  assert.equal(mail.id, 'id-1');
  assert.equal(mail.messageId, '<abc123@bancobcr.com>');
  assert.equal(mail.fromName, 'BCR Mensajero');
  assert.equal(mail.subject, 'SINPEMOVIL - Notificación');
  assert.equal(mail.body, 'Monto: 1.000,00 ₡ ñandú', 'respeta tildes y símbolos (UTF-8)');
  assert.equal(mail.date, '2026-01-15T16:30:00.000Z');
});

test('si el HTML trae tablas se prefiere sobre el texto plano', () => {
  const html =
    '<html><body><table><tr><th>Monto</th><th>Estado</th></tr><tr><td>10.00</td><td>Aprobada</td></tr></table></body></html>';
  const message = gmailMessage([
    { mimeType: 'text/plain', body: { data: toBase64Url('texto plano sin columnas') } },
    { mimeType: 'text/html', body: { data: toBase64Url(html) } },
  ]);
  assert.match(decodeGmailMessage('id-2', message).body, /Monto\tEstado/);
});

test('un mensaje sin cuerpo ni cabeceras no rompe la lectura', () => {
  const mail = decodeGmailMessage('id-3', { payload: {} });
  assert.equal(mail.body, '');
  assert.equal(mail.messageId, null);
  assert.equal(mail.subject, '');
});
