// Libro de Excel (.xlsx) de una sola hoja, con la apariencia de Movo: sin cuadrícula, un encabezado limpio y
// el color de la marca. Lo abren Excel, Google Sheets, Numbers y LibreOffice.
//
// Cada hoja se describe como filas de celdas ({ value, style }). Los textos van dentro de la celda
// (`inlineStr`), así que nunca se interpretan como fórmulas.

import { zipStore } from './zip.js';

/** Estilos disponibles; cada uno es la posición de un `<xf>` en `STYLES_XML`. */
export const Style = Object.freeze({
  DEFAULT: 0,
  BRAND: 1,
  SUBTITLE: 2,
  LABEL: 3,
  TOTAL_COLONES: 4,
  TOTAL_COUNT: 5,
  HEADER: 6,
  HEADER_RIGHT: 7,
  DATE: 8,
  TEXT: 9,
  AMOUNT: 10,
  COLONES: 11,
  COLONES_INCOME: 12,
  COLONES_OWN: 13,
  TOTAL_INCOME: 14,
});

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const SHEET_NAME_MAX_LENGTH = 31;
const FIRST_COLUMN_CODE = 65; // "A"

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FONT_FAMILY = '<name val="Calibri"/><family val="2"/>';
const font = ({ size, color, bold = false }) =>
  `<font>${bold ? '<b/>' : ''}<sz val="${size}"/><color rgb="${color}"/>${FONT_FAMILY}</font>`;
const border = (bottom) =>
  `<border><left/><right/><top/><bottom${bottom ? ` style="${bottom.style}"><color rgb="${bottom.color}"/></bottom>` : '/>'}<diagonal/></border>`;
const xf = ({ numFmt = 0, fontId = 0, borderId = 0, align = null }) =>
  `<xf numFmtId="${numFmt}" fontId="${fontId}" fillId="0" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"${align ? ' applyAlignment="1"' : ''}>${align ? `<alignment ${align}/>` : ''}</xf>`;

const INK = 'FF14111F';
const MUTED = 'FF6B667D';
const ACCENT = 'FF5A33E6';
const GREEN = 'FF0E9F6E';
const SOFT_GRAY = 'FF8A859C';
const HAIRLINE = 'FFE5E2EE';

const COLONES_FORMAT = 164;
const DATE_FORMAT = 165;
const DECIMAL_FORMAT = 166;
const INTEGER_FORMAT = 1;

const FONTS = [
  font({ size: 11, color: INK }),
  font({ size: 24, color: ACCENT, bold: true }),
  font({ size: 10, color: MUTED }),
  font({ size: 14, color: INK, bold: true }),
  font({ size: 10, color: MUTED, bold: true }),
  font({ size: 11, color: GREEN, bold: true }),
  font({ size: 11, color: SOFT_GRAY }),
  font({ size: 14, color: GREEN, bold: true }),
];
const BORDERS = [border(null), border({ style: 'thin', color: HAIRLINE }), border({ style: 'medium', color: ACCENT })];

// El orden de esta lista es el de `Style`.
const CELL_FORMATS = [
  xf({}),
  xf({ fontId: 1, align: 'vertical="center"' }),
  xf({ fontId: 2 }),
  xf({ fontId: 2, align: 'vertical="center"' }),
  xf({ numFmt: COLONES_FORMAT, fontId: 3, align: 'horizontal="left"' }),
  xf({ numFmt: INTEGER_FORMAT, fontId: 3, align: 'horizontal="left"' }),
  xf({ fontId: 4, borderId: 2, align: 'horizontal="left" vertical="center"' }),
  xf({ fontId: 4, borderId: 2, align: 'horizontal="right" vertical="center"' }),
  xf({ numFmt: DATE_FORMAT, borderId: 1, align: 'horizontal="left"' }),
  xf({ borderId: 1 }),
  xf({ numFmt: DECIMAL_FORMAT, borderId: 1 }),
  xf({ numFmt: COLONES_FORMAT, borderId: 1 }),
  xf({ numFmt: COLONES_FORMAT, fontId: 5, borderId: 1 }),
  xf({ numFmt: COLONES_FORMAT, fontId: 6, borderId: 1 }),
  xf({ numFmt: COLONES_FORMAT, fontId: 7, align: 'horizontal="left"' }),
];

