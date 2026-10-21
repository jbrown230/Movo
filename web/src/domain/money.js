// Dinero: siempre en céntimos (enteros). Nunca se usan decimales flotantes para guardar montos.

import { parseAmount } from './emailParser/amount.js';
import { Currency } from './types.js';

/** Convierte lo que escribió la persona ("12,500.50") a céntimos. Devuelve NaN si no es un número. */
export function textToCents(text) {
  return Math.round(parseAmount(text) * 100);
}

/** Símbolo con el que se muestra cada moneda. */
export const CURRENCY_SYMBOL = Object.freeze({
  [Currency.CRC]: '₡',
  [Currency.USD]: 'US$',
  [Currency.EUR]: '€',
  [Currency.NIO]: 'C$',
});

export const isForeignCurrency = (currency) => currency !== Currency.CRC;

/**
 * Monto en colones, en céntimos. Los dólares, euros y córdobas se convierten con el tipo de cambio dado
 * (colones por unidad de la moneda); sin tipo de cambio quedan en 0 hasta que llegue uno.
 */
export function toColonesCents(amountCents, currency, exchangeRate) {
  if (!isForeignCurrency(currency)) return amountCents;
  return Math.round(amountCents * (exchangeRate || 0));
}
