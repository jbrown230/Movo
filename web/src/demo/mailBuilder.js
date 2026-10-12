// Generador de correos bancarios SINTÉTICOS.
//
// Los formatos imitan la estructura típica de una notificación, pero son
// inventados: no contienen datos reales (nombres, teléfonos ni números de
// tarjeta o de referencia). Se usan en el modo demo, en las pruebas y en el benchmark.

import { newId } from '../domain/ids.js';

export const DEMO_SENDERS = {
  BAC: { name: 'BAC Credomatic', address: 'notificaciones@bac.demo' },
  BN: { name: 'Banco Nacional', address: 'bnnotifica@bn.demo' },
  BCR: { name: 'BCR Mensajero', address: 'mensajero@bancobcr.demo' },
  BCR_CARDS: { name: 'BCR Tarjetas', address: 'bcrtarjestcta@bancobcr.demo' },
};

const FAKE_CARD_LAST_FOUR = '0000';
const CLIENT_NAME = 'CLIENTE DE PRUEBA';
const pad = (n) => String(n).padStart(2, '0');

// ---- formato de números y fechas, como los escriben los bancos ----
const withUsFormat = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // 1,234.50
const withCrFormat = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // 1.234,50

// Los bancos escriben en hora de Costa Rica (UTC−6), sin importar la zona del teléfono.
const toCostaRicaClock = (date) => new Date(date.getTime() - 6 * 3600e3);
const dayMonthYear = (date) => {
  const c = toCostaRicaClock(date);
  return `${pad(c.getUTCDate())}/${pad(c.getUTCMonth() + 1)}/${c.getUTCFullYear()}`;
};
const hourMinute = (date) => {
  const c = toCostaRicaClock(date);
  return `${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`;
};
const hourMinuteAmPm = (date) => {
  const c = toCostaRicaClock(date);
  const hour = c.getUTCHours();
  return `${hour % 12 || 12}:${pad(c.getUTCMinutes())} ${hour < 12 ? 'AM' : 'PM'}`;
};

// ---- datos inventados ----
const randomDigits = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
const fakeReference = () => randomDigits(16);
/** Teléfono ficticio: siempre empieza con 8000. */
const fakePhone = () => '8000' + randomDigits(4);
const maskPhone = (phone) => `${String(phone).slice(0, 1)}***-**${String(phone).slice(-2)}`;

// ---- una plantilla por banco ----
function bacMail({ type, direction, counterparty, amount, currency, date, phone, description }) {
  const isInbound = direction === 'in';
  const code = currency === 'USD' ? 'USD' : 'CRC';

  if (type === 'sinpe') {
    const intro = isInbound
      ? 'Le informamos que recibió una transferencia SINPE Móvil en su cuenta.'
      : 'Le informamos que se realizó una transferencia SINPE Móvil desde su cuenta.';
    return {
      subject: isInbound ? 'Notificación de SINPE Móvil recibido' : 'Notificación de transferencia SINPE Móvil',
      body: [
        'Estimado(a) cliente:', '', intro, '',
        `Monto: CRC ${withUsFormat(amount)}`,
        `${isInbound ? 'Remitente' : 'Destinatario'}: ${counterparty}`,
        `Teléfono: ${maskPhone(phone)}`,
        `Descripción: ${description || 'SINPE MOVIL'}`,
        `Fecha: ${dayMonthYear(date)} ${hourMinute(date)}`,
        `Referencia: ${fakeReference()}`, '',
        'Este es un mensaje automático, por favor no responda.',
      ].join('\n'),
    };
  }
  return {
    subject: 'Notificación de transacción',
    body: [
      'Notificación de transacción', '',
      `Comercio: ${counterparty}`,
      'Ciudad y país: SAN JOSE, Costa Rica',
      `Fecha: ${dayMonthYear(date)} ${hourMinute(date)}`,
      `Tarjeta: VISA ****${FAKE_CARD_LAST_FOUR}`,
      `Autorización: ${randomDigits(6)}`,
      'Tipo de transacción: COMPRA',
      `Monto: ${code} ${withUsFormat(amount)}`,
    ].join('\n'),
  };
}

function bnMail({ type, direction, counterparty, amount, currency, date, phone, description }) {
  if (type === 'sinpe') {
    const when = `el ${dayMonthYear(date)} a las ${hourMinute(date)}`;
    const detail = `Detalle: ${description || 'SINPE MOVIL'}\nComprobante: ${fakeReference()}`;
    return direction === 'in'
      ? {
        subject: 'BN SINPE Móvil recibido',
        body: `BN Notificaciones\n\nHa recibido un SINPE Móvil por ₡${withCrFormat(amount)} de ${counterparty} (${maskPhone(phone)}) ${when}.\n${detail}`,
      }
      : {
        subject: 'BN SINPE Móvil enviado',
        body: `BN Notificaciones\n\nSe realizó un SINPE Móvil por ₡${withCrFormat(amount)} a ${counterparty} (${maskPhone(phone)}) ${when}.\n${detail}`,
      };
  }
  const symbol = currency === 'USD' ? '$' : '₡';
  return {
    subject: 'BN Compra aprobada',
    body: `BN Notificaciones\n\nCompra aprobada por ${symbol}${withCrFormat(amount)} en ${counterparty} el ${dayMonthYear(date)} a las ${hourMinute(date)} con su tarjeta terminada en ${FAKE_CARD_LAST_FOUR}.`,
  };
}

