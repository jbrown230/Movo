// Plantilla REAL de Wink: "Pago de tarjeta de crédito exitoso" (se pagó una tarjeta de crédito desde la cuenta Wink).
//
// Remitente: transacciones@holawink.com
//
// Con datos ficticios:
//   ¡Pago de tarjeta de crédito exitoso!
//   Hola Winker, te informamos que se ha efectuado exitosamente el pago de la tarjeta de crédito:
//   Tarjeta de crédito:  XXXX XXXX XXXX 0000
//   Titular:             CLIENTE DE PRUEBA
//   Tipo de pago:        Otro monto
//   Monto:               ₡5,000.00
//
// El aviso no trae fecha: se usa la del correo, que llega al momento del pago.
//
// Se lee como "entre mis cuentas" y no como un gasto: pagar la tarjeta no es comprar algo nuevo, las compras ya
// se registraron con los avisos de cada compra. Contarlo como gasto las contaría dos veces.

import { Direction, TransactionType } from '../../types.js';
import { collapseSpaces } from '../text.js';
import { normalizeText, parseMoney, readField } from './labeledFields.js';

const IS_CARD_PAYMENT = /Pago de tarjeta de cr[eé]dito exitoso/i;
const CARD_LAST_FOUR = /[X*]{4}\s*[X*]{4}\s*[X*]{4}\s*(\d{4})/i;
const COUNTERPARTY = 'PAGO DE TARJETA DE CRÉDITO';

/** @returns {Array|null} El pago del aviso, o null si el texto no es de esta plantilla. */
export function parseWinkCardPayment(rawText) {
  const text = normalizeText(rawText).replace(/\*/g, '');
  if (!IS_CARD_PAYMENT.test(text)) return null;

  const money = parseMoney(readField(text, 'Monto'));
  if (!money) return null;

  const lastFour = readField(text, 'Tarjeta de cr[eé]dito')?.match(CARD_LAST_FOUR)?.[1];
  const paymentType = collapseSpaces(readField(text, 'Tipo de pago'));
  const note = [lastFour && `Tarjeta ****${lastFour}`, paymentType && `Pago: ${paymentType}`]
    .filter(Boolean)
    .join(' · ');
  return [
    {
      type: TransactionType.TRANSFER,
      direction: Direction.OWN_TRANSFER,
      currency: money.currency,
      amount: money.amount,
      counterparty: COUNTERPARTY,
      date: null,
      declined: false,
      status: null,
      note: note || null,
    },
  ];
}
