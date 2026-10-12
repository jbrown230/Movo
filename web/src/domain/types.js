// Vocabulario del dominio de Movo: los valores permitidos y la forma de cada entidad.
//
// Los valores en texto ("out", "registrado", "tarjeta"...) son los mismos que ya
// están guardados en las bases de los teléfonos y en el respaldo del servidor.
// No los cambies: se rompería la compatibilidad con los datos existentes.

/** Cómo cuenta un movimiento en el resumen del mes. */
export const Direction = Object.freeze({
  EXPENSE: 'out',
  INCOME: 'in',
  OWN_TRANSFER: 'self', // dinero que la persona movió entre sus propias cuentas
});

export const TransactionType = Object.freeze({
  SINPE: 'sinpe',
  CARD: 'tarjeta',
  TRANSFER: 'transferencia',
  CASH: 'efectivo',
});

export const Currency = Object.freeze({
  CRC: 'CRC',
  USD: 'USD',
});

/** Qué pasó con un correo después de leerlo. */
export const MailStatus = Object.freeze({
  REGISTERED: 'registrado',
  NO_MOVEMENT: 'sin_movimiento',
  DECLINED: 'negada',
  DISCARDED: 'descartado',
});

/** Quién decidió la categoría de un movimiento. */
export const CategoryOrigin = Object.freeze({
  AUTOMATIC: 'regla automática',
  USER_RULE: 'tu regla',
  USER_CHOICE: 'elegida por ti',
  SAME_HOLDER: 'mismo titular',
});

/**
 * Un movimiento de dinero. Los montos siempre son enteros en céntimos:
 * nunca se usan decimales flotantes para dinero.
 *
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} date             Fecha y hora en formato ISO (UTC).
 * @property {number} amountCents      Monto original, en céntimos de su moneda.
 * @property {'CRC'|'USD'} currency
 * @property {number} crcCents         Monto convertido a colones, en céntimos.
 * @property {number|null} exchangeRate Tipo de cambio usado (solo si fue en dólares).
 * @property {string} counterparty     Comercio o persona con quien fue el movimiento.
 * @property {string} category         Clave de la categoría (ver domain/categories.js).
 * @property {string|null} categoryOrigin
 * @property {string} type             Valor de TransactionType.
 * @property {string} direction        Valor de Direction.
 * @property {string|null} bank
 * @property {string|null} mailKey     Message-ID del correo del que salió, si hubo uno.
 * @property {string|null} note
 * @property {number} updatedAt        Milisegundos; sirve para sincronizar.
 * @property {boolean} deleted
 */

/**
 * Un correo del banco ya leído y guardado en el teléfono.
 *
 * @typedef {Object} Mail
 * @property {string} id               Id de Gmail o id local.
 * @property {string|null} messageId   Cabecera Message-ID (identifica el correo en cualquier teléfono).
 * @property {string|null} bank
 * @property {string|null} fromAddress
 * @property {string|null} fromName
 * @property {string} subject
 * @property {string} body
 * @property {string} receivedAt       Fecha ISO.
 * @property {string} status           Valor de MailStatus.
 * @property {string|null} template    Nombre de la plantilla que lo leyó.
 * @property {string|null} transactionId
 * @property {string|null} note
 */

/**
 * Un correo recién descargado, todavía sin guardar.
 *
 * @typedef {Object} IncomingMail
 * @property {string} id
 * @property {string|null} [messageId]
 * @property {string} [from]
 * @property {string} [fromName]
 * @property {string} [subject]
 * @property {string} body
 * @property {string} [date]
 */
