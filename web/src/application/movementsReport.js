// Los datos del reporte de movimientos, ya calculados y con sus nombres en español: totales, fechas y una fila
// por movimiento. Cómo se dibuja (Excel, colores, tipografía) es asunto de la infraestructura.

import { Direction } from '../domain/types.js';
import { EXPORT_HEADER, labelsOf, localDay } from './exportLabels.js';

/** @typedef {'income'|'own'|'expense'} AmountTone  Cómo se destaca el monto: ingreso, entre mis cuentas o gasto. */

/**
 * @typedef {Object} MovementsReport
 * @property {string} subtitle  Rango de fechas y cantidad de movimientos.
 * @property {string} generatedAt
 * @property {string|null} filtersLine  Los filtros puestos, o null.
 * @property {{ spent: number, income: number, movedBetweenOwnAccounts: number, balance: number }} totals  En colones.
 * @property {string[]} columns  Los títulos de la tabla.
 * @property {Array<{ when: Date, counterparty: string, amount: number, currency: string, crc: number,
 *   category: string, direction: string, type: string, bank: string, tone: AmountTone }>} rows
 * @property {Date} createdAt
 */

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

/**
 * La hora del teléfono como si fuera UTC: así una hoja de cálculo, que no maneja zonas horarias, muestra
 * la misma hora que se ve en la app.
 */
function asWallClock(iso) {
  const date = new Date(iso);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()));
}

/** @returns {AmountTone} */
function toneOf(direction) {
  if (direction === Direction.INCOME) return 'income';
  return direction === Direction.OWN_TRANSFER ? 'own' : 'expense';
}

function subtitleOf(transactions) {
  if (!transactions.length) return 'Sin movimientos';
  const first = localDay(new Date(transactions[0].date));
  const last = localDay(new Date(transactions.at(-1).date));
  const count = `${transactions.length} movimiento${transactions.length === 1 ? '' : 's'}`;
  return `${first === last ? first : `${first} – ${last}`} · ${count}`;
}

const twoDigits = (number) => String(number).padStart(2, '0');
const generatedAt = (now) => `Generado el ${localDay(now)} ${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;

function toReportRow(transaction) {
  const labels = labelsOf(transaction);
  return {
    when: asWallClock(transaction.date),
    counterparty: transaction.counterparty,
    amount: transaction.amountCents / 100,
    currency: transaction.currency,
    crc: transaction.crcCents / 100,
    category: labels.category,
    direction: labels.direction,
    type: labels.type,
    bank: labels.bank,
    tone: toneOf(transaction.direction),
  };
}

/**
 * @param {Object} input
 * @param {Array} input.transactions  Del más viejo al más nuevo.
 * @param {string[]} [input.filterLabels]  Los filtros puestos.
 * @param {Date} [input.now]
 * @returns {MovementsReport}
 */
export function buildMovementsReport({ transactions, filterLabels = [], now = new Date() }) {
  return {
    subtitle: subtitleOf(transactions),
    generatedAt: generatedAt(now),
    filtersLine: filterLabels.length ? `Filtros: ${filterLabels.join(' · ')}` : null,
    totals: totalsOf(transactions),
    columns: EXPORT_HEADER,
    rows: transactions.map(toReportRow),
    createdAt: now,
  };
}
