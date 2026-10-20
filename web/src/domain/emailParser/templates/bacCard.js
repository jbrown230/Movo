// Plantilla REAL de BAC Credomatic: "Notificación de Transacción" (tarjeta).
//
// Remitente: NotificacionBAC@baccredomatic.cr
//
// El correo es una tabla HTML. Según cómo se convierta a texto, las celdas pueden quedar:
//   - etiqueta y valor separados por tabulador,
//   - el valor en la línea siguiente,
//   - o todo pegado en una sola línea.
// Por eso este parser NO depende de los saltos de línea: lee cada valor desde su etiqueta
// hasta la siguiente etiqueta conocida.
//
// Campos esperados:
//   Comercio:             MAXIPALI UPALA WCN00PV
//   Ciudad y país:        ALAJUELA, Costa Rica
//   Fecha:                Oct 18, 2026, 19:15
//   AMEX:                 ***********6643
//   Autorización:         715770
//   Referencia:           08728573
//   Tipo de Transacción:  COMPRA
//   Monto:                CRC 126,267.00

import { Direction, TransactionType } from '../../types.js';
import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour } from '../dateTime.js';
import { collapseSpaces, isDeclinedStatus } from '../text.js';

const MONTH_MAP = Object.freeze({
  ene: 1,
  jan: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  set: 9,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  dec: 12,
});

const CARD_LAST_FOUR = /[*•]{4,}\s*(\d{4})/;

const MONTH_FIRST_DATE =
  /([A-Za-zÁ-ú]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/i;
const DAY_FIRST_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/;

// Etiquetas conocidas del correo. Sirven como "frontera" para saber dónde termina cada valor.
const FIELD_LABELS = [
  'Comercio',
  'Ciudad y pa[ií]s',
  'Fecha',
  'AMEX',
  'VISA',
  'MASTERCARD',
  'Autorizaci[oó]n',
  'Referencia',
  'Tipo de Transacci[oó]n',
  'Monto',
].join('|');

/** Deja el texto en una forma estable: NFC, sin espacios raros ni caracteres invisibles. */
function normalizeText(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n');
}

function parseDate(text) {
  if (!text) return null;

  const monthMatch = text.match(MONTH_FIRST_DATE);
  if (monthMatch) {
    const [, monthName, day, year, hour, minute, second, meridiem] = monthMatch;
    const month = MONTH_MAP[monthName.toLowerCase().slice(0, 3)];
    if (!month) return null;
    return costaRicaToIso({
      year,
      month,
      day,
      hour: to24Hour(hour || 12, meridiem),
      minute: minute || 0,
      second: second || 0,
    });
  }

  const numericMatch = text.match(DAY_FIRST_DATE);
  if (numericMatch) {
    const [, day, month, year, hour, minute, second, meridiem] = numericMatch;
    return costaRicaToIso({
      year,
      month,
      day,
      hour: to24Hour(hour || 12, meridiem),
      minute: minute || 0,
      second: second || 0,
    });
  }

  return null;
}

/**
 * Lee el valor que sigue a una etiqueta, hasta la próxima etiqueta conocida o el fin del texto.
 * Funciona con valores en la misma línea, en la línea siguiente o todo pegado.
 */
function readField(text, labelPattern) {
  const pattern = new RegExp(
    `(?:^|[^A-Za-zÁ-ú])${labelPattern}\\s*:\\s*([\\s\\S]*?)(?=(?:${FIELD_LABELS})\\s*:|$)`,
    'i',
  );
  const value = text.match(pattern)?.[1];
  return value ? collapseSpaces(value) || null : null;
}

/** El monto va con moneda delante: "CRC 15,000.00". parseAmount solo entiende el número. */
const AMOUNT_LINE = new RegExp(`Monto\\s*:\\s*((?:CRC|USD|¢|₡|\\$)?)\\s*${AMOUNT_PATTERN}`, 'i');

function readMoney(text) {
  const match = text.match(AMOUNT_LINE);
  if (!match) return null;
  const amount = parseAmount(match[2]);
  if (!amount || Number.isNaN(amount)) return null;
  return { amount, currency: detectCurrency(match[1] || match[2]) };
}

function looksLikeBacCard(text) {
  return /Comercio\s*:/i.test(text) && /Tipo de Transacci[oó]n\s*:/i.test(text) && /Monto\s*:/i.test(text);
}

/** @returns {Array|null} La compra con tarjeta de BAC, o null si el texto no es de esta plantilla. */
export function parseBacCard(rawText) {
  const text = normalizeText(rawText);
  if (!looksLikeBacCard(text)) return null;

  const merchant = readField(text, 'Comercio');
  const money = readMoney(text);
  if (!merchant || !money) return null;

  const txType = readField(text, 'Tipo de Transacci[oó]n') || 'COMPRA';
  const cardLastFour = text.match(CARD_LAST_FOUR)?.[1];

  return [
    {
      type: TransactionType.CARD,
      direction: Direction.EXPENSE,
      currency: money.currency,
      amount: money.amount,
      counterparty: merchant,
      date: parseDate(readField(text, 'Fecha')),
      declined: isDeclinedStatus(txType),
      status: collapseSpaces(txType) || null,
      note: cardLastFour ? `Tarjeta ****${cardLastFour}` : null,
    },
  ];
}
