// Plantilla REAL de Wink: avisos de SINPE Móvil, enviado y recibido.
//
// Remitente: transacciones@holawink.com
//
// SINPE enviado ("Notificación de transferencia"), con datos ficticios:
//   Tu transferencia de SINPE móvil fue procesada correctamente. Estos son los detalles de la transacción:
//   Cuenta de origen:          Cuenta de ahorros en colones
//   Número de destino:         80000000
//   Nombre del destinatario:   PERSONA DESTINO PRUEBA
//   Monto transferido:         3,500.00 colones
//   Fecha de la transferencia: 15/01/2026
// El cuerpo solo trae la fecha; la hora está en el asunto: "Notificación de envío 15/01/2026 - 10:30".
//
// SINPE recibido ("Transferencia recibida"):
//   Recibiste una transferencia SINPE a tu cuenta de ahorros Wink. Estos son los detalles de la transacción:
//   Monto recibido:                    15,000.00 colones
//   Cuenta de destino:                 Cuenta de ahorros en colones
//   Número de comprobante:             0000000000000000000000001
//   Fecha y hora de la transferencia:  15/01/2026, 06:22 PM (hora de Costa Rica)
// No dice quién la envió.
//
// La versión en texto plano trae las etiquetas entre asteriscos ("*Monto recibido:* 15,000.00 colones"); se leen igual.

import { Direction, TransactionType } from '../../types.js';
import { costaRicaToIso } from '../dateTime.js';
import { collapseSpaces } from '../text.js';
import { normalizeText, parseDate, parseMoney, readField } from './labeledFields.js';

const IS_SENT = /transferencia de SINPE m[oó]vil fue procesada/i;
const IS_RECEIVED = /Recibiste una transferencia SINPE/i;
const DAY = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const SUBJECT_DAY_AND_TIME = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})/;
const NOON = 12;

/**
 * Cuándo se envió. El asunto trae el día y la hora; si no está (un aviso pegado), se usa el día del cuerpo al
 * mediodía, porque la hora no se sabe.
 */
function sentDate(text, subject) {
  const inSubject = subject?.match(SUBJECT_DAY_AND_TIME);
  if (inSubject) {
    const [, day, month, year, hour, minute] = inSubject;
    return costaRicaToIso({ year, month, day, hour, minute });
  }
  const inBody = readField(text, 'Fecha de la transferencia')?.match(DAY);
  if (!inBody) return null;
  const [, day, month, year] = inBody;
  return costaRicaToIso({ year, month, day, hour: NOON });
}

/** @returns {Array|null} El SINPE del aviso, o null si el texto no es de esta plantilla. */
export function parseWinkSinpe(rawText, mail = {}) {
  const text = normalizeText(rawText).replace(/\*/g, '');
  const isSent = IS_SENT.test(text);
  if (!isSent && !IS_RECEIVED.test(text)) return null;

  const money = parseMoney(readField(text, isSent ? 'Monto transferido' : 'Monto recibido'));
  if (!money) return null;

  return [
    {
      type: TransactionType.SINPE,
      direction: isSent ? Direction.EXPENSE : Direction.INCOME,
      currency: money.currency,
      amount: money.amount,
      counterparty: isSent ? collapseSpaces(readField(text, 'Nombre del destinatario')) : '',
      date: isSent ? sentDate(text, mail.subject) : parseDate(readField(text, 'Fecha y hora de la transferencia')),
      declined: false,
      status: null,
      note: null,
    },
  ];
}
