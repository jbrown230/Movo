// Arma todos los casos de uso con sus dependencias.
// La interfaz solo habla con el objeto que devuelve esta función.

import { createExportTransactions } from './exportTransactions.js';
import { createIngestMail } from './ingestMail.js';
import { createReparseMails } from './reparseMails.js';
import { createTransactionActions } from './transactionActions.js';
import { createQueries } from './queries.js';
import { createPreferences } from './preferences.js';
import { createRefreshExchangeRate } from './refreshExchangeRate.js';
import { createBackupSync } from './backupSync.js';
import { createScanInbox } from './scanInbox.js';
import { createSeedDemoData } from './seedDemoData.js';

/**
 * @param {Object} dependencies
 * @param {ReturnType<import('../infrastructure/sqlite/createSqliteStorage.js').createSqliteStorage>} dependencies.storage
 * @param {import('./ports.js').MailSource} dependencies.mailSource
 * @param {import('./ports.js').BackendApi} dependencies.backend
 * @param {(now: Date) => import('../domain/types.js').IncomingMail[]} dependencies.buildDemoMails  Correos de ejemplo del modo demo.
 * @param {import('./ports.js').WorkbookWriter['writeMovementsWorkbook']} dependencies.writeMovementsWorkbook  Dibuja el Excel.
 */
export function createServices({ storage, mailSource, backend, buildDemoMails, writeMovementsWorkbook }) {
  const { transactions, mails, rules, settings, localState, backup, atomically } = storage;

  const preferences = createPreferences({ settings, localState });
  const queries = createQueries({ transactions, mails });
  const ingestMail = createIngestMail({ transactions, mails, rules, atomically });

  /** Lee un correo convirtiendo las compras en dólares y euros con el tipo de cambio de su día. */
  const readMail = (mail) => ingestMail(mail, { exchangeRatesOn: preferences.exchangeRatesOn });

  const { reparseMail, reparseIfParserChanged } = createReparseMails({
    mails,
    transactions,
    rules,
    localState,
    ingestMail,
    atomically,
  });

  return {
    queries,
    preferences,
    ...createTransactionActions({ transactions, mails, rules, atomically }),
    readMail,
    reparseMail,
    reparseIfParserChanged,
    scanInbox: createScanInbox({ mailSource, readMail, mails, preferences }),
    refreshExchangeRate: createRefreshExchangeRate({ backend, localState, transactions, atomically }),
    backup: createBackupSync({ backup, localState, backend }),
    seedDemoData: createSeedDemoData({ readMail, preferences, buildDemoMails }),
    exportTransactions: createExportTransactions({ transactions, writeMovementsWorkbook }),
  };
}
