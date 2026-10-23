// Los nombres con que se muestra cada movimiento en un archivo exportado (CSV o Excel).

import { BANKS } from '../domain/banks.js';
import { getCategory } from '../domain/categories.js';
import { Direction, TransactionType } from '../domain/types.js';

export const EXPORT_HEADER = [
  'Fecha',
  'Comercio',
  'Monto',
  'Moneda',
  'Monto en colones',
  'Categoría',
  'Tipo',
  'Medio',
  'Banco',
];

const DIRECTION_NAME = Object.freeze({
  [Direction.EXPENSE]: 'Gasto',
  [Direction.INCOME]: 'Ingreso',
  [Direction.OWN_TRANSFER]: 'Entre mis cuentas',
});
const TYPE_NAME = Object.freeze({
  [TransactionType.SINPE]: 'SINPE',
  [TransactionType.CARD]: 'Tarjeta',
  [TransactionType.TRANSFER]: 'Transferencia',
  [TransactionType.CASH]: 'Efectivo',
});

/** Categoría, tipo, medio y banco de un movimiento, con su nombre en español. */
export function labelsOf(transaction) {
  return {
    category: getCategory(transaction.category).name,
    direction: DIRECTION_NAME[transaction.direction] ?? '',
    type: TYPE_NAME[transaction.type] ?? '',
    bank: BANKS[transaction.bank]?.name ?? '',
  };
}

const twoDigits = (number) => String(number).padStart(2, '0');

/** "2026-01-15 10:30", en la hora del teléfono (la misma que se ve en la app). */
export function localDateTime(iso) {
  const date = new Date(iso);
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
  return `${day} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** "15/01/2026", en la hora del teléfono. */
export function localDay(date) {
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
}
