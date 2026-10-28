// Plantilla REAL de Banco Popular: "Transacción Tarjeta Crédito VISA BP" (compra con tarjeta).
//
// Remitente: tarjetaBPnotifica@bancopopularinforma.fi.cr
//
// Todo viene en una sola frase (ejemplo con datos ficticios):
//   El Banco Popular le informa de la transacción realizada en RESTAURANTE DE PRUEBA GRANADA NI el 16/01/2026
//   a las 11:56, con la tarjeta VISA ORO PREF. SIN P 0000, Auth # 000000, Ref # 000000000002, por 25.50Dolares US
//
// El comercio trae al final la ciudad y el país, en columnas de ancho fijo (como en el voucher del BN). El monto
// va pegado a la moneda: "12,500.00Colones", "25.50Dolares US".
//
// Todavía no hemos visto una compra rechazada de Banco Popular: si llega con otra redacción, el correo no se
// reconoce y queda como "Sin movimiento", en vez de leerse como gasto.

import { Direction, TransactionType } from '../../types.js';
import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { collapseSpaces } from '../text.js';
import { normalizeText, parseDate } from './labeledFields.js';

const PURCHASE =
  /transacci[oó]n realizada en\s+(.+?)\s+el\s+(\d{1,2}\/\d{1,2}\/\d{4}\s+a las\s+\d{1,2}:\d{2}(?::\d{2})?)/i;
const CARD = /con la tarjeta\s+[^,]*?(\d{4})\s*,/i;
const MONEY = new RegExp(`,\\s*por\\s+${AMOUNT_PATTERN}\\s*(Colones|D[oó]lares(?:\\s*US)?|Euros?|C[oó]rdobas?)`, 'i');

/** @returns {Array|null} La compra con tarjeta, o null si el texto no es de esta plantilla. */
export function parsePopularCard(rawText) {
  const text = normalizeText(rawText);
  const purchase = text.match(PURCHASE);
  const money = text.match(MONEY);
  if (!purchase || !money) return null;

  const amount = parseAmount(money[1]);
  if (!amount || Number.isNaN(amount)) return null;

  const cardLastFour = text.match(CARD)?.[1];
  return [
    {
      type: TransactionType.CARD,
      direction: Direction.EXPENSE,
      currency: detectCurrency(money[2]),
      amount,
      counterparty: collapseSpaces(purchase[1]),
      date: parseDate(purchase[2]),
      declined: false,
      status: null,
      note: cardLastFour ? `Tarjeta ****${cardLastFour}` : null,
    },
  ];
}
