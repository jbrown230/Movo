// Plantillas reales de Davivienda: movimiento en la cuenta, compra con tarjeta y transferencia recibida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { parseDate } from '../../web/src/domain/emailParser/templates/labeledFields.js';
import { categorize } from '../../web/src/domain/categories.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import {
  DAVIVIENDA_CAMBIO_DISPOSITIVO,
  DAVIVIENDA_CUENTA_CREDITO,
  DAVIVIENDA_CUENTA_DEBITO,
  DAVIVIENDA_ESTADO_DE_CUENTA,
  DAVIVIENDA_INICIO_SESION,
  DAVIVIENDA_RETIRO_SIN_TARJETA,
  DAVIVIENDA_TARJETA_COMPRA,
  DAVIVIENDA_TRANSFERENCIA_RECIBIDA,
} from '../fixtures/daviviendaMails.js';

const categoryOf = (parsed) =>
  categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category;

/** La versión en texto plano: el valor de cada campo queda en la línea siguiente a su etiqueta. */
const asPlainText = (mail) => ({ ...mail, body: mail.body.replace(/:\t/g, ':\n') });

test('Davivienda: un débito en la cuenta por SINPE se lee como gasto sin contraparte', () => {
  const parsed = parseFirstApproved(DAVIVIENDA_CUENTA_DEBITO);
  assert.equal(parsed.template, 'Davivienda cuenta');
  assert.equal(parsed.bank, 'DAVIVIENDA');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1250000);
  assert.equal(parsed.counterparty, 'SINPE MÓVIL', 'el correo no dice a quién se envió');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30, 15));
  assert.equal(parsed.note, 'Concepto: Transferencia SINPE · Cuenta ****0000');
  assert.equal(categoryOf(parsed), 'transfer');
});

test('Davivienda: un crédito en la cuenta se lee como ingreso, con el concepto como contraparte', () => {
  const parsed = parseFirstApproved(DAVIVIENDA_CUENTA_CREDITO);
  assert.equal(parsed.template, 'Davivienda cuenta');
  assert.equal(parsed.type, 'transferencia');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 150);
  assert.equal(parsed.counterparty, 'Pago intereses');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 31, 23, 49, 21));
  assert.equal(categoryOf(parsed), 'ingreso');
});

test('Davivienda: compra con tarjeta', () => {
  const parsed = parseFirstApproved(DAVIVIENDA_TARJETA_COMPRA);
  assert.equal(parsed.template, 'Davivienda tarjeta');
  assert.equal(parsed.bank, 'DAVIVIENDA');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 875000);
  assert.equal(parsed.counterparty, 'RESTAURANTE DE PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 17, 18, 15, 31));
  assert.equal(parsed.note, 'Tarjeta ****0000');
  assert.equal(parsed.declined, false);
  assert.equal(categoryOf(parsed), 'comida');
});

test('Davivienda: compra con tarjeta en dólares', () => {
  const body = DAVIVIENDA_TARJETA_COMPRA.body.replace('CRC 8750.00', 'USD 45.80');
  const parsed = parseFirstApproved({ ...DAVIVIENDA_TARJETA_COMPRA, body });
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 4580);
});

test('Davivienda: una transferencia recibida se lee como ingreso, con quien la envió', () => {
  const parsed = parseFirstApproved(DAVIVIENDA_TRANSFERENCIA_RECIBIDA);
  assert.equal(parsed.template, 'Davivienda transferencia');
  assert.equal(parsed.bank, 'DAVIVIENDA');
  assert.equal(parsed.type, 'transferencia');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 25000000);
  assert.equal(parsed.counterparty, 'EMPRESA DE PRUEBA SOCIEDAD ANONIMA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 12, 11, 46));
  assert.equal(parsed.note, 'Detalle: PAGO DE PRUEBA · Cuenta ****0001');
  assert.equal(categoryOf(parsed), 'ingreso');
});

test('Davivienda: una transferencia con el mismo titular en origen y destino es entre mis cuentas', () => {
  const body = DAVIVIENDA_TRANSFERENCIA_RECIBIDA.body
    .replace('EMPRESA DE PRUEBA SOCIEDAD ANONIMA', 'APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2')
    .replace('CRC CLIENTE DE PRUEBA', 'CRC NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2');
  const parsed = parseFirstApproved({ ...DAVIVIENDA_TRANSFERENCIA_RECIBIDA, body });
  assert.equal(parsed.direction, 'self');
  assert.match(parsed.note, /^Entre tus cuentas/);
  assert.equal(categoryOf(parsed), 'propias');
});

test('Davivienda: la versión en texto plano (valor en la línea siguiente) da el mismo resultado', () => {
  for (const mail of [DAVIVIENDA_CUENTA_DEBITO, DAVIVIENDA_TARJETA_COMPRA, DAVIVIENDA_TRANSFERENCIA_RECIBIDA]) {
    assert.deepEqual(parseFirstApproved(asPlainText(mail)), parseFirstApproved(mail), mail.subject);
  }
});

test('Davivienda: los avisos de seguridad, la solicitud de retiro y el estado de cuenta no son movimientos', () => {
  const notices = [
    DAVIVIENDA_INICIO_SESION,
    DAVIVIENDA_CAMBIO_DISPOSITIVO,
    DAVIVIENDA_RETIRO_SIN_TARJETA, // el retiro, si se hace, llega después como débito en la cuenta
    DAVIVIENDA_ESTADO_DE_CUENTA,
  ];
  for (const mail of notices) {
    const result = parseMail(mail);
    assert.equal(result.ok, false, mail.subject);
    assert.equal(result.bank, 'DAVIVIENDA', mail.subject);
  }
});

test('Davivienda: la hora con "PM" de más ("23:49:50 PM") se lee en 24 horas', () => {
  assert.equal(parseDate('31/01/2026 23:49:50 PM'), costaRicaIso(2026, 1, 31, 23, 49, 50));
  assert.equal(parseDate('15/01/2026 12:11:46 PM'), costaRicaIso(2026, 1, 15, 12, 11, 46));
  assert.equal(parseDate('15/01/2026, a las 05:09:23'), costaRicaIso(2026, 1, 15, 5, 9, 23));
});
