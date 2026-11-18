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

test('un cuerpo grande con tildes y símbolos se descodifica igual de bien', () => {
  const text = 'Compra en CAFÉ DEL VOLCÁN por ₡12.500,00 ñandú 日本語 😀\n'.repeat(2000);
  const mail = decodeGmailMessage(
    'id-4',
    gmailMessage([{ mimeType: 'text/plain', body: { data: toBase64Url(text) } }]),
  );
  assert.equal(mail.body, text);
});

test('si el HTML con tablas ya sirve, no se descodifica el texto plano (no se gasta tiempo en lo que no se usa)', () => {
  const html = '<html><body><table><tr><td>Monto</td><td>10.00</td></tr></table></body></html>';
  const message = gmailMessage([
    { mimeType: 'text/plain', body: { data: '***no es base64***' } }, // si se intentara descodificar, fallaría
    { mimeType: 'text/html', body: { data: toBase64Url(html) } },
  ]);
  assert.match(decodeGmailMessage('id-5', message).body, /Monto\t10\.00/);
});

test('sin tablas se usa el texto plano, y si viene vacío se cae al HTML', () => {
  const html = '<html><body><p>Compra por ₡500</p></body></html>';
  const withPlain = gmailMessage([
    { mimeType: 'text/plain', body: { data: toBase64Url('texto plano') } },
    { mimeType: 'text/html', body: { data: toBase64Url(html) } },
  ]);
  assert.equal(decodeGmailMessage('id-6', withPlain).body, 'texto plano');

  const emptyPlain = gmailMessage([
    { mimeType: 'text/plain', body: { data: toBase64Url('   ') } },
    { mimeType: 'text/html', body: { data: toBase64Url(html) } },
  ]);
  assert.match(decodeGmailMessage('id-7', emptyPlain).body, /Compra por ₡500/);
});
