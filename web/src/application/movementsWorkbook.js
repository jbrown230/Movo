// El libro de Excel de los movimientos: marca de Movo, totales arriba y la tabla debajo.

import { Direction } from '../domain/types.js';
import { Style, buildXlsx } from '../domain/xlsx.js';
import { EXPORT_HEADER, labelsOf, localDay } from './exportLabels.js';

const COLUMN_WIDTHS = [18, 38, 14, 9, 19, 16, 18, 15, 22];
const RIGHT_ALIGNED_COLUMNS = [2, 4]; // "Monto" y "Monto en colones": el encabezado queda sobre los números
const MS_PER_DAY = 86_400_000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/** Fecha y hora de Excel (días desde 1900), con la hora del teléfono tal como se ve en la app. */
function excelDate(iso) {
  const date = new Date(iso);
  const asIfUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
  return (asIfUtc - EXCEL_EPOCH_UTC) / MS_PER_DAY;
}

/** Totales en colones de los movimientos exportados. */
export function totalsOf(transactions) {
  const centsOf = (direction) =>
    transactions
      .filter((transaction) => transaction.direction === direction)
      .reduce((sum, transaction) => sum + transaction.crcCents, 0);
  const spent = centsOf(Direction.EXPENSE);
  const income = centsOf(Direction.INCOME);
  return {
    spent: spent / 100,
    income: income / 100,
    movedBetweenOwnAccounts: centsOf(Direction.OWN_TRANSFER) / 100,
    balance: (income - spent) / 100,
  };
}

const text = (value, style = Style.TEXT) => ({ value, style });

/** Quién cubre qué: un movimiento propio se ve en gris y un ingreso en verde. */
function colonesStyle(direction) {
  if (direction === Direction.INCOME) return Style.COLONES_INCOME;
  if (direction === Direction.OWN_TRANSFER) return Style.COLONES_OWN;
  return Style.COLONES;
}

function transactionRow(transaction) {
  const labels = labelsOf(transaction);
  return {
    cells: [
      { value: excelDate(transaction.date), style: Style.DATE },
      text(transaction.counterparty),
      { value: transaction.amountCents / 100, style: Style.AMOUNT },
      text(transaction.currency),
      { value: transaction.crcCents / 100, style: colonesStyle(transaction.direction) },
      text(labels.category),
      text(labels.direction),
      text(labels.type),
      text(labels.bank),
    ],
  };
}

const summaryRow = (label, value, style) => ({
  height: 24,
  cells: [
    { value: label, style: Style.LABEL },
    { value, style },
  ],
});

/** Del primer al último movimiento, y cuándo se generó el archivo. */
function subtitleOf(transactions, now) {
  const generated = `Generado el ${localDay(now)}`;
  if (!transactions.length) return `Movimientos · ${generated}`;
  const first = localDay(new Date(transactions[0].date));
  const last = localDay(new Date(transactions.at(-1).date));
  return `Movimientos · ${first === last ? first : `${first} – ${last}`} · ${generated}`;
}

function headerRow() {
  return {
    height: 24,
    cells: EXPORT_HEADER.map((title, index) => ({
      value: title.toUpperCase(),
      style: RIGHT_ALIGNED_COLUMNS.includes(index) ? Style.HEADER_RIGHT : Style.HEADER,
    })),
  };
}

/**
 * @param {Object} report
 * @param {Array} report.transactions  Del más viejo al más nuevo.
 * @param {string[]} [report.filterLabels]  Los filtros puestos, para anotarlos bajo el título.
 * @param {Date} [report.now]
 * @returns {Uint8Array} El archivo .xlsx.
 */
export function buildMovementsWorkbook({ transactions, filterLabels = [], now = new Date() }) {
  const totals = totalsOf(transactions);
  const header = headerRow();
  const rows = [
    { height: 38, cells: [{ value: 'Movo', style: Style.BRAND }] },
    { cells: [{ value: subtitleOf(transactions, now), style: Style.SUBTITLE }] },
    { cells: [filterLabels.length ? { value: `Filtros: ${filterLabels.join(' · ')}`, style: Style.SUBTITLE } : null] },
    summaryRow('Gastos', totals.spent, Style.TOTAL_COLONES),
    summaryRow('Ingresos', totals.income, Style.TOTAL_INCOME),
    summaryRow('Entre mis cuentas', totals.movedBetweenOwnAccounts, Style.TOTAL_COLONES),
    summaryRow('Balance', totals.balance, Style.TOTAL_COLONES),
    summaryRow('Movimientos', transactions.length, Style.TOTAL_COUNT),
    { cells: [] },
    header,
    ...transactions.map(transactionRow),
  ];
  return buildXlsx({
    name: 'Movimientos',
    columnWidths: COLUMN_WIDTHS,
    rows,
    autoFilterRow: transactions.length ? rows.indexOf(header) + 1 : undefined,
    createdAt: now,
  });
}
