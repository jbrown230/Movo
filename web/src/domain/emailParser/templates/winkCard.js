// Plantilla REAL de Wink: aviso de una compra con la tarjeta ("Notificación de transacción").
//
// Remitente: transacciones@holawink.com
//
// Con datos ficticios:
//   Se registró una transacción con tu tarjeta. Estos son los detalles de la transacción:
//   Tarjeta utilizada:  Terminada en 0000
//   Monto de la compra: 2,500.00
//   Comercio:           COMERCIO DE PRUEBA 0000000000 CR
//   Fecha y hora:       15/01/2026, 02:21 PM (hora de Costa Rica)
//
// El monto no trae moneda: sin una, se cuenta como colones. Si trae una ("USD 10.00") se respeta, y una que Movo
// no sabe convertir hace que el aviso no se lea (queda para registrarlo a mano). El aviso no distingue tarjeta de
// crédito de débito. El comercio sale tal cual lo escribe la red de tarjetas, con el código del país al final.

import { Direction, TransactionType } from '../../types.js';
import { collapseSpaces } from '../text.js';
import { normalizeText, parseDate, parseMoney, readField, readLastFour } from './labeledFields.js';

const IS_CARD_PURCHASE = /Se registr[oó] una transacci[oó]n con tu tarjeta/i;

/** @returns {Array|null} La compra del aviso, o null si el texto no es de esta plantilla. */
export function parseWinkCard(rawText) {
  const text = normalizeText(rawText).replace(/\*/g, '');
  if (!IS_CARD_PURCHASE.test(text)) return null;

  const money = parseMoney(readField(text, 'Monto de la compra'));
  const merchant = collapseSpaces(readField(text, 'Comercio'));
  if (!money || !merchant) return null;

  const lastFour = readLastFour(readField(text, 'Tarjeta utilizada') ?? '');
  return [
    {
      type: TransactionType.CARD,
      direction: Direction.EXPENSE,
      currency: money.currency,
      amount: money.amount,
      counterparty: merchant,
      date: parseDate(readField(text, 'Fecha y hora')),
      declined: false,
      status: null,
      note: lastFour ? `Tarjeta ****${lastFour}` : null,
    },
  ];
}
