// Plantillas reales de Wink: SINPE Móvil enviado y recibido, compra con tarjeta y pago de tarjeta de crédito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { categorize } from '../../web/src/domain/categories.js';
import { detectBank } from '../../web/src/domain/banks.js';
import { displayName } from '../../web/src/domain/names.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import {
  WINK_PAGO_TARJETA_CREDITO,
  WINK_SINPE_ENVIADO,
  WINK_SINPE_RECIBIDO,
  WINK_TARJETA_COMPRA,
  WINK_TEXTO_PLANO,
} from '../fixtures/winkMails.js';

const categoryOf = (parsed) =>
  categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category;

// El aviso del pago de tarjeta no trae fecha: se usa la del correo.
const PAYMENT_MAIL_DATE = '2026-01-15T19:40:42.000Z';

test('Wink: SINPE Móvil enviado se lee como gasto, con la hora que trae el asunto', () => {
  const parsed = parseFirstApproved(WINK_SINPE_ENVIADO);
  assert.equal(parsed.template, 'Wink SINPE');
  assert.equal(parsed.bank, 'WINK');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 350000);
  assert.equal(parsed.counterparty, 'PERSONA DESTINO PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30), 'el cuerpo solo trae el día; la hora sale del asunto');
  assert.equal(categoryOf(parsed), 'transfer');
});

test('Wink: un SINPE enviado pegado sin asunto toma el día del cuerpo, al mediodía', () => {
  const parsed = parseFirstApproved({ ...WINK_SINPE_ENVIADO, from: '', subject: 'Notificación pegada' });
  assert.equal(parsed.bank, 'WINK', 'se reconoce por el texto: "El equipo de WINK"');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 12, 0));
});

test('Wink: SINPE recibido se lee como ingreso; el aviso no dice quién lo envió', () => {
  const parsed = parseFirstApproved(WINK_SINPE_RECIBIDO);
  assert.equal(parsed.template, 'Wink SINPE');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 1500000);
  assert.equal(parsed.counterparty, 'SINPE MÓVIL');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 18, 22));
  assert.equal(categoryOf(parsed), 'ingreso');
});

test('Wink: compra con tarjeta', () => {
  const parsed = parseFirstApproved(WINK_TARJETA_COMPRA);
  assert.equal(parsed.template, 'Wink tarjeta');
  assert.equal(parsed.bank, 'WINK');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC', 'el monto no trae moneda: colones');
  assert.equal(parsed.amountCents, 250000);
  assert.equal(parsed.counterparty, 'COMERCIO DE PRUEBA 0000000000 CR');
  assert.equal(displayName(parsed.counterparty), 'Comercio De Prueba');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 14, 21));
  assert.equal(parsed.note, 'Tarjeta ****0000');
  assert.equal(parsed.declined, false);
});

test('Wink: una compra con una moneda en el monto la respeta', () => {
  const body = WINK_TARJETA_COMPRA.body.replace('Monto de la compra: 2,500.00', 'Monto de la compra: USD 10.50');
  const parsed = parseFirstApproved({ ...WINK_TARJETA_COMPRA, body });
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 1050);
});

test('Wink: una compra en una moneda desconocida no se cuenta como colones', () => {
  const body = WINK_TARJETA_COMPRA.body.replace('Monto de la compra: 2,500.00', 'Monto de la compra: 10.00 GBP');
  const result = parseMail({ ...WINK_TARJETA_COMPRA, body });
  assert.equal(result.ok, false, 'queda para registrarla a mano');
});

test('Wink: el pago de la tarjeta de crédito es un movimiento entre mis cuentas, no un gasto', () => {
  const parsed = parseFirstApproved({ ...WINK_PAGO_TARJETA_CREDITO, date: PAYMENT_MAIL_DATE });
  assert.equal(parsed.template, 'Wink pago de tarjeta');
  assert.equal(parsed.bank, 'WINK');
  assert.equal(parsed.type, 'transferencia');
  assert.equal(parsed.direction, 'self', 'las compras ya se registraron con sus propios avisos');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 500000);
  assert.equal(parsed.counterparty, 'PAGO DE TARJETA DE CRÉDITO');
  assert.equal(parsed.note, 'Tarjeta ****0000 · Pago: Otro monto');
  assert.equal(parsed.date, PAYMENT_MAIL_DATE, 'sin fecha en el cuerpo, la del correo');
  assert.equal(categoryOf(parsed), 'propias');
});

test('Wink: la parte de texto plano (etiquetas entre asteriscos) se lee igual', () => {
  const read = (body, subject) => parseFirstApproved({ from: 'transacciones@holawink.com', subject, body });

  const sent = read(WINK_TEXTO_PLANO.sinpeEnviado, WINK_SINPE_ENVIADO.subject);
  assert.deepEqual([sent.direction, sent.amountCents, sent.counterparty], ['out', 350000, 'PERSONA DESTINO PRUEBA']);
  assert.equal(sent.date, costaRicaIso(2026, 1, 15, 10, 30));

  const card = read(WINK_TEXTO_PLANO.tarjetaCompra, WINK_TARJETA_COMPRA.subject);
  assert.deepEqual([card.type, card.amountCents, card.note], ['tarjeta', 250000, 'Tarjeta ****0000']);
  assert.equal(card.date, costaRicaIso(2026, 1, 15, 14, 21));

  const payment = read(WINK_TEXTO_PLANO.pagoTarjetaCredito, WINK_PAGO_TARJETA_CREDITO.subject);
  assert.deepEqual([payment.direction, payment.amountCents], ['self', 500000]);

  const received = read(WINK_TEXTO_PLANO.sinpeRecibido, WINK_SINPE_RECIBIDO.subject);
  assert.deepEqual([received.direction, received.amountCents], ['in', 1500000]);
  assert.equal(received.date, costaRicaIso(2026, 1, 15, 18, 22));
});

test('Wink: se reconoce por el remitente y, en un aviso pegado, por la firma', () => {
  assert.equal(detectBank('transacciones@holawink.com'), 'WINK');
  assert.equal(detectBank('', WINK_TEXTO_PLANO.tarjetaCompra), 'WINK');
  assert.equal(detectBank('', 'Compra en COMERCIO DE PRUEBA por ₡2,500.00'), null);
});

test('Wink: un correo suyo que no es una notificación de transacción no se lee, aunque traiga un monto', () => {
  const promo = {
    from: 'transacciones@holawink.com',
    subject: 'Aprovechá esta semana',
    body: '¡Hola Winker!\nPagá con tu tarjeta Wink y recibí ₡5,000.00 de cashback en tu primera compra.\nAtentamente,\nEl equipo de WINK',
  };
  assert.equal(parseMail(promo).ok, false);
});
