// Plantilla REAL del BCR: notificación de SINPE Móvil (débito = enviado, crédito = recibido).
//
// Ejemplo (con datos ficticios):
//   Estimado (a): APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
//   Le informamos que se le ha debitado de su cuenta BCR la siguiente transacción SINPE Móvil:
//   Número de referencia: 0000000000000000000000001
//   Teléfono Destino: 80000000
//   Nombre cliente Destino: PERSONA DESTINO PRUEBA
//   Monto: .15
//   Motivo: prueba SINPE***
//   Esta transacción fue realizada el 15/01/2026 a las 10:30 AM

import { Direction, TransactionType, Currency } from '../../types.js';
import { isSamePerson } from '../../names.js';
import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { costaRicaToIso, to24Hour, TIME_PATTERN } from '../dateTime.js';
import { collapseSpaces } from '../text.js';

// Cada dato termina en el salto de línea o en la etiqueta siguiente (por si vienen en la misma línea).
const UNTIL_NEXT_LABEL =
  '(?=\\s+(?:N[uú]mero de referencia|Tel[eé]fono|Nombre cliente|Entidad|Monto|Motivo|Esta transacci[oó]n|Le informamos)\\b|\\n|$)';

const IS_SINPE = /SINPE/i;
const HAS_AMOUNT_LABEL = /Monto:/i;
const HAS_COUNTERPARTY_LABEL = /Nombre cliente (?:destino|origen)/i;
const IS_CREDIT = /se le ha acreditado|acreditado en su cuenta/i;
const DATE_AND_TIME = new RegExp(`realizada el\\s*(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s*a las\\s*${TIME_PATTERN}`);

function readField(text, label) {
  return text.match(new RegExp(`${label}:\\s*(.+?)${UNTIL_NEXT_LABEL}`, 'i'))?.[1];
}

function readDate(text) {
  const match = text.match(DATE_AND_TIME);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, meridiem] = match;
  return costaRicaToIso({ year, month, day, hour: to24Hour(hour, meridiem), minute, second: second || 0 });
}

function buildNote({ isOwnTransfer, reason, entity, isCredit }) {
  const parts = [
    isOwnTransfer && 'Entre tus cuentas',
    reason && 'Motivo: ' + collapseSpaces(reason).replace(/\*+$/, ''),
    entity && (isCredit ? 'Desde ' : 'Hacia ') + collapseSpaces(entity),
  ];
  return parts.filter(Boolean).join(' · ') || null;
}

/** @returns {Array|null} Una transacción, o null si el texto no es un SINPE del BCR. */
export function parseBcrSinpe(text) {
  if (!IS_SINPE.test(text) || !HAS_AMOUNT_LABEL.test(text) || !HAS_COUNTERPARTY_LABEL.test(text)) return null;

  const amountMatch = text.match(new RegExp(`Monto:\\s*(?:CRC|₡)?\\s*${AMOUNT_PATTERN}`, 'i'));
  if (!amountMatch) return null;

  const isCredit = IS_CREDIT.test(text);
  const counterparty = readField(text, 'Nombre cliente (?:destino|origen)');
  const accountHolder = readField(text, 'Estimado \\(a\\)');
  const isOwnTransfer = Boolean(accountHolder && counterparty && isSamePerson(accountHolder, counterparty));

  let direction = isCredit ? Direction.INCOME : Direction.EXPENSE;
  if (isOwnTransfer) direction = Direction.OWN_TRANSFER;

  return [
    {
      type: TransactionType.SINPE,
      direction,
      currency: Currency.CRC,
      amount: parseAmount(amountMatch[1]),
      counterparty,
      date: readDate(text),
      note: buildNote({
        isOwnTransfer,
        reason: readField(text, 'Motivo'),
        entity: readField(text, 'Entidad (?:destino|origen)'),
        isCredit,
      }),
    },
  ];
}