/** BCR: misma estructura que las notificaciones REALES, con datos ficticios. */
function bcrMail({ type, direction, counterparty, amount, currency, date, phone, description, status }) {
  if (type === 'sinpe') {
    const isInbound = direction === 'in';
    return {
      subject: 'SINPEMOVIL - Notificación de transacción realizada',
      body: [
        'Transacción SINPE MÓVIL',
        `Estimado (a): ${CLIENT_NAME}`,
        `Le informamos que se le ha ${isInbound ? 'acreditado en' : 'debitado de'} su cuenta BCR la siguiente transacción SINPE Móvil:`,
        `Número de referencia: ${fakeReference()}${fakeReference().slice(0, 9)}`,
        isInbound ? 'Teléfono origen: 0' : `Teléfono Destino: ${phone}`,
        `Nombre cliente ${isInbound ? 'origen' : 'Destino'}: ${counterparty}`,
        isInbound ? 'Entidad origen: Banco Nacional de Costa Rica' : 'Entidad Destino: Banco de Costa Rica',
        `Monto: ${withUsFormat(amount)}`,
        `Motivo: ${description || 'SINPE MOVIL'}`,
        `Esta transacción fue realizada el ${dayMonthYear(date)} a las ${hourMinuteAmPm(date)}`,
        'Importante:',
        'Por favor, no escriba a esta dirección de correo.',
      ].join('\n'),
    };
  }

  const seconds = pad(toCostaRicaClock(date).getUTCSeconds());
  const isDeclined = status === 'Negada';
  const authorization = isDeclined ? '00000000' : randomDigits(8);
  const columns = [
    `${dayMonthYear(date)} ${hourMinute(date)}:${seconds}`,
    authorization,
    fakeReference().slice(0, 12),
    withUsFormat(amount),
    currency === 'USD' ? 'US DOLLAR' : 'COLONES',
    counterparty,
    status || 'Aprobada',
  ];
  return {
    subject: 'Notificación de Transacciones BCR',
    body: [
      `Transacciones en su tarjeta BCR: ****-****-****-${FAKE_CARD_LAST_FOUR}`,
      'Estimado (a) cliente:',
      'Le informamos la siguiente transacción realizada con su tarjeta BCR :',
      'Información Adicional',
      'Detalle de Transacciones',
      ['Fecha', 'Autorización', 'No.Referencia', 'Monto', 'Moneda', 'Comercio', 'Estado'].join('\t'),
      columns.join('\t'),
      'En caso de dudas respecto a las transacciones notificadas, escribir al WhatsApp.',
    ].join('\n'),
  };
}

const MAIL_BY_BANK = { BAC: bacMail, BN: bnMail, BCR: bcrMail };

/**
 * Arma un correo sintético listo para leer con el lector.
 *
 * @param {Object} options
 * @param {'BAC'|'BN'|'BCR'} options.bank
 * @param {'sinpe'|'tarjeta'} options.type
 * @param {'out'|'in'} [options.direction]   Gasto (por defecto) o ingreso.
 * @param {string} options.counterparty      Comercio o persona.
 * @param {number} options.amount            En unidades (no céntimos).
 * @param {'CRC'|'USD'} [options.currency]
 * @param {string} [options.date]            ISO; por defecto, ahora.
 * @param {string} [options.phone]
 * @param {string} [options.description]
 * @param {string} [options.status]          Solo BCR tarjeta: "Aprobada" (por defecto) o "Negada".
 * @returns {import('../domain/types.js').IncomingMail}
 */
export function buildBankMail(options) {
  const date = new Date(options.date || Date.now());
  const phone = options.phone || fakePhone();
  const { subject, body } = MAIL_BY_BANK[options.bank]({ ...options, date, phone });

  const isBcrCard = options.bank === 'BCR' && options.type !== 'sinpe';
  const sender = DEMO_SENDERS[isBcrCard ? 'BCR_CARDS' : options.bank];
  return {
    id: `demo-${newId()}`,
    messageId: `<${newId().slice(0, 12)}@${options.bank.toLowerCase()}.demo>`,
    from: `${sender.name} <${sender.address}>`,
    fromName: sender.name,
    subject,
    body,
    date: date.toISOString(),
  };
}
