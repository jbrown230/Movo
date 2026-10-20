// Plantilla REAL de Davivienda: "TRANSFERENCIA REALIZADA" (dinero que le depositan a la persona).
//
// Remitente: bancavirtual@davivienda.cr
//
// Ejemplo (con datos ficticios):
//   Estimado cliente
//   Deseamos notificarle que se realizó la siguiente transacción:
//   Cuenta origen:    CTE - CR00000000000000000000 CRC EMPRESA DE PRUEBA SOCIEDAD ANONIMA
//   Cuenta destino:   AHO - CR00000000000000000001 CRC CLIENTE DE PRUEBA
//   Monto:            250000.00 CRC
//   Fecha y hora:     15/01/2026 12:11:46 PM
//   No. Comprobante:  0000000000000000000000001
//   Detalle:          PAGO DE PRUEBA
//
// El correo no dice cuál de las dos cuentas es de la persona ("Estimado cliente", sin nombre).
// Se lee como INGRESO porque lo que la persona envía desde Davivienda llega como débito en la
// cuenta (plantilla daviviendaAccount.js), no con este formato. Si el titular de origen y el de
// destino son la misma persona, es dinero entre sus propias cuentas.

import { Direction, TransactionType } from '../../types.js';
import { isSamePerson } from '../../names.js';
import { normalizeText, parseDate, parseMoney, readField } from './daviviendaFields.js';

/** "AHO - CR00000000000000000001 CRC CLIENTE DE PRUEBA" → titular y últimos 4 dígitos de la cuenta. */
const ACCOUNT_LINE = /^[A-Z]{2,4}\s*-\s*[A-Z]{2}(\d+)\s+(?:CRC|USD|EUR)\s+(.+)$/i;

function readAccount(text, label) {
  const match = readField(text, label)?.match(ACCOUNT_LINE);
  return match ? { lastFour: match[1].slice(-4), holder: match[2].trim() } : null;
}

function buildNote({ isOwnTransfer, detail, destination }) {
  const parts = [
    isOwnTransfer && 'Entre tus cuentas',
    detail && `Detalle: ${detail}`,
    destination && `Cuenta ****${destination.lastFour}`,
  ];
  return parts.filter(Boolean).join(' · ') || null;
}

/** @returns {Array|null} La transferencia recibida, o null si el texto no es de esta plantilla. */
export function parseDaviviendaTransfer(rawText) {
  const text = normalizeText(rawText);
  const origin = readAccount(text, 'Cuenta origen');
  const destination = readAccount(text, 'Cuenta destino');
  if (!origin || !destination) return null;

  const money = parseMoney(readField(text, 'Monto'));
  if (!money) return null;

  const isOwnTransfer = isSamePerson(origin.holder, destination.holder);
  return [
    {
      type: TransactionType.TRANSFER,
      direction: isOwnTransfer ? Direction.OWN_TRANSFER : Direction.INCOME,
      currency: money.currency,
      amount: money.amount,
      counterparty: origin.holder,
      date: parseDate(readField(text, 'Fecha y hora')),
      declined: false,
      status: null,
      note: buildNote({ isOwnTransfer, detail: readField(text, 'Detalle'), destination }),
    },
  ];
}
