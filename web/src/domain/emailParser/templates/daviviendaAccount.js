// Plantilla REAL de Davivienda: "TRANSACCIÓN DAVIVIENDA" (débito o crédito en la cuenta).
//
// Remitente: bancavirtual@davivienda.cr
//
// Ejemplo (con datos ficticios):
//   Estimado(a) Cliente CLIENTE DE PRUEBA
//   Davivienda le informa que se realizó un débito en su cuenta de ahorros terminada en 0000
//   Fecha y hora:   15/01/2026, a las 10:30:15
//   Monto:          CRC 12500.00
//   Concepto:       Transferencia SINPE
//   Referencia:     [0000001]
//
// Así avisa Davivienda lo que la persona envía (débito) y lo que le entra a la cuenta (crédito, por
// ejemplo los intereses). El correo NO dice a quién se le envió el dinero: solo el concepto.

import { Direction, TransactionType } from '../../types.js';
import { normalizeText, parseDate, parseMoney, readField, readLastFour } from './labeledFields.js';

const ACCOUNT_MOVEMENT = /Davivienda le informa que se realiz[oó] un (d[eé]bito|cr[eé]dito) en su cuenta/i;
/** Conceptos que solo dicen el medio, no la contraparte: con estos, el movimiento queda sin nombre. */
const GENERIC_CONCEPT = /^(?:transferencia\s*)?(?:sinpe(?:\s*m[oó]vil)?|transferencia)$/i;

function buildNote({ concept, accountLastFour }) {
  const parts = [concept && `Concepto: ${concept}`, accountLastFour && `Cuenta ****${accountLastFour}`];
  return parts.filter(Boolean).join(' · ') || null;
}

/** @returns {Array|null} El movimiento en la cuenta, o null si el texto no es de esta plantilla. */
export function parseDaviviendaAccount(rawText) {
  const text = normalizeText(rawText);
  const action = text.match(ACCOUNT_MOVEMENT)?.[1];
  if (!action) return null;

  const money = parseMoney(readField(text, 'Monto'));
  if (!money) return null;

  const concept = readField(text, 'Concepto');
  return [
    {
      type: /SINPE/i.test(concept ?? '') ? TransactionType.SINPE : TransactionType.TRANSFER,
      direction: /cr[eé]dito/i.test(action) ? Direction.INCOME : Direction.EXPENSE,
      currency: money.currency,
      amount: money.amount,
      counterparty: concept && !GENERIC_CONCEPT.test(concept) ? concept : null,
      date: parseDate(readField(text, 'Fecha y hora')),
      declined: false,
      status: null,
      note: buildNote({ concept, accountLastFour: readLastFour(text) }),
    },
  ];
}
