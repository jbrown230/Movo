import { Currency } from '../types.js';

const EURO_HINT = /EUR|€/i; // también cubre EURO y EUROS
const DOLLAR_HINT = /USD|US\$|\$|D[OÓ]LAR|DOLLAR/i;
const COLON_HINT = /CRC|₡|COLON/i;

/** Moneda a partir de un texto como "US DOLLAR", "EURO", "COLONES" o "$". Sin pistas, colones. */
export function detectCurrency(text = '') {
  if (COLON_HINT.test(text)) return Currency.CRC;
  if (EURO_HINT.test(text)) return Currency.EUR;
  return DOLLAR_HINT.test(text) ? Currency.USD : Currency.CRC;
}
