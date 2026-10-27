// Pruebas del esquema de SQLite: una instalación nueva queda con tablas y columnas de nombres claros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, newDatabase, reopenDatabase } from '../helpers/createTestApp.js';
import { migrate } from '../../web/src/infrastructure/sqlite/migrations.js';

const tableNames = (db) => db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.flat();
const columnNames = (db, table) => db.exec(`PRAGMA table_info(${table})`)[0].values.map((row) => row[1]);
const indexNames = (db) =>
  db
    .exec("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]
    .values.flat();

test('una base nueva queda con tablas y columnas de nombres completos', () => {
  const { db } = createTestApp();

  assert.deepEqual(tableNames(db), [
    'category_rules',
    'local_state',
    'mails',
    'savings_goals',
    'settings',
    'transactions',
  ]);
  assert.deepEqual(columnNames(db, 'transactions'), [
    'id',
    'occurred_at',
    'amount_cents',
    'currency',
    'amount_crc_cents',
    'exchange_rate',
    'counterparty',
    'category',
    'category_origin',
    'type',
    'direction',
    'bank',
    'mail_key',
    'note',
    'updated_at',
    'is_deleted',
    'needs_backup',
  ]);
  assert.deepEqual(columnNames(db, 'mails'), [
    'id',
    'message_id',
    'bank',
    'from_address',
    'from_name',
    'subject',
    'body',
    'received_at',
    'status',
    'template',
    'transaction_id',
    'note',
  ]);
  assert.deepEqual(columnNames(db, 'category_rules'), [
    'id',
    'counterparty_key',
    'category',
    'updated_at',
    'is_deleted',
    'needs_backup',
  ]);
  assert.deepEqual(columnNames(db, 'settings'), ['name', 'value', 'updated_at', 'needs_backup']);
  assert.deepEqual(columnNames(db, 'local_state'), ['name', 'value']);
  assert.deepEqual(columnNames(db, 'savings_goals'), [
    'id',
    'name',
    'target_cents',
    'target_date',
    'start_date',
    'updated_at',
    'is_deleted',
    'needs_backup',
  ]);
  assert.deepEqual(indexNames(db), ['mails_by_message_id', 'transactions_by_date', 'transactions_by_mail_key']);
});

test('migrar dos veces no hace nada la segunda vez', () => {
  const db = newDatabase();
  migrate(db);
  migrate(db);
  assert.equal(db.exec('PRAGMA user_version')[0].values[0][0], 2);
});

test('una base guardada se vuelve a abrir con sus datos y sin repetir la migración', () => {
  const first = createTestApp();
  first.services.preferences.setBudgetCents(40_000_000);

  const second = createTestApp({ database: reopenDatabase(first.db) });
  assert.equal(second.services.preferences.budgetCents(), 40_000_000);
  assert.equal(second.db.exec('PRAGMA user_version')[0].values[0][0], 2);
});

test('una base de la versión 1 se actualiza sin perder sus datos', () => {
  // Una base como la dejaba la versión anterior de la app: solo con la migración 1.
  const first = createTestApp();
  first.services.preferences.setBudgetCents(40_000_000);
  first.db.exec('DROP TABLE savings_goals; PRAGMA user_version = 1;');

  const upgraded = createTestApp({ database: reopenDatabase(first.db) });
  assert.equal(upgraded.db.exec('PRAGMA user_version')[0].values[0][0], 2);
  assert.equal(upgraded.services.preferences.budgetCents(), 40_000_000);
  assert.deepEqual(upgraded.services.savingsGoals.list(), []);
});
