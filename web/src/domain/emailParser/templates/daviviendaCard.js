// Plantilla REAL de Davivienda: "Notificación por transacción de Davivienda" (compra con tarjeta).
//
// Remitente: bancavirtual@davivienda.cr
//
// Ejemplo (con datos ficticios):
//   Davivienda le informa que se realizó una transacción en:
//   Comercio:          RESTAURANTE DE PRUEBA
//   Ciudad y País:     ALAJUELA, CR
//   Fecha y Hora:      17/01/2026, a las 18:15:31
//   Marca de Tarjeta:  Tarjeta VISA terminada en *0000
//   Autorización:      000000
//   Referencia:        0000001
//   Monto:             CRC 8750.00
//
// Todavía no hemos visto una compra rechazada de Davivienda: si llega, el correo no se reconoce y
// queda como "Sin movimiento", en vez de leerse como gasto.

import { Direction, TransactionType } from '../../types.js';
import { normalizeText, parseDate, parseMoney, readField, readLastFour } from './labeledFields.js';

const CARD_PURCHASE = /Davivienda le informa que se realiz[oó] una transacci[oó]n en/i;

/** @returns {Array|null} La compra con tarjeta, o null si el texto no es de esta plantilla. */
export function parseDaviviendaCard(rawText) {
  const text = normalizeText(rawText);
  if (!CARD_PURCHASE.test(text)) return null;

  const merchant = readField(text, 'Comercio');
  const money = parseMoney(readField(text, 'Monto'));
  if (!merchant || !money) return null;

  const cardLastFour = readLastFour(readField(text, 'Marca de Tarjeta') ?? '');
  return [
    {
      type: TransactionType.CARD,
      direction: Direction.EXPENSE,
      currency: money.currency,
      amount: money.amount,
      counterparty: merchant,
      date: parseDate(readField(text, 'Fecha y Hora')),
      declined: false,
      status: null,
      note: cardLastFour ? `Tarjeta ****${cardLastFour}` : null,
    },
  ];
}
