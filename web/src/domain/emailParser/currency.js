import { Currency } from '../types.js';

const EURO_HINT = /EUR|€/i; // también cubre EURO y EUROS
const CORDOBA_HINT = /C[OÓ]RDOBA|NIO|C\$/i; // "CORDOBA ORO", "Córdobas", "NIO" o "C$"
const DOLLAR_HINT = /USD|US\$|\$|D[OÓ]LAR|DOLLAR/i;
const COLON_HINT = /CRC|₡|COLON/i;

/** Moneda a partir de un texto como "US DOLLAR", "EURO", "CORDOBA ORO", "COLONES" o "$". Sin pistas, colones. */
export function detectCurrency(text = '') {
  if (COLON_HINT.test(text)) return Currency.CRC;
  if (EURO_HINT.test(text)) return Currency.EUR;
  if (CORDOBA_HINT.test(text)) return Currency.NIO;
  return DOLLAR_HINT.test(text) ? Currency.USD : Currency.CRC;
}

/**
 * ¿El texto nombra una moneda que Movo sabe convertir? Si un banco escribe otra ("LIBRA", "PESO MEXICANO") no debe
 * contarse como colones: esa fila no se lee y el correo queda para registrarlo a mano.
 */
export const isKnownCurrencyText = (text = '') =>
  [COLON_HINT, EURO_HINT, CORDOBA_HINT, DOLLAR_HINT].some((hint) => hint.test(text));
