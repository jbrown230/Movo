// Caso de uso: borrar todo lo que el servidor guarda de una persona.

/** @param {{ backupStore: import('./ports.js').BackupStore }} dependencies */
export function createDeleteUserBackup({ backupStore }) {
  /** @returns {Promise<number>} Cuántos registros se eliminaron. */
  return (userId) => backupStore.deleteAll(userId);
}
