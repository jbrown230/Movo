import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize } from '../../web/src/domain/categories.js';
import { displayName, isSamePerson, normalizeKey } from '../../web/src/domain/names.js';
import { transactionIdForMail } from '../../web/src/domain/ids.js';
import { toColonesCents, textToCents } from '../../web/src/domain/money.js';
import { monthRange } from '../../web/src/domain/period.js';

const expense = (counterparty, type, userRules) => categorize({ counterparty, type, direction: 'out', userRules });

test('categorías: palabras clave del comercio', () => {
  assert.equal(expense('SUPER LA AMISTAD', 'tarjeta').category, 'super');
  assert.equal(expense('SERVICENTRO LA SABANA', 'tarjeta').category, 'transporte');
  assert.equal(expense('SODA LA CEIBA', 'tarjeta').category, 'comida');
  assert.equal(expense('SERVICIO DIGITAL SUB', 'tarjeta').category, 'otros');
});

test('categorías: un SINPE sin pistas es una transferencia', () => {
  assert.equal(expense('MARIA EJEMPLO', 'sinpe').category, 'transfer');
});

test('categorías: las reglas de la persona ganan a las automáticas', () => {
  const rules = [{ match: 'MARIA EJEMPLO', category: 'comida' }];
  const result = expense('MARIA EJEMPLO', 'sinpe', rules);
  assert.equal(result.category, 'comida');
  assert.equal(result.origin, 'tu regla');
});

test('categorías: ingresos y movimientos entre cuentas propias tienen categoría fija', () => {
  assert.equal(categorize({ counterparty: 'X', type: 'sinpe', direction: 'in' }).category, 'ingreso');
  assert.equal(categorize({ counterparty: 'X', type: 'sinpe', direction: 'self' }).category, 'propias');
});

test('isSamePerson tolera orden, tildes y nombres recortados, pero no familiares', () => {
  const full = 'APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2';
  assert.ok(isSamePerson(full, full));
  assert.ok(isSamePerson(full, 'NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2'));
  assert.ok(isSamePerson(full, 'APELLIDO1 APELLIDO2 NOMBRE1 NO'), 'recortado por el banco');
  assert.ok(isSamePerson('Núñez Pérez José', 'NUNEZ PEREZ JOSE'), 'con tildes');
  assert.equal(isSamePerson(full, 'APELLIDO1 APELLIDO2 HERMANA'), false, 'familiar con los mismos apellidos');
  assert.equal(isSamePerson('APELLIDO1 APELLIDO2 NOMBRE1', 'APELLIDO1 APELLIDO2'), false, 'solo apellidos no alcanza');
  assert.equal(isSamePerson(full, 'OTRA PERSONA DISTINTA'), false);
});

test('displayName deja un nombre de comercio limpio para mostrar', () => {
  assert.equal(displayName('SERVICIO DIGITAL  SUB  00000000000 US'), 'Servicio Digital Sub');
  assert.equal(displayName('UBER *TRIP'), 'Uber *Trip');
  assert.equal(displayName('SODA DONA ROSA'), 'Soda Dona Rosa');
  assert.equal(displayName('1234567'), '1234567', 'no deja el nombre vacío');
});

test('normalizeKey quita tildes y espacios repetidos', () => {
  assert.equal(normalizeKey('  Doña   Rosa '), 'DONA ROSA');
});

test('el id de un movimiento depende solo del correo y de la fila', () => {
  assert.equal(transactionIdForMail('<a@b>', 0), transactionIdForMail('<a@b>', 0));
  assert.notEqual(transactionIdForMail('<a@b>', 0), transactionIdForMail('<a@b>', 1));
  assert.notEqual(transactionIdForMail('<a@b>', 0), transactionIdForMail('<c@d>', 0));
});

test('dinero: céntimos y conversión de dólares a colones', () => {
  assert.equal(textToCents('12,500.50'), 1250050);
  assert.equal(toColonesCents(799, 'USD', 500), 399500);
  assert.equal(toColonesCents(1500, 'CRC', 500), 1500);
});

test('monthRange cubre el mes completo', () => {
  const { from, to } = monthRange(new Date(2026, 0, 15));
  assert.equal(new Date(from).getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(new Date(to).getTime(), new Date(2026, 1, 1).getTime());
});