const STYLES_XML =
  `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">` +
  '<numFmts count="3">' +
  `<numFmt numFmtId="${COLONES_FORMAT}" formatCode="&quot;₡&quot;#,##0.00"/>` +
  `<numFmt numFmtId="${DATE_FORMAT}" formatCode="dd/mm/yyyy\\ hh:mm"/>` +
  `<numFmt numFmtId="${DECIMAL_FORMAT}" formatCode="#,##0.00"/>` +
  '</numFmts>' +
  `<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>` +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  `<borders count="${BORDERS.length}">${BORDERS.join('')}</borders>` +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  `<cellXfs count="${CELL_FORMATS.length}">${CELL_FORMATS.join('')}</cellXfs>` +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Texto seguro para ir dentro de XML: sin caracteres que XML no admite y con los símbolos escapados. */
export const escapeXml = (text) =>
  String(text)
    .replace(INVALID_XML_CHARACTERS, '')
    .replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);

/** "A", "B", ... para la columna de una posición (0 es la A). Una hoja de Movo nunca pasa de la Z. */
const columnLetter = (index) => String.fromCharCode(FIRST_COLUMN_CODE + index);

function cellXml(cell, reference) {
  const style = cell.style ?? Style.DEFAULT;
  if (cell.value === null || cell.value === undefined) return `<c r="${reference}" s="${style}"/>`;
  if (typeof cell.value === 'number') return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function rowXml(row, rowNumber) {
  const height = row.height ? ` ht="${row.height}" customHeight="1"` : '';
  const cells = row.cells
    .map((cell, index) => (cell ? cellXml(cell, `${columnLetter(index)}${rowNumber}`) : ''))
    .join('');
  return `<row r="${rowNumber}"${height}>${cells}</row>`;
}

function sheetXml({ columnWidths, rows, autoFilterRow }) {
  const lastColumn = columnLetter(columnWidths.length - 1);
  const cols = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const autoFilter = autoFilterRow ? `<autoFilter ref="A${autoFilterRow}:${lastColumn}${rows.length}"/>` : '';
  return (
    `${XML_HEADER}<worksheet xmlns="${MAIN_NS}">` +
    `<dimension ref="A1:${lastColumn}${rows.length}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="18" customHeight="1"/>' +
    `<cols>${cols}</cols><sheetData>${rows.map((row, index) => rowXml(row, index + 1)).join('')}</sheetData>` +
    `${autoFilter}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    '</worksheet>'
  );
}

const CONTENT_TYPES_XML =
  `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const relationship = (id, type, target) => `<Relationship Id="${id}" Type="${REL_NS}/${type}" Target="${target}"/>`;
const relationshipsXml = (...items) =>
  `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL_NS}">${items.join('')}</Relationships>`;

const ROOT_RELS_XML = relationshipsXml(relationship('rId1', 'officeDocument', 'xl/workbook.xml'));
const WORKBOOK_RELS_XML = relationshipsXml(
  relationship('rId1', 'worksheet', 'worksheets/sheet1.xml'),
  relationship('rId2', 'styles', 'styles.xml'),
);

const workbookXml = (sheetName) =>
  `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
  `<sheets><sheet name="${escapeXml(sheetName.slice(0, SHEET_NAME_MAX_LENGTH))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

/**
 * Arma el archivo .xlsx.
 *
 * @param {Object} sheet
 * @param {string} sheet.name  Nombre de la hoja (hasta 31 caracteres, sin : \ / ? * [ ]).
 * @param {number[]} sheet.columnWidths  Ancho de cada columna, en caracteres.
 * @param {Array<{ height?: number, cells: Array<{ value: string|number|null, style?: number }|null> }>} sheet.rows
 * @param {number} [sheet.autoFilterRow]  Fila del encabezado, para poner el filtro de Excel sobre la tabla.
 * @param {Date} [sheet.createdAt]  Fecha que se anota en el archivo.
 * @returns {Uint8Array}
 */
export function buildXlsx({ name, columnWidths, rows, autoFilterRow, createdAt = new Date() }) {
  const encoder = new TextEncoder();
  const part = (partName, text) => ({ name: partName, data: encoder.encode(text) });
  return zipStore(
    [
      part('[Content_Types].xml', CONTENT_TYPES_XML),
      part('_rels/.rels', ROOT_RELS_XML),
      part('xl/workbook.xml', workbookXml(name)),
      part('xl/_rels/workbook.xml.rels', WORKBOOK_RELS_XML),
      part('xl/styles.xml', STYLES_XML),
      part('xl/worksheets/sheet1.xml', sheetXml({ columnWidths, rows, autoFilterRow })),
    ],
    createdAt,
  );
}
