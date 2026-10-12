// Textos que describen un movimiento en pantalla.

import { Direction, TransactionType } from '../../domain/types.js';

/** Signo que se muestra delante del monto: "+" ingreso, "−" gasto, nada si es entre cuentas propias. */
export function amountSign(transaction) {
  if (transaction.direction === Direction.INCOME) return '+';
  if (transaction.direction === Direction.OWN_TRANSFER) return '';
  return '−';
}

/** "SINPE Móvil, BCR", "Tarjeta, BAC", "Efectivo"... */
export function describeTransaction(transaction) {
  const bankSuffix = transaction.bank ? `, ${transaction.bank}` : '';
  if (transaction.direction === Direction.OWN_TRANSFER) return `Entre tus cuentas${bankSuffix}`;
  switch (transaction.type) {
    case TransactionType.SINPE:
      return `SINPE Móvil${bankSuffix}`;
    case TransactionType.CASH:
      return 'Efectivo';
    case TransactionType.CARD:
      return `Tarjeta${bankSuffix}`;
    default:
      return `Transferencia${bankSuffix}`;
  }
}

/** Clase CSS del monto según cómo cuenta el movimiento. */
export function amountClass(transaction) {
  if (transaction.direction === Direction.INCOME) return 'a in';
  if (transaction.direction === Direction.OWN_TRANSFER) return 'a self';
  return 'a';
}
