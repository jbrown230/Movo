// Dibuja el reporte de movimientos como un libro de Excel con la apariencia de Movo: título y franja morada,
// cuatro tarjetas de resumen, la tabla con encabezado oscuro y filas alternadas, y el balance al final.
// ExcelJS pesa bastante, así que se carga solo cuando la persona exporta.

const ACCENT = '5A33E6';
const ACCENT_SOFT = 'F5F3FF';
const INK = '14111F';
const MUTED = '6B667D';
const SOFT_GRAY = '8A859C';
const GREEN = '0E9F6E';
const RED = 'DC2626';
const CARD = 'F9FAFB';
const LINE = 'E5E7EB';
const WHITE = 'FFFFFF';

const COLUMN_WIDTHS = [18, 34, 14, 9, 19, 16, 18, 13, 22];
const LAST_COLUMN = COLUMN_WIDTHS.length;
const CURRENCY_FORMAT = '"₡"#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const A4_PAPER = 9;
const FONT = 'Calibri';

const TONE_COLOR = { income: GREEN, own: SOFT_GRAY, expense: INK };
const RIGHT_ALIGNED_COLUMNS = [3, 5]; // "Monto" y "Monto en colones" (desde 1)
const CENTERED_COLUMNS = [4]; // "Moneda"

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${argb}` } });
const edge = (color = LINE, style = 'thin') => ({ style, color: { argb: `FF${color}` } });
const box = (color) => ({ top: edge(color), bottom: edge(color), left: edge(color), right: edge(color) });
const font = (size, color, extra = {}) => ({ name: FONT, size, color: { argb: `FF${color}` }, ...extra });

/** Combina un tramo de columnas de una fila y escribe en él. */
function writeSpan(sheet, rowNumber, [from, to], { value, ...style }) {
  if (to > from) sheet.mergeCells(rowNumber, from, rowNumber, to);
  const cell = sheet.getCell(rowNumber, from);
  cell.value = value;
  Object.assign(cell, style);
  // Los bordes de una celda combinada salen de cada una de sus celdas.
  for (let column = from + 1; column <= to; column++) {
    const slave = sheet.getCell(rowNumber, column);
    if (style.fill) slave.fill = style.fill;
    if (style.border) slave.border = style.border;
  }
}

/** La siguiente fila vacía de la hoja, con su altura. */
function nextRow(sheet, height) {
  const row = sheet.getRow(sheet.rowCount + 1);
  row.height = height;
  return row.number;
}

function addTitleBlock(sheet, report) {
  const whole = [1, LAST_COLUMN];
  writeSpan(sheet, nextRow(sheet, 30), whole, {
    value: 'Movo',
    font: font(20, INK, { bold: true }),
    alignment: { vertical: 'middle' },
  });
  writeSpan(sheet, nextRow(sheet, 18), whole, {
    value: 'REPORTE DE MOVIMIENTOS',
    font: font(10, ACCENT, { bold: true }),
    alignment: { vertical: 'middle' },
  });

  const period = nextRow(sheet, 16);
  writeSpan(sheet, period, [1, 5], { value: report.subtitle, font: font(9, MUTED) });
  writeSpan(sheet, period, [6, LAST_COLUMN], {
    value: report.generatedAt,
    font: font(9, MUTED),
    alignment: { horizontal: 'right' },
  });
  if (report.filtersLine) {
    writeSpan(sheet, nextRow(sheet, 16), whole, { value: report.filtersLine, font: font(9, MUTED, { italic: true }) });
  }
  writeSpan(sheet, nextRow(sheet, 4), whole, { value: null, fill: fill(ACCENT) }); // la franja morada
  nextRow(sheet, 8);
}

/** Cuatro tarjetas: una etiqueta con un filete morado arriba y el monto debajo. */
function addSummaryCards(sheet, { totals }) {
  const cards = [
    { span: [1, 2], label: 'GASTOS', value: totals.spent, color: INK },
    { span: [3, 5], label: 'INGRESOS', value: totals.income, color: GREEN },
    { span: [6, 7], label: 'ENTRE MIS CUENTAS', value: totals.movedBetweenOwnAccounts, color: SOFT_GRAY },
    { span: [8, LAST_COLUMN], label: 'BALANCE', value: totals.balance, color: totals.balance < 0 ? RED : ACCENT },
  ];
  const labelRow = nextRow(sheet, 18);
  const valueRow = nextRow(sheet, 30);
  for (const { span, label, value, color } of cards) {
    writeSpan(sheet, labelRow, span, {
      value: label,
      font: font(8, MUTED, { bold: true }),
      fill: fill(CARD),
      border: { top: edge(ACCENT, 'medium'), left: edge(), right: edge() },
      alignment: { horizontal: 'center', vertical: 'bottom' },
    });
    writeSpan(sheet, valueRow, span, {
      value,
      font: font(14, color, { bold: true }),
      fill: fill(CARD),
      numFmt: CURRENCY_FORMAT,
      border: { bottom: edge(), left: edge(), right: edge() },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
  }
  nextRow(sheet, 12);
}

function headerAlignment(column) {
  if (RIGHT_ALIGNED_COLUMNS.includes(column)) return 'right';
  return CENTERED_COLUMNS.includes(column) ? 'center' : 'left';
}

function addTableHeader(sheet, { columns }) {
  const row = sheet.getRow(nextRow(sheet, 24));
  columns.forEach((title, index) => {
    const cell = row.getCell(index + 1);
    cell.value = title;
    cell.font = font(9, WHITE, { bold: true });
    cell.fill = fill(INK);
    cell.border = box(INK);
    cell.alignment = { horizontal: headerAlignment(index + 1), vertical: 'middle' };
  });
}

function addRows(sheet, { rows }) {
  rows.forEach((item, index) => {
    const row = sheet.getRow(nextRow(sheet, 18));
    const values = [
      item.when,
      item.counterparty,
      item.amount,
      item.currency,
      item.crc,
      item.category,
      item.direction,
      item.type,
      item.bank,
    ];
    const background = fill(index % 2 === 1 ? ACCENT_SOFT : WHITE);
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1);
      cell.value = value;
      cell.font = font(9, INK);
      cell.fill = background;
      cell.border = box(LINE);
      cell.alignment = { horizontal: headerAlignment(column + 1), vertical: 'middle' };
    });
    row.getCell(1).numFmt = DATE_FORMAT;
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(5).numFmt = CURRENCY_FORMAT;
    row.getCell(5).font = font(9, TONE_COLOR[item.tone], { bold: true });
  });
}

/** El balance al final, en una franja morada, como la fila de total de los reportes de billardOS. */
function addBalanceRow(sheet, { totals }) {
  const rowNumber = nextRow(sheet, 24);
  const strip = { font: font(10, WHITE, { bold: true }), fill: fill(ACCENT), border: box(ACCENT) };
  writeSpan(sheet, rowNumber, [1, 4], { value: 'BALANCE DEL PERÍODO', ...strip, alignment: { vertical: 'middle' } });
  writeSpan(sheet, rowNumber, [5, 5], {
    value: totals.balance,
    ...strip,
    numFmt: CURRENCY_FORMAT,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  writeSpan(sheet, rowNumber, [6, LAST_COLUMN], { value: null, ...strip });
}

function addEmptyNotice(sheet) {
  writeSpan(sheet, nextRow(sheet, 28), [1, LAST_COLUMN], {
    value: 'No hay movimientos con estos filtros.',
    font: font(10, MUTED),
    border: box(LINE),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
}

/**
 * @param {import('../../application/movementsReport.js').MovementsReport} report
 * @returns {Promise<Uint8Array>} El archivo .xlsx.
 */
export async function writeMovementsWorkbook(report) {
  const module = await import('exceljs');
  const ExcelJS = module.default ?? module;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Movo';
  workbook.created = report.createdAt;

  const sheet = workbook.addWorksheet('Movimientos', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: A4_PAPER, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  addTitleBlock(sheet, report);
  addSummaryCards(sheet, report);
  addTableHeader(sheet, report);
  if (report.rows.length) {
    addRows(sheet, report);
    addBalanceRow(sheet, report);
  } else {
    addEmptyNotice(sheet);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
