// Libro de Excel (.xlsx) de una sola hoja. Lo abren Excel, Google Sheets, Numbers y LibreOffice.
//
// La hoja se describe como filas de celdas ({ value, style }) y una lista de celdas combinadas. Cada estilo es un
// objeto (tipografía, relleno, bordes, formato de número y alineación): el libro los reúne sin repetir.
// Los textos van dentro de la celda (`inlineStr`), así que nunca se interpretan como fórmulas.

import { zipStore } from './zip.js';

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const SHEET_NAME_MAX_LENGTH = 31;
const FIRST_COLUMN_CODE = 65; // "A"
const DEFAULT_FONT = Object.freeze({ size: 11, color: '14111F', bold: false, italic: false });
const FIRST_CUSTOM_FORMAT_ID = 164;
const BUILT_IN_FORMATS = Object.freeze({ General: 0, 0: 1, '#,##0.00': 4 });

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

// ---------------------------------------------------------------- estilos

/** Lista de cosas distintas: pedir una repetida devuelve la misma posición. */
function createRegistry(seed = []) {
  const entries = new Map();
  const intern = (item) => {
    const key = JSON.stringify(item);
    if (!entries.has(key)) entries.set(key, { index: entries.size, item });
    return entries.get(key).index;
  };
  seed.forEach(intern);
  return { intern, items: () => [...entries.values()].map((entry) => entry.item) };
}

const fontXml = ({ size, color, bold, italic }) =>
  `<font>${bold ? '<b/>' : ''}${italic ? '<i/>' : ''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/><family val="2"/></font>`;

const fillXml = (fill) => {
  if (fill.kind) return `<fill><patternFill patternType="${fill.kind}"/></fill>`;
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${fill.color}"/><bgColor indexed="64"/></patternFill></fill>`;
};

const SIDES = ['left', 'right', 'top', 'bottom'];
const sideXml = (side, edge) =>
  edge ? `<${side} style="${edge.style}"><color rgb="FF${edge.color}"/></${side}>` : `<${side}/>`;
const borderXml = (border) =>
  `<border>${SIDES.map((side) => sideXml(side, border[side])).join('')}<diagonal/></border>`;

function alignmentXml(align) {
  if (!align) return '';
  const wrap = align.wrap ? ' wrapText="1"' : '';
  return `<alignment horizontal="${align.horizontal ?? 'general'}" vertical="${align.vertical ?? 'bottom'}"${wrap}/>`;
}

const xfXml = ({ numFmtId, fontId, fillId, borderId, align }) =>
  `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1"' : ''}>${alignmentXml(align)}</xf>`;

/**
 * Reúne los estilos de la hoja. `styleIndex(estilo)` da la posición del estilo en `cellXfs`;
 * `toXml()` escribe la hoja de estilos completa.
 *
 * Un estilo: { font?: { size, color, bold, italic }, fill?: 'RRGGBB', border?: { left, right, top, bottom: { style, color } },
 *              numFmt?: string, align?: { horizontal, vertical, wrap } }
 */
function createStyleBook() {
  const fonts = createRegistry([DEFAULT_FONT]);
  const fills = createRegistry([{ kind: 'none' }, { kind: 'gray125' }]);
  const borders = createRegistry([{}]);
  const customFormats = new Map();
  const cellFormats = createRegistry([{ numFmtId: 0, fontId: 0, fillId: 0, borderId: 0, align: null }]);

  const numFmtId = (code) => {
    if (code === undefined) return 0;
    if (code in BUILT_IN_FORMATS) return BUILT_IN_FORMATS[code];
    if (!customFormats.has(code)) customFormats.set(code, FIRST_CUSTOM_FORMAT_ID + customFormats.size);
    return customFormats.get(code);
  };

  const styleIndex = (style = {}) =>
    cellFormats.intern({
      numFmtId: numFmtId(style.numFmt),
      fontId: fonts.intern({ ...DEFAULT_FONT, ...style.font }),
      fillId: style.fill ? fills.intern({ color: style.fill }) : 0,
      borderId: style.border ? borders.intern(style.border) : 0,
      align: style.align ?? null,
    });

  const toXml = () => {
    const formats = [...customFormats].map(
      ([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`,
    );
    const section = (tag, items, render) => `<${tag} count="${items.length}">${items.map(render).join('')}</${tag}>`;
    return (
      `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">` +
      (formats.length ? `<numFmts count="${formats.length}">${formats.join('')}</numFmts>` : '') +
      section('fonts', fonts.items(), fontXml) +
      section('fills', fills.items(), fillXml) +
      section('borders', borders.items(), borderXml) +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      section('cellXfs', cellFormats.items(), xfXml) +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  };
  return { styleIndex, toXml };
}

// ---------------------------------------------------------------- hoja

function cellXml(cell, reference, styleIndex) {
  const style = styleIndex(cell.style);
  if (cell.value === null || cell.value === undefined) return `<c r="${reference}" s="${style}"/>`;
  if (typeof cell.value === 'number') return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function rowXml(row, rowNumber, styleIndex) {
  const height = row.height ? ` ht="${row.height}" customHeight="1"` : '';
  const cells = row.cells
    .map((cell, index) => (cell ? cellXml(cell, `${columnLetter(index)}${rowNumber}`, styleIndex) : ''))
    .join('');
  return `<row r="${rowNumber}"${height}>${cells}</row>`;
}

function sheetXml({ columnWidths, rows, merges, isLandscape }, styleIndex) {
  const lastColumn = columnLetter(columnWidths.length - 1);
  const cols = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const mergeCells = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  const orientation = isLandscape ? 'landscape' : 'portrait';
  return (
    `${XML_HEADER}<worksheet xmlns="${MAIN_NS}">` +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${lastColumn}${rows.length}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="18" customHeight="1"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.map((row, index) => rowXml(row, index + 1, styleIndex)).join('')}</sheetData>` +
    `${mergeCells}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>'
  );
}

// ---------------------------------------------------------------- paquete

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
 * @param {Array<{ height?: number, cells: Array<{ value: string|number|null, style?: object }|null> }>} sheet.rows
 * @param {string[]} [sheet.merges]  Celdas combinadas, por ejemplo "A1:I1".
 * @param {boolean} [sheet.isLandscape]  Hoja horizontal al imprimir; se ajusta al ancho de la página.
 * @param {Date} [sheet.createdAt]  Fecha que se anota en el archivo.
 * @returns {Uint8Array}
 */
export function buildXlsx({ name, columnWidths, rows, merges = [], isLandscape = false, createdAt = new Date() }) {
  const encoder = new TextEncoder();
  const part = (partName, text) => ({ name: partName, data: encoder.encode(text) });
  const styleBook = createStyleBook();
  const sheet = sheetXml({ columnWidths, rows, merges, isLandscape }, styleBook.styleIndex); // llena los estilos
  return zipStore(
    [
      part('[Content_Types].xml', CONTENT_TYPES_XML),
      part('_rels/.rels', ROOT_RELS_XML),
      part('xl/workbook.xml', workbookXml(name)),
      part('xl/_rels/workbook.xml.rels', WORKBOOK_RELS_XML),
      part('xl/styles.xml', styleBook.toXml()),
      part('xl/worksheets/sheet1.xml', sheet),
    ],
    createdAt,
  );
}
