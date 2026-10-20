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
const HOLDER_REGEX = /Hola\s+([^:\n]+?)\s*:/i;
const COUNTERPARTY_REGEX =
  /(?:a favor de|de parte de|destinatario|remitente|cliente destino|cliente origen)\s*:\s*([^,.\n]+)/i;
const ACCOUNT_REGEX = /cuenta IBAN\s*([A-Z0-9]+)/i;
const CONCEPT_REGEX = /por concepto de\s*(.+?)(?:\.?\s*D[ií]a y hora|\.\s*D[ií]a|\.|$)/i;

function looksLikeBacSinpe(text) {
  return IS_SINPE.test(text) && IS_BAC.test(text) && ACTION_PATTERN.test(text);
}

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
  return text.match(CONCEPT_REGEX)?.[1]?.trim() || null;
}

/** @returns {{amount: number, currency: string}|null} */
function readAmount(text) {
  const match = text.match(AMOUNT_REGEX);
  if (!match) return null;

  const amount = parseAmount(match[2]);
  if (!amount || Number.isNaN(amount)) return null;

  return { amount, currency: detectCurrency(match[3] || match[1] || 'Colones') };
}

function readIsCredit(text) {
  const action = text.match(ACTION_PATTERN)?.[1] ?? '';
  return /acredit/i.test(action);
}

function readAccountHolder(text) {
  return text.match(HOLDER_REGEX)?.[1]?.trim() || null;
}

function readCounterparty(text) {
  return text.match(COUNTERPARTY_REGEX)?.[1]?.trim() || null;
}

function readAccountLastFour(text) {
  return text.match(ACCOUNT_REGEX)?.[1]?.slice(-4) || null;
}

function isTransferBetweenOwnAccounts(accountHolder, counterparty) {
  return Boolean(accountHolder && counterparty && isSamePerson(accountHolder, counterparty));
}

function resolveDirection({ isCredit, isOwnTransfer }) {
  if (isOwnTransfer) return Direction.OWN_TRANSFER;
  return isCredit ? Direction.INCOME : Direction.EXPENSE;
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
  if (!looksLikeBacSinpe(text)) return null;

  const money = readAmount(text);
  if (!money) return null;

  const counterparty = readCounterparty(text);
  const isOwnTransfer = isTransferBetweenOwnAccounts(readAccountHolder(text), counterparty);
  const direction = resolveDirection({ isCredit: readIsCredit(text), isOwnTransfer });

  return [
    {
      type: TransactionType.SINPE,
      direction,
      currency: money.currency,
      amount: money.amount,
      counterparty,
      date: readDate(text),
      declined: false,
      status: null,
      note: buildNote({
        isOwnTransfer,
        reason: readConcept(text),
        accountLastFour: readAccountLastFour(text),
      }),
    },
  ];
}