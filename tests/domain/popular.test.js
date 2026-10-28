// Plantillas reales de Banco Popular: compra con tarjeta de crédito y comprobante SINPE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { categorize } from '../../web/src/domain/categories.js';
import { displayName } from '../../web/src/domain/names.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import {
  POPULAR_BANCA_MOVIL_PDF,
  POPULAR_CUENTA_CREDITO,
  POPULAR_DTR_ENVIADO,
  POPULAR_SINPE_ENVIADO,
  POPULAR_SINPE_RECIBIDO,
  POPULAR_TARJETA_COLONES,
  POPULAR_TARJETA_DOLARES,
} from '../fixtures/popularMails.js';

const categoryOf = (parsed) =>
  categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category;

test('Banco Popular: compra con tarjeta en colones', () => {
  const parsed = parseFirstApproved(POPULAR_TARJETA_COLONES);
  assert.equal(parsed.template, 'Popular tarjeta');
  assert.equal(parsed.bank, 'POPULAR');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1250000);
  assert.equal(parsed.counterparty, 'VERDULERIA DE PRUEBA GUANACASTE CR');
  assert.equal(displayName(parsed.counterparty), 'Verduleria De Prueba Guanacaste');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 16, 49));
  assert.equal(parsed.note, 'Tarjeta ****0000');
  assert.equal(parsed.declined, false);
});

test('Banco Popular: compra con tarjeta en dólares, en Nicaragua', () => {
  const parsed = parseFirstApproved(POPULAR_TARJETA_DOLARES);
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 2550);
  assert.equal(displayName(parsed.counterparty), 'Restaurante De Prueba Granada', 'sin el "NI" del final');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 16, 11, 56));
  assert.equal(categoryOf(parsed), 'comida');
});

test('Banco Popular: compra con tarjeta en córdobas', () => {
  const body = POPULAR_TARJETA_DOLARES.body.replace('25.50Dolares US', '950.00Cordobas');
  const parsed = parseFirstApproved({ ...POPULAR_TARJETA_DOLARES, body });
  assert.equal(parsed.currency, 'NIO');
  assert.equal(parsed.amountCents, 95000);
});

test('Banco Popular: SINPE Móvil enviado (débito) se lee como gasto, con quien lo recibió', () => {
  const parsed = parseFirstApproved(POPULAR_SINPE_ENVIADO);
  assert.equal(parsed.template, 'Popular SINPE');
  assert.equal(parsed.bank, 'POPULAR');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 350000);
  assert.equal(parsed.counterparty, 'PERSONA DESTINO PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 20, 30, 27));
  assert.equal(parsed.note, 'Motivo: prueba SINPE · Sinpe Móvil');
  assert.equal(categoryOf(parsed), 'transfer');
});

test('Banco Popular: SINPE recibido (crédito) se lee como ingreso, con el nombre sin guiones bajos', () => {
  const parsed = parseFirstApproved(POPULAR_SINPE_RECIBIDO);
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 15000000);
  assert.equal(parsed.counterparty, 'PERSONA ORIGEN PRUEBA', 'el banco escribe PERSONA_ORIGEN_PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 16, 12, 31, 32));
  assert.equal(parsed.note, 'Motivo: Pago Prueba · Pagos Inmediatos');
  assert.equal(categoryOf(parsed), 'ingreso');
});

test('Banco Popular: un SINPE entre cuentas del mismo titular (nombre recortado) es entre mis cuentas', () => {
  // Como en los correos reales: el origen viene recortado a 20 letras y con "_" ("CLIENTE_DE_PRUEBA_LA").
  const body = POPULAR_SINPE_RECIBIDO.body
    .replace('PERSONA_ORIGEN_PRUEBA', 'CLIENTE_DE_PRUEBA_LA')
    .replace('CLIENTE__DE_PRUEBA', 'CLIENTE DE PRUEBA LARGO');
  const parsed = parseFirstApproved({ ...POPULAR_SINPE_RECIBIDO, body });
  assert.equal(parsed.direction, 'self');
  assert.match(parsed.note, /^Entre tus cuentas/);
  assert.equal(categoryOf(parsed), 'propias');
});

test('Banco Popular: un SINPE que el banco no aplicó queda como negado', () => {
  const body = POPULAR_SINPE_ENVIADO.body.replace('Aplicado', 'Rechazado');
  const result = parseMail({ ...POPULAR_SINPE_ENVIADO, body });
  assert.equal(result.items[0].declined, true);
  assert.equal(result.items[0].status, 'Rechazado');
});

test('Banco Popular: la versión en texto plano (valor en la línea siguiente) da el mismo resultado', () => {
  const asPlainText = (mail) => ({ ...mail, body: mail.body.replace(/:\t+/g, ':\n') });
  for (const mail of [POPULAR_SINPE_ENVIADO, POPULAR_SINPE_RECIBIDO]) {
    assert.deepEqual(parseFirstApproved(asPlainText(mail)), parseFirstApproved(mail), mail.subject);
  }
});

test('Banco Popular: el aviso de la cuenta, el DTR y el comprobante en PDF no se leen (evita contar dos veces)', () => {
  for (const mail of [POPULAR_CUENTA_CREDITO, POPULAR_DTR_ENVIADO, POPULAR_BANCA_MOVIL_PDF]) {
    const result = parseMail(mail);
    assert.equal(result.ok, false, mail.subject);
    assert.equal(result.bank, 'POPULAR', mail.subject);
  }
});
