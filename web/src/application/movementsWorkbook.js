// El libro de Excel de los movimientos, con la apariencia de Movo: título y franja morada, cuatro tarjetas
// de resumen, la tabla con encabezado oscuro y filas alternadas, y el balance al final.

import { Direction } from '../domain/types.js';
import { buildXlsx } from '../domain/xlsx.js';
import { EXPORT_HEADER, labelsOf, localDay } from './exportLabels.js';

// Colores de la marca (los mismos de la app).
const ACCENT = '5A33E6';
const ACCENT_SOFT = 'F5F3FF';
const INK = '14111F';
const MUTED = '6B667D';
const SOFT_GRAY = '8A859C';
const GREEN = '0E9F6E';
const RED = 'DC2626';
const CARD = 'F6F5FA';
const LINE = 'E5E2EE';
const WHITE = 'FFFFFF';

const COLUMN_WIDTHS = [18, 34, 14, 9, 19, 16, 18, 13, 22];
const LAST_COLUMN = COLUMN_WIDTHS.length - 1;
const CURRENCY_FORMAT = '"₡"#,##0.00';
const DECIMAL_FORMAT = '#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy\\ hh:mm';
const MS_PER_DAY = 86_400_000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const FIRST_COLUMN_CODE = 65; // "A"

const hairline = { style: 'thin', color: LINE };
const box = (edge) => ({ left: edge, right: edge, top: edge, bottom: edge });
const columnLetter = (index) => String.fromCharCode(FIRST_COLUMN_CODE + index);

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

// ---------------------------------------------------------------- piezas de la hoja

/** Arma la hoja fila por fila, llevando la cuenta de las celdas combinadas. */
function createSheetBuilder() {
  const rows = [];
  const merges = [];
  return {
    rows,
    merges,
    add: (cells, height) => rows.push({ height, cells }),
    /** Una fila hecha de tramos de columnas; cada tramo es una celda combinada con su valor y su estilo. */
    addSpans(spans, height) {
      const cells = Array(COLUMN_WIDTHS.length).fill(null);
      const rowNumber = rows.length + 1;
      for (const { from, to, value, style } of spans) {
        for (let column = from; column <= to; column++)
          cells[column] = { value: column === from ? value : null, style };
        if (to > from) merges.push(`${columnLetter(from)}${rowNumber}:${columnLetter(to)}${rowNumber}`);
      }
      rows.push({ height, cells });
    },
    addBlank: (height) => rows.push({ height, cells: [] }),
  };
}

const note = (value, font = {}, align = {}) => ({ value, style: { font: { size: 9, color: MUTED, ...font }, align } });
const wholeRow = (cell) => ({ from: 0, to: LAST_COLUMN, ...cell });

function subtitleOf(transactions) {
  if (!transactions.length) return 'Sin movimientos';
  const first = localDay(new Date(transactions[0].date));
  const last = localDay(new Date(transactions.at(-1).date));
  const count = `${transactions.length} movimiento${transactions.length === 1 ? '' : 's'}`;
  return `${first === last ? first : `${first} – ${last}`} · ${count}`;
}

