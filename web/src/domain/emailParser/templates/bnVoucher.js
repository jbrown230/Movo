// Plantilla REAL del Banco Nacional: "Voucher Digital" (comprobante de compra con tarjeta).
//
// Al convertir el correo a texto queda así:
//   Por este medio le hacemos llegar el comprobante de Compra realizada en COMERCIO CIUDAD CRI
//   el 20 de Octubre de 2026 a las 2:15 p.m.
//   MASTERCARD  ************0000
//   NRO. AUT:   000000
//   REF:        00000000
//   TOTAL:      CRC 3500,00
// La versión en texto plano del mismo correo llega sin algunos espacios
// ("Comprarealizada", "2026a las"), por eso los espacios de la frase son opcionales.

import { Direction, TransactionType } from '../../types.js';
import { AMOUNT_PATTERN, parseAmount } from '../amount.js';
import { detectCurrency } from '../currency.js';
import { costaRicaToIso, to24Hour } from '../dateTime.js';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const monthNumber = (name) => MONTHS.indexOf(name.toLowerCase().replace('setiembre', 'septiembre')) + 1;

const VOUCHER_SENTENCE =
  /comprobante de\s*.+?\s*realizad[ao] en\s+(.+?)\s+el\s+(\d{1,2}) de ([A-Za-zÁ-ú]+) de (\d{4})\s*a las\s*(\d{1,2}):(\d{2})\s*([AaPp]\.?\s?[Mm]\.?)/;
const TOTAL = new RegExp(`TOTAL:\\s*([A-Z]{3}|₡|\\$|€)\\s*${AMOUNT_PATTERN}`);
const CARD_LAST_FOUR = /\*{4,}(\d{4})/;
// El comercio termina con el código del país de la red de tarjetas ("... SAN JOSE CRI"): no es parte del nombre.
const COUNTRY_CODE_SUFFIX = /\s+[A-Z]{3}$/;

/** @returns {Array|null} La compra del comprobante, o null si el texto no es un voucher del BN. */
export function parseBnVoucher(text) {
  const sentence = text.match(VOUCHER_SENTENCE);
  const total = text.match(TOTAL);
  if (!sentence || !total) return null;

  const [, merchant, day, monthName, year, hour, minute, meridiem] = sentence;
  const month = monthNumber(monthName);
  if (!month) return null;

  const cardLastFour = text.match(CARD_LAST_FOUR)?.[1];
  return [
    {
      type: TransactionType.CARD,
      direction: Direction.EXPENSE,
      currency: detectCurrency(total[1]),
      amount: parseAmount(total[2]),
      counterparty: merchant.trim().replace(COUNTRY_CODE_SUFFIX, ''),
      date: costaRicaToIso({ year, month, day, hour: to24Hour(hour, meridiem), minute }),
      declined: false,
      status: null,
      note: cardLastFour ? `Tarjeta ****${cardLastFour}` : null,
    },
  ];
}
