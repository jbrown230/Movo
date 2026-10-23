// Caso de uso: exportar a un archivo los movimientos que cumplen unos filtros: un Excel (.xlsx) con la
// apariencia de Movo y los totales, o un CSV sencillo.

import { toCsv } from '../domain/csv.js';
import { EXPORT_HEADER, labelsOf, localDateTime } from './exportLabels.js';
import { buildMovementsReport } from './movementsReport.js';
import { toListFilters } from './transactionFilters.js';

/** Separadores del CSV: Excel en español espera punto y coma; en inglés y Google Sheets, coma. */
export const CsvSeparator = Object.freeze({ SEMICOLON: ';', COMMA: ',' });

/** Formatos de archivo que se ofrecen. */
export const ExportFormat = Object.freeze({ XLSX: 'xlsx', CSV: 'csv' });

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Tope de movimientos por archivo; muy por encima de lo que acumula una persona. */
export const MAX_EXPORTED_TRANSACTIONS = 100_000;

/** Monto sin símbolo ni separador de miles. Con punto y coma, la coma decimal que espera Excel en español. */
function amountText(cents, separator) {
  const text = (cents / 100).toFixed(2);
  return separator === CsvSeparator.SEMICOLON ? text.replace('.', ',') : text;
}

function toRow(transaction, separator) {
  const labels = labelsOf(transaction);
  return [
    localDateTime(transaction.date),
    transaction.counterparty,
    amountText(transaction.amountCents, separator),
    transaction.currency,
    amountText(transaction.crcCents, separator),
    labels.category,
    labels.direction,
    labels.type,
    labels.bank,
  ];
}

/**
 * @param {Object} dependencies
 * @param {{ list: Function }} dependencies.transactions
 * @param {(report: import('./movementsReport.js').MovementsReport) => Promise<Uint8Array>} dependencies.writeMovementsWorkbook
 *   Dibuja el reporte como un libro de Excel (ver application/ports.js).
 */
export function createExportTransactions({ transactions, writeMovementsWorkbook }) {
  /**
   * @param {{ format?: string, separator?: string, filterLabels?: string[], now?: Date }} options
   *   Además, los mismos filtros que la lista de movimientos (`searchTransactions`): fechas, categoría, tipo,
   *   banco, montos y texto. Sin filtros, se exporta todo. `filterLabels` se anota en el Excel bajo el título.
   * @returns {Promise<{ fileName: string, content: string|Uint8Array, mimeType: string, count: number }>}
   *   El archivo, del movimiento más viejo al más nuevo.
   */
  return async function exportTransactions({
    format = ExportFormat.CSV,
    separator = CsvSeparator.SEMICOLON,
    filterLabels = [],
    now = new Date(),
    ...filters
  } = {}) {
    const { fromDay, toDay } = filters;
    const exported = transactions.list(toListFilters(filters), MAX_EXPORTED_TRANSACTIONS).reverse();
    const baseName = `movo-movimientos-${fromDay || 'inicio'}-a-${toDay || 'hoy'}`;

    if (format === ExportFormat.XLSX) {
      const content = await writeMovementsWorkbook(buildMovementsReport({ transactions: exported, filterLabels, now }));
      return { fileName: `${baseName}.xlsx`, content, mimeType: XLSX_MIME_TYPE, count: exported.length };
    }
    const rows = exported.map((transaction) => toRow(transaction, separator));
    return {
      fileName: `${baseName}.csv`,
      content: toCsv(EXPORT_HEADER, rows, separator),
      mimeType: CSV_MIME_TYPE,
      count: exported.length,
    };
  };
}
