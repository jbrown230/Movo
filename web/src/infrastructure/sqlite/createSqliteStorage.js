// Arma todos los repositorios sobre una base de sql.js ya abierta.
// Es lo único que la capa de aplicación necesita de la base de datos.

import { createSqlExecutor } from './sqlExecutor.js';
import { migrate } from './migrations.js';
import { createTransactionRepository } from './transactionRepository.js';
import { createMailRepository } from './mailRepository.js';
import { createRuleRepository } from './ruleRepository.js';
import { createSettingsStore, createLocalStateStore } from './keyValueStores.js';
import { createBackupRepository } from './backupRepository.js';

/**
 * @param {import('sql.js').Database} db
 * @param {{ onChange?: () => void }} [options]
 */
export function createSqliteStorage(db, { onChange } = {}) {
  migrate(db);
  const sql = createSqlExecutor(db, { onChange });

  return {
    transactions: createTransactionRepository(sql),
    mails: createMailRepository(sql),
    rules: createRuleRepository(sql),
    settings: createSettingsStore(sql),
    localState: createLocalStateStore(sql),
    backup: createBackupRepository(sql),
    /** Ejecuta varias escrituras como una sola: o se aplican todas o ninguna. */
    atomically: sql.inTransaction,
  };
}
