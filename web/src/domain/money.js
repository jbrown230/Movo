// Dinero: siempre en céntimos (enteros). Nunca se usan decimales flotantes para guardar montos.

import { parseAmount } from './emailParser/amount.js';
import { Currency } from './types.js';

/** Convierte lo que escribió la persona ("12,500.50") a céntimos. Devuelve NaN si no es un número. */
export function textToCents(text) {
  return Math.round(parseAmount(text) * 100);
}

/** Monto en colones, en céntimos. Los dólares se convierten con el tipo de cambio dado. */
export function toColonesCents(amountCents, currency, exchangeRate) {
  if (currency !== Currency.USD) return amountCents;
  return Math.round(amountCents * (exchangeRate || 0));
}
