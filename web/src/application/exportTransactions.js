// Caso de uso: exportar a un archivo CSV para Excel los movimientos que cumplen unos filtros.

import { BANKS } from '../domain/banks.js';
import { getCategory } from '../domain/categories.js';
import { toCsv } from '../domain/csv.js';
import { Direction, TransactionType } from '../domain/types.js';
import { toListFilters } from './transactionFilters.js';

/** Separadores que se ofrecen: Excel en español espera punto y coma; en inglés y Google Sheets, coma. */
export const CsvSeparator = Object.freeze({ SEMICOLON: ';', COMMA: ',' });

/** Tope de movimientos por archivo; muy por encima de lo que acumula una persona. */
const MAX_EXPORTED_TRANSACTIONS = 100_000;

const HEADER = ['Fecha', 'Comercio', 'Monto', 'Moneda', 'Monto en colones', 'Categoría', 'Tipo', 'Medio', 'Banco'];

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

const twoDigits = (number) => String(number).padStart(2, '0');

/** "2026-01-15 10:30", en la hora del teléfono (la misma que se ve en la app). */
function localDateTime(iso) {
  const date = new Date(iso);
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
  return `${day} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** Monto sin símbolo ni separador de miles. Con punto y coma, la coma decimal que espera Excel en español. */
function amountText(cents, separator) {
  const text = (cents / 100).toFixed(2);
  return separator === CsvSeparator.SEMICOLON ? text.replace('.', ',') : text;
}

function toRow(transaction, separator) {
  return [
    localDateTime(transaction.date),
    transaction.counterparty,
    amountText(transaction.amountCents, separator),
    transaction.currency,
    amountText(transaction.crcCents, separator),
    getCategory(transaction.category).name,
    DIRECTION_NAME[transaction.direction] ?? '',
    TYPE_NAME[transaction.type] ?? '',
    BANKS[transaction.bank]?.name ?? '',
  ];
}

export function createExportTransactions({ transactions }) {
  /**
   * @param {{ separator?: string }} options  Además del separador, los mismos filtros que la lista de movimientos
   *   (`searchTransactions`): fechas, categoría, tipo, banco, montos y texto. Sin filtros, se exporta todo.
   * @returns {{ fileName: string, content: string, count: number }} El archivo, del movimiento más viejo al más nuevo.
   */
  return function exportTransactions({ separator = CsvSeparator.SEMICOLON, ...filters } = {}) {
    const { fromDay, toDay } = filters;
    const exported = transactions.list(toListFilters(filters), MAX_EXPORTED_TRANSACTIONS).reverse();
    return {
      fileName: `movo-movimientos-${fromDay || 'inicio'}-a-${toDay || 'hoy'}.csv`,
      content: toCsv(
        HEADER,
        exported.map((transaction) => toRow(transaction, separator)),
        separator,
      ),
      count: exported.length,
    };
  };
}
