// Lector genérico por etiquetas, para bancos o formatos que todavía no tienen plantilla.
// Busca palabras como "Monto", "Comercio" o "Fecha" y toma el valor que sigue.

import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour } from '../dateTime.js';
import { isDeclinedStatus } from '../text.js';

const CURRENCY_PATTERN = '(CRC|USD|US\\$|₡|\\$|colones|d[oó]lares)';

const LABELED_AMOUNT = new RegExp(
  `(?:monto|importe|total|valor|cantidad)[^\\d\\n₡$.]{0,30}${CURRENCY_PATTERN}?\\s*${AMOUNT_PATTERN}\\s*${CURRENCY_PATTERN}?`,
  'i',
);
const CURRENCY_THEN_AMOUNT = new RegExp(`${CURRENCY_PATTERN}\\s*${AMOUNT_PATTERN}`, 'i');
const AMOUNT_THEN_CURRENCY = new RegExp(`${AMOUNT_PATTERN}\\s*${CURRENCY_PATTERN}`, 'i');

const LABELED_COUNTERPARTY =
  /(?:comercio|establecimiento|destinatario|beneficiario|remitente|nombre del comercio|nombre cliente (?:destino|origen)|a nombre de|lugar)\s*:\s*(.+)/i;
const COUNTERPARTY_IN_SENTENCE = /\s(?:a|en)\s+([A-ZÁÉÍÓÚÑÜ0-9 .&*'-]{3,}?)\s+(?:\(|el\s+\d)/;

const SLASH_DATE =
  /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d\n]{1,12}(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/;
const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;
const NOON = 12; // si el correo no trae hora, se asume mediodía

/** Primero busca el monto junto a una etiqueta; si no, cualquier número con moneda. */
function readAmount(text) {
  const labeled = text.match(LABELED_AMOUNT);
  if (labeled) {
    const amount = parseAmount(labeled[2]);
    if (amount > 0) return { amount, currency: detectCurrency((labeled[1] || '') + (labeled[3] || '')) };
  }

  const currencyFirst = text.match(CURRENCY_THEN_AMOUNT);
  if (currencyFirst) return { amount: parseAmount(currencyFirst[2]), currency: detectCurrency(currencyFirst[1]) };

  const amountFirst = text.match(AMOUNT_THEN_CURRENCY);
  if (amountFirst) return { amount: parseAmount(amountFirst[1]), currency: detectCurrency(amountFirst[2]) };

  return null;
}

function readDate(text) {
  const slash = text.match(SLASH_DATE);
  if (slash) {
    const [, day, month, year, hour, minute, second, meridiem] = slash;
    return costaRicaToIso({
      year,
      month,
      day,
      hour: hour ? to24Hour(hour, meridiem) : NOON,
      minute: minute || 0,
      second: second || 0,
    });
  }
  const iso = text.match(ISO_DATE);
  if (iso) {
    const [, year, month, day, hour, minute] = iso;
    return costaRicaToIso({ year, month, day, hour: hour || NOON, minute: minute || 0 });
  }
  return null;
}

/** @returns {Array|null} Una transacción, o null si no se encontró un monto. */
export function parseGeneric(text) {
  const amountFound = readAmount(text);
  if (!amountFound || !(amountFound.amount > 0)) return null;

  const counterparty = (text.match(LABELED_COUNTERPARTY) || text.match(COUNTERPARTY_IN_SENTENCE))?.[1];
  const status = text.match(/estado\s*:?\s*(\w+)/i)?.[1];

  return [
    {
      currency: amountFound.currency,
      amount: amountFound.amount,
      counterparty,
      date: readDate(text),
      declined: isDeclinedStatus(status),
    },
  ];
}
