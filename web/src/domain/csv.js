// Archivos CSV: texto en filas y columnas que Excel y Google Sheets abren como una tabla.

/** Marca al inicio del archivo que le dice a Excel que el texto es UTF-8 (así respeta tildes y ₡). */
export const UTF8_BOM = '﻿';

/** Excel espera fin de línea de Windows. */
const LINE_BREAK = '\r\n';

/**
 * Texto que una hoja de cálculo interpretaría como fórmula. Un comercio que empiece así se exporta con un
 * apóstrofo delante, para que no se ejecute nada al abrir el archivo.
 */
const LOOKS_LIKE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Una celda lista para el CSV. Va entre comillas si trae el separador, comillas, saltos de línea o espacios en
 * los bordes; las comillas internas se duplican. Los números se pasan como texto ya formateado.
 *
 * @param {string|number|null|undefined} value
 * @param {string} separator  ";" o ",".
 */
export function csvCell(value, separator) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && LOOKS_LIKE_FORMULA.test(text)) text = `'${text}`;
  const needsQuotes = text.includes(separator) || /["\r\n]/.test(text) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Texto completo del archivo: marca UTF-8, encabezado y una línea por fila.
 *
 * @param {string[]} header
 * @param {Array<Array<string|number|null>>} rows
 * @param {string} separator  ";" (Excel en español) o "," (Excel en inglés y Google Sheets).
 */
export function toCsv(header, rows, separator) {
  const lines = [header, ...rows].map((row) => row.map((cell) => csvCell(cell, separator)).join(separator));
  return UTF8_BOM + lines.join(LINE_BREAK) + LINE_BREAK;
}
