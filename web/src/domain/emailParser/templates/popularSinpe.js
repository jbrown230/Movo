// Plantilla REAL de Banco Popular: "Comprobante (de) transacción SINPE" (enviado o recibido).
//
// Remitente: BPNotifica@bpdc.fi.cr
//
// El correo trae una tabla (ejemplo con datos ficticios):
//   Transacción SINPE
//   Fecha:                     15/01/2026 08:30:27 PM
//   Estado de la Transacción:  Aplicado
//   Servicio SINPE:            Sinpe Móvil            (o "Pagos Inmediatos")
//   Nombre Origen:             CLIENTE DE PRUEBA
//   Nombre Destino:            PERSONA DESTINO PRUEBA
//   Moneda:                    CRC
//   Monto Enviado:             3,500.00
//   Descripción:               prueba SINPE
//   Tipo de Movimiento:        Débito                 (o "Crédito")
//
// Débito = la persona envió (la otra parte es el destino); crédito = recibió (la otra parte es el origen).
// En los SINPE recibidos el banco recorta los nombres a 20 letras y cambia los espacios por "_".

import { Direction, TransactionType } from '../../types.js';
import { isSamePerson } from '../../names.js';
import { collapseSpaces, isDeclinedStatus } from '../text.js';
import { normalizeText, parseDate, parseMoney, readField } from './labeledFields.js';

const IS_SINPE_RECEIPT = /Transacci[oó]n SINPE/i;

/** "CLIENTE__DE_PRUEBA" → "CLIENTE DE PRUEBA". */
const cleanText = (value) => collapseSpaces(String(value ?? '').replace(/_+/g, ' ')) || null;

function buildNote({ isOwnTransfer, description, service }) {
  const parts = [isOwnTransfer && 'Entre tus cuentas', description && `Motivo: ${description}`, service];
  return parts.filter(Boolean).join(' · ') || null;
}

/** @returns {Array|null} El SINPE del comprobante, o null si el texto no es de esta plantilla. */
export function parsePopularSinpe(rawText) {
  const text = normalizeText(rawText);
  const movementType = readField(text, 'Tipo de movimiento');
  if (!IS_SINPE_RECEIPT.test(text) || !movementType) return null;

  const money = parseMoney(`${readField(text, 'Monto Enviado') ?? ''} ${readField(text, 'Moneda') ?? ''}`);
  if (!money) return null;

  const isCredit = /cr[eé]dito/i.test(movementType);
  const origin = cleanText(readField(text, 'Nombre Origen'));
  const destination = cleanText(readField(text, 'Nombre Destino'));
  const isOwnTransfer = Boolean(origin && destination && isSamePerson(origin, destination));
  const status = readField(text, 'Estado de la Transacci[oó]n');

  let direction = isCredit ? Direction.INCOME : Direction.EXPENSE;
  if (isOwnTransfer) direction = Direction.OWN_TRANSFER;

  return [
    {
      type: TransactionType.SINPE,
      direction,
      currency: money.currency,
      amount: money.amount,
      counterparty: isCredit ? origin : destination,
      date: parseDate(readField(text, 'Fecha')),
      declined: isDeclinedStatus(status),
      status,
      note: buildNote({
        isOwnTransfer,
        description: cleanText(readField(text, 'Descripci[oó]n')),
        service: readField(text, 'Servicio SINPE'),
      }),
    },
  ];
}
