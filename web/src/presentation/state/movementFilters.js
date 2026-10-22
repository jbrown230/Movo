// Filtros de la pantalla de movimientos, tal como los escribe la persona en los campos.

import { BANKS } from '../../domain/banks.js';
import { getCategory } from '../../domain/categories.js';
import { textToCents } from '../../domain/money.js';
import { toDayString } from '../../domain/period.js';
import { Direction } from '../../domain/types.js';

/** Sin filtros: todos los movimientos. Los montos van como texto, igual que en el campo. */
export const NO_MOVEMENT_FILTERS = Object.freeze({
  text: '',
  fromDay: '',
  toDay: '',
  category: '',
  direction: '',
  bank: '',
  minAmountText: '',
  maxAmountText: '',
});

/** Céntimos de un monto escrito, o null si el campo está vacío o no es un número. */
function centsOrNull(text) {
  const cents = textToCents(text);
  return Number.isFinite(cents) && text.trim() !== '' ? cents : null;
}

/** Lo que espera `queries.searchTransactions` a partir de lo que hay en los campos. */
export function toSearchFilters({ minAmountText, maxAmountText, ...rest }) {
  return { ...rest, minCents: centsOrNull(minAmountText), maxCents: centsOrNull(maxAmountText) };
}

/** Cuántos filtros están puestos (incluidos la búsqueda de texto y el tipo). */
export const countActiveFilters = (filters) =>
  Object.values(filters).filter((value) => String(value).trim() !== '').length;

// Los que se eligen en la hoja "Filtros". La búsqueda y el tipo tienen sus propios controles en la pantalla.
const SHEET_FILTER_NAMES = ['fromDay', 'toDay', 'category', 'bank', 'minAmountText', 'maxAmountText'];

/** Cuántos filtros de la hoja "Filtros" están puestos; es el número que lleva el botón. */
export const countSheetFilters = (filters) => SHEET_FILTER_NAMES.filter((name) => filters[name] !== '').length;

/** Los mismos filtros sin los de la hoja "Filtros" (se conservan la búsqueda y el tipo). */
export const clearSheetFilters = (filters) => ({
  ...filters,
  ...Object.fromEntries(SHEET_FILTER_NAMES.map((name) => [name, ''])),
});

/** Avisos cuando un rango está al revés (desde mayor que hasta). */
export function rangeWarnings(filters) {
  const { minCents, maxCents } = toSearchFilters(filters);
  const warnings = [];
  if (filters.fromDay && filters.toDay && filters.fromDay > filters.toDay) {
    warnings.push('La fecha "desde" es posterior a la fecha "hasta".');
  }
  if (minCents !== null && maxCents !== null && minCents > maxCents) {
    warnings.push('El monto "desde" es mayor que el monto "hasta".');
  }
  return warnings;
}

/** Atajos de fecha de la hoja "Filtros": cada uno trae el día de inicio y el de fin ("AAAA-MM-DD"). */
export function datePresets(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const thirtyDaysAgo = new Date(year, month, today.getDate() - 29);
  return [
    { id: 'thisMonth', label: 'Este mes', fromDay: toDayString(new Date(year, month, 1)), toDay: toDayString(today) },
    {
      id: 'lastMonth',
      label: 'Mes pasado',
      fromDay: toDayString(new Date(year, month - 1, 1)),
      toDay: toDayString(new Date(year, month, 0)),
    },
    { id: 'last30', label: 'Últimos 30 días', fromDay: toDayString(thirtyDaysAgo), toDay: toDayString(today) },
    { id: 'thisYear', label: 'Este año', fromDay: toDayString(new Date(year, 0, 1)), toDay: toDayString(today) },
  ];
}

const DIRECTION_LABEL = Object.freeze({
  [Direction.EXPENSE]: 'Gastos',
  [Direction.INCOME]: 'Ingresos',
  [Direction.OWN_TRANSFER]: 'Entre mis cuentas',
});

/** "2026-01-15" -> "15/01/2026". */
const dayLabelOf = (day) => day.split('-').reverse().join('/');

/** "Desde X", "Hasta Y" o "X – Y" según qué extremos tenga el rango; null si no tiene ninguno. */
function rangeLabel(from, to, format) {
  if (from && to) return `${format(from)} – ${format(to)}`;
  if (from) return `Desde ${format(from)}`;
  if (to) return `Hasta ${format(to)}`;
  return null;
}

/** Los filtros puestos, como frases cortas para mostrar ("Ocio", "Desde 01/10/2026", "Desde ₡20000"). */
export function describeMovementFilters(filters) {
  const text = filters.text.trim();
  return [
    text && `“${text}”`,
    filters.direction && (DIRECTION_LABEL[filters.direction] ?? filters.direction),
    filters.category && getCategory(filters.category).name,
    filters.bank && (BANKS[filters.bank]?.name ?? filters.bank),
    rangeLabel(filters.fromDay, filters.toDay, dayLabelOf),
    rangeLabel(filters.minAmountText, filters.maxAmountText, (amount) => `₡${amount}`),
  ].filter(Boolean);
}
