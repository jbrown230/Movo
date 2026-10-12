import { Currency } from '../types.js';

const DOLLAR_HINT = /USD|US\$|\$|D[OÓ]LAR|DOLLAR/i;
const COLON_HINT = /CRC|₡|COLON/i;

/** Moneda a partir de un texto como "US DOLLAR", "COLONES" o "$". Sin pistas, colones. */
export function detectCurrency(text = '') {
  return DOLLAR_HINT.test(text) && !COLON_HINT.test(text) ? Currency.USD : Currency.CRC;
}