const generatedAt = (now) =>
  `Generado el ${localDay(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

function addHeader(sheet, { transactions, filterLabels, now }) {
  const title = { font: { size: 24, bold: true, color: ACCENT }, align: { vertical: 'center' } };
  sheet.addSpans([wholeRow({ value: 'Movo', style: title })], 36);
  sheet.addSpans([wholeRow(note('REPORTE DE MOVIMIENTOS', { size: 10, bold: true, color: INK }))], 18);
  sheet.addSpans(
    [
      { from: 0, to: 4, ...note(subtitleOf(transactions)) },
      { from: 5, to: LAST_COLUMN, ...note(generatedAt(now), {}, { horizontal: 'right' }) },
    ],
    16,
  );
  const filters = filterLabels.length ? `Filtros: ${filterLabels.join(' · ')}` : null;
  sheet.addSpans([wholeRow(note(filters, { italic: true }))], filters ? 16 : 4);
  sheet.addSpans([wholeRow({ value: null, style: { fill: ACCENT } })], 4); // la franja morada
  sheet.addBlank(8);
}

/** Cuatro tarjetas: una etiqueta con un filete morado arriba y el monto debajo. */
function addSummaryCards(sheet, totals) {
  const cards = [
    { from: 0, to: 1, label: 'GASTOS', value: totals.spent, color: INK },
    { from: 2, to: 4, label: 'INGRESOS', value: totals.income, color: GREEN },
    { from: 5, to: 6, label: 'ENTRE MIS CUENTAS', value: totals.movedBetweenOwnAccounts, color: SOFT_GRAY },
    { from: 7, to: LAST_COLUMN, label: 'BALANCE', value: totals.balance, color: totals.balance < 0 ? RED : ACCENT },
  ];
  const labelStyle = {
    font: { size: 8, bold: true, color: MUTED },
    fill: CARD,
    border: { left: hairline, right: hairline, top: { style: 'medium', color: ACCENT } },
    align: { horizontal: 'center', vertical: 'bottom' },
  };
  const valueStyle = (color) => ({
    font: { size: 15, bold: true, color },
    fill: CARD,
    numFmt: CURRENCY_FORMAT,
    border: { left: hairline, right: hairline, bottom: hairline },
    align: { horizontal: 'center', vertical: 'center' },
  });
  sheet.addSpans(
    cards.map(({ from, to, label }) => ({ from, to, value: label, style: labelStyle })),
    18,
  );
  sheet.addSpans(
    cards.map(({ from, to, value, color }) => ({ from, to, value, style: valueStyle(color) })),
    30,
  );
  sheet.addBlank(12);
}

const RIGHT_ALIGNED_COLUMNS = [2, 4]; // "Monto" y "Monto en colones"
const CENTERED_COLUMNS = [3]; // "Moneda"

function headerAlignment(column) {
  if (RIGHT_ALIGNED_COLUMNS.includes(column)) return 'right';
  return CENTERED_COLUMNS.includes(column) ? 'center' : 'left';
}

function addTableHeader(sheet) {
  const cells = EXPORT_HEADER.map((title, column) => ({
    value: title,
    style: {
      font: { size: 9, bold: true, color: WHITE },
      fill: INK,
      border: box({ style: 'thin', color: INK }),
      align: { horizontal: headerAlignment(column), vertical: 'center' },
    },
  }));
  sheet.add(cells, 24);
}

/** Qué color lleva el monto en colones: ingreso en verde, lo que se mueve entre mis cuentas en gris. */
function amountColor(direction) {
  if (direction === Direction.INCOME) return GREEN;
  if (direction === Direction.OWN_TRANSFER) return SOFT_GRAY;
  return INK;
}

function transactionCells(transaction, rowIndex) {
  const labels = labelsOf(transaction);
  const fill = rowIndex % 2 === 1 ? ACCENT_SOFT : WHITE;
  const align = (horizontal) => ({ horizontal, vertical: 'center' });
  const cell = (value, extra = {}) => ({
    value,
    style: { font: { size: 9, color: INK }, fill, border: box(hairline), align: align('left'), ...extra },
  });
  return [
    cell(excelDate(transaction.date), { numFmt: DATE_FORMAT }),
    cell(transaction.counterparty),
    cell(transaction.amountCents / 100, { numFmt: DECIMAL_FORMAT, align: align('right') }),
    cell(transaction.currency, { align: align('center') }),
    cell(transaction.crcCents / 100, {
      numFmt: CURRENCY_FORMAT,
      font: { size: 9, bold: true, color: amountColor(transaction.direction) },
      align: align('right'),
    }),
    cell(labels.category),
    cell(labels.direction),
    cell(labels.type),
    cell(labels.bank),
  ];
}

/** El balance al final, en una franja morada, como la fila de total de los otros reportes. */
function addBalanceRow(sheet, balance) {
  const strip = {
    font: { size: 10, bold: true, color: WHITE },
    fill: ACCENT,
    border: box({ style: 'thin', color: ACCENT }),
    align: { horizontal: 'left', vertical: 'center' },
  };
  const amount = { ...strip, numFmt: CURRENCY_FORMAT, align: { horizontal: 'right', vertical: 'center' } };
  sheet.addSpans(
    [
      { from: 0, to: 3, value: 'BALANCE DEL PERÍODO', style: strip },
      { from: 4, to: 4, value: balance, style: amount },
      { from: 5, to: LAST_COLUMN, value: null, style: strip },
    ],
    26,
  );
}

function addEmptyNotice(sheet) {
  const style = {
    font: { size: 10, color: MUTED },
    border: box(hairline),
    align: { horizontal: 'center', vertical: 'center' },
  };
  sheet.addSpans([wholeRow({ value: 'No hay movimientos con estos filtros.', style })], 28);
}

/**
 * @param {Object} report
 * @param {Array} report.transactions  Del más viejo al más nuevo.
 * @param {string[]} [report.filterLabels]  Los filtros puestos, para anotarlos bajo el título.
 * @param {Date} [report.now]
 * @returns {Uint8Array} El archivo .xlsx.
 */
export function buildMovementsWorkbook({ transactions, filterLabels = [], now = new Date() }) {
  const sheet = createSheetBuilder();
  addHeader(sheet, { transactions, filterLabels, now });
  addSummaryCards(sheet, totalsOf(transactions));
  addTableHeader(sheet);
  if (transactions.length) {
    transactions.forEach((transaction, index) => sheet.add(transactionCells(transaction, index), 19));
    addBalanceRow(sheet, totalsOf(transactions).balance);
  } else {
    addEmptyNotice(sheet);
  }
  return buildXlsx({
    name: 'Movimientos',
    columnWidths: COLUMN_WIDTHS,
    rows: sheet.rows,
    merges: sheet.merges,
    isLandscape: true,
    createdAt: now,
  });
}
