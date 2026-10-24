import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BudgetLevel,
  budgetAlerts,
  budgetLevel,
  budgetPercent,
  sanitizeCategoryBudgets,
  toAlertPercent,
} from '../../web/src/domain/budget.js';

const colones = (amount) => amount * 100;

test('presupuesto: el porcentaje se redondea hacia abajo', () => {
  assert.equal(budgetPercent(colones(279_999), colones(350_000)), 79, 'el 79,99 % todavía no es el 80 %');
  assert.equal(budgetPercent(colones(280_000), colones(350_000)), 80);
  assert.equal(budgetPercent(colones(349_999), colones(350_000)), 99, 'el 100 % solo llega con todo gastado');
  assert.equal(budgetPercent(colones(350_000), colones(350_000)), 100);
  assert.equal(budgetPercent(colones(700_000), colones(350_000)), 200);
});

test('presupuesto: sin presupuesto no hay porcentaje, y un gasto negativo cuenta como cero', () => {
  assert.equal(budgetPercent(colones(1000), 0), null);
  assert.equal(budgetPercent(colones(1000), undefined), null);
  assert.equal(budgetPercent(-500, colones(1000)), 0);
});

test('presupuesto: nivel según el umbral y el 100 %', () => {
  assert.equal(budgetLevel(79), BudgetLevel.OK);
  assert.equal(budgetLevel(80), BudgetLevel.WARNING);
  assert.equal(budgetLevel(99), BudgetLevel.WARNING);
  assert.equal(budgetLevel(100), BudgetLevel.EXCEEDED);
  assert.equal(budgetLevel(65, 60), BudgetLevel.WARNING, 'con el umbral en 60 %');
  assert.equal(budgetLevel(null), BudgetLevel.OK);
});

test('presupuesto: un umbral inválido vuelve al 80 %', () => {
  assert.equal(toAlertPercent(70), 70);
  for (const invalid of [0, 100, 150, -5, 80.5, '70', null, undefined]) assert.equal(toAlertPercent(invalid), 80);
});

test('presupuesto por categoría: solo categorías de gasto con montos enteros positivos', () => {
  const budgets = sanitizeCategoryBudgets({
    comida: colones(50_000),
    super: 0,
    ocio: -100,
    salud: 12.5,
    ingreso: colones(1000),
    propias: colones(1000),
    inventada: colones(1000),
  });
  assert.deepEqual(budgets, { comida: colones(50_000) });
  assert.deepEqual(sanitizeCategoryBudgets(null), {});
  assert.deepEqual(sanitizeCategoryBudgets('texto'), {});
});

test('alertas: global y por categoría, primero las excedidas y, en cada nivel, primero la global', () => {
  const summary = {
    spentCents: colones(300_000),
    byCategory: [
      { category: 'comida', totalCents: colones(60_000) },
      { category: 'super', totalCents: colones(41_000) },
      { category: 'ocio', totalCents: colones(10_000) },
    ],
  };
  const alerts = budgetAlerts({
    summary,
    budgetCents: colones(350_000),
    categoryBudgets: { comida: colones(50_000), super: colones(50_000), ocio: colones(50_000), salud: colones(1) },
  });
  assert.deepEqual(
    alerts.map(({ scope, level, percent }) => [scope, level, percent]),
    [
      ['comida', 'excedido', 120],
      ['total', 'aviso', 85],
      ['super', 'aviso', 82],
    ],
    'ocio va en 20 % y salud no tiene gastos: no avisan',
  );
});

test('alertas: el umbral elegido cambia cuándo se avisa', () => {
  const summary = { spentCents: colones(210_000), byCategory: [] };
  assert.equal(budgetAlerts({ summary, budgetCents: colones(350_000) }).length, 0, '60 % con el umbral en 80 %');
  const [alert] = budgetAlerts({ summary, budgetCents: colones(350_000), alertPercent: 60 });
  assert.equal(alert.level, BudgetLevel.WARNING);
  assert.equal(alert.percent, 60);
});
