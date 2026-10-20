// Plantilla REAL de BAC Credomatic: notificación de transferencia SINPE (acreditado = ingreso, debitado = gasto).
//
// Ejemplo (con datos ficticios):
//   Notificación de Transferencia SINPE
//   Hola CLIENTE DE PRUEBA :
//   BAC le comunica que la transferencia SINPE en tiempo real con el número de referencia 0000000000000000000000001,
//   se acreditó en la cuenta IBAN CR13010000000000000000 por un monto de 10,000.00 Colones, por concepto de prueba SINPE.
//   Día y hora 15/01/2026 02:31:22 p.m.

import { Direction, TransactionType } from '../../types.js';
import { isSamePerson } from '../../names.js';
import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour, TIME_PATTERN } from '../dateTime.js';
import { collapseSpaces } from '../text.js';

const IS_SINPE = /SINPE/i;
const IS_BAC = /BAC/i;
const ACTION_PATTERN = /se (acredit[oó]|debit[oó])/i;
const DATE_TIME_REGEX = new RegExp(`D[ií]a y hora\\s*(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s*${TIME_PATTERN}`, 'i');
const AMOUNT_REGEX = new RegExp(
  `monto de\\s*(?:(CRC|USD|₡|\\$)\\s*)?${AMOUNT_PATTERN}(?:\\s*(Colones|D[oó]lares|USD|CRC))?`,
  'i',
);

function readDate(text) {
  const match = text.match(DATE_TIME_REGEX);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, meridiem] = match;
  return costaRicaToIso({
    year,
    month,
    day,
    hour: to24Hour(hour, meridiem),
    minute: minute || 0,
    second: second || 0,
  });
}

function readConcept(text) {
  const match = text.match(/por concepto de\s*(.+?)(?:\.?\s*D[ií]a y hora|\.\s*D[ií]a|\.|$)/i);
  return match?.[1]?.trim() || null;
}

function buildNote({ isOwnTransfer, reason, accountLastFour }) {
  const parts = [
    isOwnTransfer && 'Entre tus cuentas',
    reason && 'Motivo: ' + collapseSpaces(reason).replace(/\*+$/, ''),
    accountLastFour && `Cuenta ****${accountLastFour}`,
  ];
  return parts.filter(Boolean).join(' · ') || null;
}

/** @returns {Array|null} La transferencia SINPE de BAC, o null si el texto no es de esta plantilla. */
export function parseBacSinpe(text) {
  if (!IS_SINPE.test(text) || !IS_BAC.test(text) || !ACTION_PATTERN.test(text)) {
    return null;
  }

  const amountMatch = text.match(AMOUNT_REGEX);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[2]);
  if (!amount || Number.isNaN(amount)) return null;

  const actionMatch = text.match(ACTION_PATTERN);
  const isCredit = /acredit/i.test(actionMatch[1]);

  const accountHolder = text.match(/Hola\s+([^:\n]+?)\s*:/i)?.[1]?.trim();
  const counterpartyMatch = text.match(
    /(?:a favor de|de parte de|destinatario|remitente|cliente destino|cliente origen)\s*:\s*([^,.\n]+)/i,
  );
  const counterparty = counterpartyMatch?.[1]?.trim() || null;
  const isOwnTransfer = Boolean(accountHolder && counterparty && isSamePerson(accountHolder, counterparty));

  let direction = isCredit ? Direction.INCOME : Direction.EXPENSE;
  if (isOwnTransfer) direction = Direction.OWN_TRANSFER;

  const accountMatch = text.match(/cuenta IBAN\s*([A-Z0-9]+)/i);
  const accountLastFour = accountMatch?.[1]?.slice(-4) || null;

  return [
    {
      type: TransactionType.SINPE,
      direction,
      currency: detectCurrency(amountMatch[3] || amountMatch[1] || 'Colones'),
      amount,
      counterparty,
      date: readDate(text),
      declined: false,
      status: null,
      note: buildNote({ isOwnTransfer, reason: readConcept(text), accountLastFour }),
    },
  ];
}
