// Plantilla REAL del BCR: "Notificación de Transacciones BCR" (tarjeta).
//
// El correo trae una tabla; al convertirlo a texto cada fila queda en una línea,
// con las celdas separadas por tabulador:
//   Fecha  Autorización  No.Referencia  Monto  Moneda  Comercio  Estado
//   15/01/2026 09:00:00  00000001  000000000002  20.00  US DOLLAR  SERVICIO DIGITAL SUB 00000000000 US  Aprobada
// Un solo correo puede traer varias filas, y alguna puede venir "Negada".

import { Direction, TransactionType } from '../../types.js';
import { parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour } from '../dateTime.js';
import { collapseSpaces, isDeclinedStatus } from '../text.js';

const DATE_TIME = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/;
const STARTS_WITH_DATE = /^\d{1,2}\/\d{1,2}\/\d{4}/;
const CARD_LAST_FOUR = /\*{4}-?\*{4}-?\*{4}-?(\d{4})/;

const toLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const isHeaderLine = (line) => /Fecha/i.test(line) && /Monto/i.test(line) && /Moneda/i.test(line);

/** Separa una fila en celdas: por tabulador, o por 2+ espacios si el texto se copió a mano. */
const splitCells = (line) => (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/)).map((cell) => cell.trim());

function buildItem({ dateText, amountText, currencyText, merchant, status, cardLastFour }) {
  const match = dateText.match(DATE_TIME);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, meridiem] = match;
  return {
    type: TransactionType.CARD,
    direction: Direction.EXPENSE,
    currency: detectCurrency(currencyText),
    amount: parseAmount(amountText),
    counterparty: merchant,
    date: costaRicaToIso({ year, month, day, hour: to24Hour(hour || 12, meridiem), minute: minute || 0, second: second || 0 }),
    declined: isDeclinedStatus(status),
    status: collapseSpaces(status) || null,
    note: cardLastFour ? `Tarjeta ****${cardLastFour}` : null,
  };
}

/** Lee las filas de la tabla usando los nombres de las columnas del encabezado. */
function readTable(lines, headerIndex, cardLastFour) {
  const headers = splitCells(lines[headerIndex]).map((cell) => cell.toLowerCase());
  const columnOf = (pattern) => headers.findIndex((header) => pattern.test(header));
  const columns = {
    date: columnOf(/fecha/),
    amount: columnOf(/monto/),
    currency: columnOf(/moneda/),
    merchant: columnOf(/comercio|establecimiento|descrip/),
    status: columnOf(/estado/),
  };
  if (headers.length < 4 || columns.date === -1 || columns.amount === -1) return [];

  const items = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCells(line);
    const looksLikeRow = cells.length >= headers.length - 1 && STARTS_WITH_DATE.test(cells[columns.date] || '');
    if (!looksLikeRow) continue;
    const item = buildItem({
      dateText: cells[columns.date],
      amountText: cells[columns.amount],
      currencyText: cells[columns.currency] ?? '',
      merchant: columns.merchant > -1 ? cells[columns.merchant] : '',
      status: columns.status > -1 ? cells[columns.status] : '',
      cardLastFour,
    });
    if (item) items.push(item);
  }
  return items;
}

// Respaldo: la fila completa en una sola línea, con espacios simples entre las celdas.
const SINGLE_LINE_ROW = new RegExp(
  '(\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)\\s+\\d+\\s+\\d+\\s+(\\d[\\d.,]*|\\.\\d+)\\s+' +
  '(US DOLLAR|D[OÓ]LAR(?:ES)?|USD|COLON(?:ES)?(?: COSTARRICENSES?)?|CRC)\\s+(.+?)\\s+' +
  '(Aprobad[ao]|Negad[ao]|Rechazad[ao]|Declinad[ao]|Anulad[ao]|Procesad[ao])\\s*$',
  'gim',
);

function readSingleLineRows(text, cardLastFour) {
  const items = [];
  for (const [, dateText, amountText, currencyText, merchant, status] of text.matchAll(SINGLE_LINE_ROW)) {
    const item = buildItem({ dateText, amountText, currencyText, merchant, status, cardLastFour });
    if (item) items.push(item);
  }
  return items;
}

/** @returns {Array|null} Las transacciones de la tabla, o null si el texto no trae una. */
export function parseBcrCard(text) {
  const lines = toLines(text);
  const cardLastFour = text.match(CARD_LAST_FOUR)?.[1];
  const headerIndex = lines.findIndex(isHeaderLine);

  let items = headerIndex > -1 ? readTable(lines, headerIndex, cardLastFour) : [];
  if (!items.length) items = readSingleLineRows(text, cardLastFour);
  return items.length ? items : null;
}
