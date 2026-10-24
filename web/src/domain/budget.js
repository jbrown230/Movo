// Presupuesto del mes: cuánto se lleva gastado y cuándo avisar. Módulo puro.
//
// Hay un presupuesto global y, si la persona quiere, uno por categoría. Se avisa al llegar al
// umbral (80 % si no se elige otro) y otra vez al llegar al 100 %.

import { AUTOMATIC_ONLY_CATEGORY_KEYS, CATEGORIES } from './categories.js';

export const DEFAULT_ALERT_PERCENT = 80;

/** Umbrales que se ofrecen en Ajustes. */
export const ALERT_PERCENT_OPTIONS = Object.freeze([50, 60, 70, 80, 90]);

const FULL_PERCENT = 100;

export const BudgetLevel = Object.freeze({ OK: 'ok', WARNING: 'aviso', EXCEEDED: 'excedido' });

/** Ámbito de una alerta que no es de una categoría. */
export const TOTAL_BUDGET_SCOPE = 'total';

/** Categorías que pueden tener presupuesto propio: las de gasto (no ingresos ni entre mis cuentas). */
export const BUDGETABLE_CATEGORY_KEYS = Object.freeze(
  Object.keys(CATEGORIES).filter((key) => !AUTOMATIC_ONLY_CATEGORY_KEYS.includes(key)),
);

/**
 * Porcentaje gastado del presupuesto, redondeado hacia abajo: con el 79,9 % todavía no se avisa
 * del 80 %, y el 100 % solo llega cuando se gastó el presupuesto completo. Sin presupuesto, null.
 */
export function budgetPercent(spentCents, budgetCents) {
  if (!(budgetCents > 0)) return null;
  return Math.floor((Math.max(0, spentCents) * FULL_PERCENT) / budgetCents);
}

/** Umbral válido: un entero entre 1 y 99. Cualquier otra cosa vuelve al predeterminado. */
export function toAlertPercent(value) {
  return Number.isInteger(value) && value > 0 && value < FULL_PERCENT ? value : DEFAULT_ALERT_PERCENT;
}

/** Nivel del presupuesto para un porcentaje gastado. */
export function budgetLevel(percent, alertPercent = DEFAULT_ALERT_PERCENT) {
  if (percent === null) return BudgetLevel.OK;
  if (percent >= FULL_PERCENT) return BudgetLevel.EXCEEDED;
  if (percent >= toAlertPercent(alertPercent)) return BudgetLevel.WARNING;
  return BudgetLevel.OK;
}

/** Cómo va un presupuesto: porcentaje, nivel y lo que queda (negativo si se pasó). */
export function budgetStatus({ spentCents, budgetCents, alertPercent }) {
  const percent = budgetPercent(spentCents, budgetCents);
  return {
    spentCents,
    budgetCents,
    percent,
    level: budgetLevel(percent, alertPercent),
    remainingCents: budgetCents - spentCents,
  };
}

/**
 * Deja solo los presupuestos por categoría válidos: de una categoría de gasto y con un monto entero positivo.
 *
 * @param {unknown} value
 * @returns {Object<string, number>}  Céntimos por clave de categoría.
 */
export function sanitizeCategoryBudgets(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, cents]) => BUDGETABLE_CATEGORY_KEYS.includes(key) && Number.isInteger(cents) && cents > 0,
    ),
  );
}

const LEVEL_ORDER = [BudgetLevel.EXCEEDED, BudgetLevel.WARNING];

/**
 * @typedef {Object} BudgetAlert
 * @property {string} scope         'total' o la clave de la categoría.
 * @property {string} level         'aviso' o 'excedido'.
 * @property {number} percent
 * @property {number} spentCents
 * @property {number} budgetCents
 */

/**
 * Las alertas del mes: el presupuesto global y los de cada categoría que llegaron al umbral o se pasaron.
 * Primero las excedidas; dentro de cada nivel, primero la global.
 *
 * @param {{ summary: {spentCents: number, byCategory: Array<{category: string, totalCents: number}>},
 *           budgetCents: number, categoryBudgets?: Object<string, number>, alertPercent?: number }} input
 * @returns {BudgetAlert[]}
 */
export function budgetAlerts({ summary, budgetCents, categoryBudgets = {}, alertPercent = DEFAULT_ALERT_PERCENT }) {
  const spentByCategory = new Map(summary.byCategory.map((row) => [row.category, row.totalCents]));
  const candidates = [
    { scope: TOTAL_BUDGET_SCOPE, spentCents: summary.spentCents, budgetCents },
    ...Object.entries(sanitizeCategoryBudgets(categoryBudgets)).map(([category, cents]) => ({
      scope: category,
      spentCents: spentByCategory.get(category) ?? 0,
      budgetCents: cents,
    })),
  ];
  return candidates
    .map((candidate) => {
      const { percent, level } = budgetStatus({ ...candidate, alertPercent });
      return { ...candidate, percent, level };
    })
    .filter((alert) => alert.level !== BudgetLevel.OK)
    .sort((first, second) => LEVEL_ORDER.indexOf(first.level) - LEVEL_ORDER.indexOf(second.level));
}
