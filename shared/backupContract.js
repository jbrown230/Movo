// CONTRATO DEL RESPALDO: lo que el teléfono y el servidor acuerdan para sincronizar.
//
// Este archivo lo importan los dos lados (la app en web/ y la API en server/), así que es el
// único lugar donde viven los nombres y los valores permitidos. No depende de nada: solo
// constantes. La descripción completa de la API está en docs/API.md.
//
// Si cambias algo aquí, cambia también docs/API.md y corre `npm test`: las pruebas de
// contrato (tests/contract) comprueban que el teléfono y el servidor sigan entendiéndose.

/**
 * Los tres tipos de registro que se respaldan. La clave es el nombre de la lista dentro de
 * `changes` (en la petición y en la respuesta) y el valor es el tipo que guarda el servidor.
 */
export const RECORD_KIND_BY_LIST = Object.freeze({
  transactions: 'transaction',
  categoryRules: 'category_rule',
  settings: 'setting',
});

export const CHANGE_LIST_NAMES = Object.freeze(Object.keys(RECORD_KIND_BY_LIST));

/** Valores permitidos en un movimiento. Deben coincidir con web/src/domain/types.js (lo verifica una prueba). */
export const ALLOWED_CURRENCIES = Object.freeze(['CRC', 'USD', 'EUR']);
export const ALLOWED_TRANSACTION_TYPES = Object.freeze(['sinpe', 'tarjeta', 'transferencia', 'efectivo']);
export const ALLOWED_DIRECTIONS = Object.freeze(['in', 'out', 'self']);

/** Los únicos ajustes que se sincronizan. Los demás se ignoran. */
export const SYNCED_SETTING_NAMES = Object.freeze(['budget', 'gmail_query']);

/** Máximo de cambios que el teléfono puede enviar en una petición. */
export const MAX_CHANGES_PER_REQUEST = 500;

/** Máximo de registros que el servidor devuelve en una respuesta. Si hay más, `hasMore` es true. */
export const MAX_RECORDS_PER_RESPONSE = 1000;

/** Forma de un id de registro (id del movimiento o de la regla, o nombre del ajuste). */
export const RECORD_ID_PATTERN = '^[A-Za-z0-9_\\- .*:@]{1,120}$';

/** Largo máximo de cada texto de un registro. La API recorta a estos largos y MongoDB los valida. */
export const MAX_TEXT_LENGTH = Object.freeze({
  DEFAULT: 200,
  DATE: 40,
  COUNTERPARTY: 120,
  CATEGORY: 30,
  CATEGORY_ORIGIN: 40,
  BANK: 20,
  MAIL_KEY: 300,
  NOTE: 300,
  SETTING_TEXT: 2000,
});

/**
 * Un registro tal como viaja por la red.
 *
 * @typedef {Object} WireRecord
 * @property {string} id         Id del movimiento, de la regla o nombre del ajuste.
 * @property {number} updatedAt  Milisegundos. Decide quién gana: se queda el más reciente.
 * @property {boolean} isDeleted Borrado lógico: el servidor conserva el registro marcado.
 * @property {object} data       Contenido, según el tipo (ver abajo).
 */

/**
 * `data` de un movimiento (los mismos nombres que la entidad Transaction de la app).
 *
 * @typedef {Object} WireTransactionData
 * @property {string|null} date
 * @property {number} amountCents
 * @property {'CRC'|'USD'|'EUR'} currency
 * @property {number} crcCents
 * @property {number|null} exchangeRate
 * @property {string} counterparty
 * @property {string} category
 * @property {string|null} categoryOrigin
 * @property {'sinpe'|'tarjeta'|'transferencia'|'efectivo'} type
 * @property {'in'|'out'|'self'} direction
 * @property {string|null} bank
 * @property {string|null} mailKey
 * @property {string|null} note
 */

/**
 * `data` de una regla de categoría.
 *
 * @typedef {Object} WireCategoryRuleData
 * @property {string} counterpartyKey
 * @property {string} category
 */

/**
 * `data` de un ajuste.
 *
 * @typedef {Object} WireSettingData
 * @property {string|number|boolean|null} value
 */

/**
 * Cuerpo de POST /api/sync.
 *
 * @typedef {Object} SyncRequest
 * @property {number} since  Cursor que el servidor entregó la última vez (0 la primera vez).
 * @property {{transactions?: WireRecord[], categoryRules?: WireRecord[], settings?: WireRecord[]}} changes
 */

/**
 * Respuesta de POST /api/sync.
 *
 * @typedef {Object} SyncResponse
 * @property {number} cursor   Para la próxima petición.
 * @property {boolean} hasMore Si es true, hay más cambios: se pide otra vez con el nuevo cursor.
 * @property {{transactions: WireRecord[], categoryRules: WireRecord[], settings: WireRecord[]}} changes
 */
