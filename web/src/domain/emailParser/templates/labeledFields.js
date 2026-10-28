// Lectura de campos "Etiqueta: valor" compartida por las plantillas de Davivienda y Banco Popular.
//
// Esos correos son una tabla de etiquetas y valores. Al pasarlos a texto queda "Etiqueta:<tab>valor"; en la
// versión de texto plano el valor puede quedar en la línea siguiente. Las dos formas se leen igual.

import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour, TIME_PATTERN } from '../dateTime.js';
import { collapseSpaces } from '../text.js';

/** "15/01/2026, a las 10:30:15" o "15/01/2026 12:11:46 PM". */
const DATE_TIME = new RegExp(`(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4}),?\\s*(?:a las\\s*)?${TIME_PATTERN}`, 'i');

/** "CRC 12500.00", "250000.00 CRC" o "¢20000.00". */
const MONEY = new RegExp(`^(CRC|USD|EUR|¢|₡|\\$)?\\s*${AMOUNT_PATTERN}\\s*(CRC|USD|EUR)?`, 'i');

/** Deja el texto en una forma estable: NFC, sin espacios raros ni caracteres invisibles. */
export function normalizeText(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n');
}

/** Valor de "Etiqueta: valor", en la misma línea o, si está vacía, en la siguiente. */
export function readField(text, labelPattern) {
  const match = text.match(new RegExp(`(?:^|\\n)\\s*${labelPattern}\\s*:[ \\t]*([^\\n]*)(?:\\n\\s*([^\\n]*))?`, 'i'));
  if (!match) return null;
  return collapseSpaces(match[1] || match[2]) || null;
}

export function parseDate(value) {
  const match = value?.match(DATE_TIME);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, meridiem] = match;
  // El asunto a veces dice "23:49:50 PM": con la hora ya en 24 horas, el PM sobra.
  const hour24 = Number(hour) > 12 ? Number(hour) : to24Hour(hour, meridiem);
  return costaRicaToIso({ year, month, day, hour: hour24, minute, second: second || 0 });
}

/** @returns {{amount: number, currency: string}|null} */
export function parseMoney(value) {
  const match = value?.match(MONEY);
  if (!match) return null;
  const amount = parseAmount(match[2]);
  if (!amount || Number.isNaN(amount)) return null;
  return { amount, currency: detectCurrency(match[1] || match[3] || '') };
}

/** Últimos 4 dígitos de "terminada en 0000" o "terminada en *0000". */
export const readLastFour = (text) => text.match(/terminada en \*?(\d{4})/i)?.[1] ?? null;
