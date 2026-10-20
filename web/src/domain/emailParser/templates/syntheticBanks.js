// Plantilla SINTÉTICA del Banco Nacional (solo para su SINPE Móvil en la demo).
//
// El BN no notifica los SINPE por correo, así que no existe un formato real que copiar.
// Para BCR y BAC ya existen plantillas reales (tarjeta y SINPE).
// Del Banco Nacional ya hay plantilla real para la compra con tarjeta (bnVoucher.js).

import { costaRicaToIso } from '../dateTime.js';
import { parseAmount } from '../amount.js';

/** BAC: "Monto: CRC 4,500.00 / Comercio: ... / Fecha: 15/01/2026 10:30". */
export function parseBacSynthetic(text) {
  const amountMatch = text.match(/Monto:\s*(CRC|USD)\s*([\d.,]+)/i);
  if (!amountMatch) return null;

  const counterparty = text.match(/(?:Comercio|Destinatario|Remitente):\s*(.+)/i)?.[1];
  const dateMatch = text.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  const [, day, month, year, hour, minute] = dateMatch ?? [];

  return [
    {
      currency: amountMatch[1].toUpperCase(),
      amount: parseAmount(amountMatch[2]),
      counterparty,
      date: dateMatch ? costaRicaToIso({ year, month, day, hour, minute }) : null,
    },
  ];
}

/** BN: "... por ₡3 450,00 a SODA ... (8***-**22) el 15/01/2026 a las 10:30". */
export function parseBnSynthetic(text) {
  const amountMatch = text.match(/por\s*(₡|\$)\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const counterparty = text.match(/\s(?:a|en|de)\s+([A-ZÁÉÍÓÚÑÜ0-9 .&*'-]{3,}?)\s+(?:\(|el\s+\d)/)?.[1];
  const dateMatch = text.match(/el\s+(\d{2})\/(\d{2})\/(\d{4})\s+a las\s+(\d{2}):(\d{2})/);
  const [, day, month, year, hour, minute] = dateMatch ?? [];

  return [
    {
      currency: amountMatch[1] === '$' ? 'USD' : 'CRC',
      amount: parseAmount(amountMatch[2]),
      counterparty,
      date: dateMatch ? costaRicaToIso({ year, month, day, hour, minute }) : null,
    },
  ];
}
