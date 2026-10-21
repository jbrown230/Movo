// Filtros de la pantalla de movimientos, tal como los escribe la persona en los campos.

import { textToCents } from '../../domain/money.js';

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
