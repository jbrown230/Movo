// Reglas del respaldo. Código puro: no sabe de Express, MongoDB ni Redis.

/**
 * Un registro guardado en el servidor para una persona.
 *
 * @typedef {Object} BackupRecord
 * @property {'transaction'|'category_rule'|'setting'|'savings_goal'} kind
 * @property {string} id
 * @property {number} updatedAt     Milisegundos; lo fija el teléfono al hacer el cambio.
 * @property {boolean} isDeleted
 * @property {object} data
 */

/**
 * Un registro ya guardado, con el orden en que el servidor lo recibió.
 *
 * @typedef {BackupRecord & {serverSequence: number}} StoredBackupRecord
 */

/**
 * REGLA DE SINCRONIZACIÓN: gana el cambio más reciente.
 * Un cambio solo reemplaza al guardado si su `updatedAt` es MAYOR (si es igual, se ignora).
 *
 * @param {BackupRecord} incoming
 * @param {BackupRecord|undefined} existing
 */
export const shouldReplace = (incoming, existing) => !existing || incoming.updatedAt > existing.updatedAt;

const SEQUENCE_SLOTS_PER_MILLISECOND = 1000;
let sequenceCounter = 0;

/**
 * Número que crece con cada registro guardado. Los teléfonos lo usan como cursor para pedir
 * "solo lo que cambió después de este número". Se arma con la hora y un contador, así dos
 * registros guardados en el mismo milisegundo siguen teniendo orden distinto.
 */
export function nextServerSequence() {
  sequenceCounter = (sequenceCounter + 1) % SEQUENCE_SLOTS_PER_MILLISECOND;
  return Date.now() * SEQUENCE_SLOTS_PER_MILLISECOND + sequenceCounter;
}
