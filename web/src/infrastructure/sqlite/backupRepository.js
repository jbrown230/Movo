// Cola del respaldo en la nube: qué cambios faltan por subir y cómo aplicar los que llegan.
//
// Los registros que cambian se marcan con `needs_backup=1`. Al sincronizar, se suben y se
// marcan como limpios. Lo que llega del servidor se aplica con "gana el más reciente":
// solo reemplaza lo local si su `updatedAt` es mayor, o si es igual y el contenido es distinto
// (en un empate gana lo que guardó el servidor). Ver docs/ARQUITECTURA.md, "Sincronización".
//
// Este repositorio habla con entidades de la app (ver BackupChanges en domain/types.js).
// Cómo viajan por la red lo decide infrastructure/backend/backupWireFormat.js.

import { toSavingsGoal } from './savingsGoalRepository.js';
import { toTransaction } from './transactionRepository.js';

const PUSH_LIMIT = 500;

const toCategoryRule = (row) => ({
  id: row.id,
  counterpartyKey: row.counterparty_key,
  category: row.category,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
});

const toSetting = (row) => ({
  name: row.name,
  value: JSON.parse(row.value),
  updatedAt: row.updated_at,
});

/**
 * ¿Se queda lo que ya hay en el teléfono en lugar de lo que llega del servidor?
 * - Si lo local es más reciente, sí: es un cambio que todavía no se subió y ganará en el servidor.
 * - Si es más viejo, no.
 * - Si tienen la misma hora (empate), gana lo que guardó el servidor, que es lo que le llegó primero: así
 *   todos los teléfonos terminan iguales. Solo se ignora si ya es idéntico a lo local, como pasa con lo
 *   que el propio teléfono acaba de subir.
 *
 * @param {{ table: string, keyColumn: string, key: string }} row
 * @param {Object<string, unknown>} incomingColumns  Lo que llega, con los nombres de las columnas locales.
 */
function keepsLocal(sql, row, incomingUpdatedAt, incomingColumns) {
  const current = sql.queryOne(`SELECT * FROM ${row.table} WHERE ${row.keyColumn}=?`, [row.key]);
  if (!current) return false;
  if (current.updated_at !== incomingUpdatedAt) return current.updated_at > incomingUpdatedAt;
  return Object.entries(incomingColumns).every(([column, value]) => current[column] === value);
}

/** Lo que trae un movimiento del servidor, con los nombres de las columnas de `transactions`. */
const transactionColumns = (remote) => ({
  occurred_at: remote.date,
  amount_cents: remote.amountCents,
  currency: remote.currency,
  amount_crc_cents: remote.crcCents,
  exchange_rate: remote.exchangeRate ?? null,
  counterparty: remote.counterparty,
  category: remote.category,
  category_origin: remote.categoryOrigin ?? null,
  type: remote.type,
  direction: remote.direction,
  bank: remote.bank ?? null,
  mail_key: remote.mailKey ?? null,
  note: remote.note ?? null,
  is_deleted: remote.isDeleted ? 1 : 0,
});

// ---- aplicar lo que llega del servidor (cada función devuelve true si cambió algo local) ----

function applyRemoteTransaction(sql, remote) {
  const columns = transactionColumns(remote);
  if (keepsLocal(sql, { table: 'transactions', keyColumn: 'id', key: remote.id }, remote.updatedAt, columns))
    return false;
  sql.execute(
    `INSERT INTO transactions(
       id, occurred_at, amount_cents, currency, amount_crc_cents, exchange_rate, counterparty, category,
       category_origin, type, direction, bank, mail_key, note, updated_at, is_deleted, needs_backup)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET
       occurred_at=excluded.occurred_at, amount_cents=excluded.amount_cents, currency=excluded.currency,
       amount_crc_cents=excluded.amount_crc_cents, exchange_rate=excluded.exchange_rate,
       counterparty=excluded.counterparty, category=excluded.category, category_origin=excluded.category_origin,
       type=excluded.type, direction=excluded.direction, bank=excluded.bank, mail_key=excluded.mail_key,
       note=excluded.note, updated_at=excluded.updated_at, is_deleted=excluded.is_deleted, needs_backup=0`,
    [
      remote.id,
      columns.occurred_at,
      columns.amount_cents,
      columns.currency,
      columns.amount_crc_cents,
      columns.exchange_rate,
      columns.counterparty,
      columns.category,
      columns.category_origin,
      columns.type,
      columns.direction,
      columns.bank,
      columns.mail_key,
      columns.note,
      remote.updatedAt,
      columns.is_deleted,
    ],
  );
  return true;
}

function applyRemoteCategoryRule(sql, remote) {
  const columns = {
    counterparty_key: remote.counterpartyKey || remote.id,
    category: remote.category,
    is_deleted: remote.isDeleted ? 1 : 0,
  };
  if (keepsLocal(sql, { table: 'category_rules', keyColumn: 'id', key: remote.id }, remote.updatedAt, columns))
    return false;
  sql.execute(
    `INSERT INTO category_rules(id, counterparty_key, category, updated_at, is_deleted, needs_backup)
     VALUES(?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET counterparty_key=excluded.counterparty_key, category=excluded.category,
       updated_at=excluded.updated_at, is_deleted=excluded.is_deleted, needs_backup=0`,
    [remote.id, columns.counterparty_key, columns.category, remote.updatedAt, columns.is_deleted],
  );
  return true;
}

function applyRemoteSetting(sql, remote) {
  const columns = { value: JSON.stringify(remote.value ?? null) };
  if (keepsLocal(sql, { table: 'settings', keyColumn: 'name', key: remote.name }, remote.updatedAt, columns))
    return false;
  sql.execute(
    `INSERT INTO settings(name, value, updated_at, needs_backup) VALUES(?,?,?,0)
     ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, needs_backup=0`,
    [remote.name, columns.value, remote.updatedAt],
  );
  return true;
}

function applyRemoteSavingsGoal(sql, remote) {
  const columns = {
    name: remote.name,
    target_cents: remote.targetCents,
    target_date: remote.targetDay,
    start_date: remote.startDay,
    is_deleted: remote.isDeleted ? 1 : 0,
  };
  if (keepsLocal(sql, { table: 'savings_goals', keyColumn: 'id', key: remote.id }, remote.updatedAt, columns))
    return false;
  sql.execute(
    `INSERT INTO savings_goals(id, name, target_cents, target_date, start_date, updated_at, is_deleted, needs_backup)
     VALUES(?,?,?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, target_cents=excluded.target_cents,
       target_date=excluded.target_date, start_date=excluded.start_date, updated_at=excluded.updated_at,
       is_deleted=excluded.is_deleted, needs_backup=0`,
    [
      remote.id,
      columns.name,
      columns.target_cents,
      columns.target_date,
      columns.start_date,
      remote.updatedAt,
      columns.is_deleted,
    ],
  );
  return true;
}

// ---- marcar como subido ----

const MARK_SYNCED_SQL = {
  transactions: 'UPDATE transactions SET needs_backup=0 WHERE id=? AND updated_at=?',
  categoryRules: 'UPDATE category_rules SET needs_backup=0 WHERE id=? AND updated_at=?',
  settings: 'UPDATE settings SET needs_backup=0 WHERE name=? AND updated_at=?',
  savingsGoals: 'UPDATE savings_goals SET needs_backup=0 WHERE id=? AND updated_at=?',
};

/** Tablas que se respaldan. */
const BACKED_UP_TABLES = ['transactions', 'category_rules', 'settings', 'savings_goals'];
const keyOf = (listName, item) => (listName === 'settings' ? item.name : item.id);

export function createBackupRepository(sql) {
  const selectPending = (table, toEntity, limit) =>
    sql.query(`SELECT * FROM ${table} WHERE needs_backup=1 LIMIT ?`, [limit]).map(toEntity);

  return {
    /** Cambios locales que faltan por subir. */
    collectPending(limit = PUSH_LIMIT) {
      return {
        transactions: selectPending('transactions', toTransaction, limit),
        categoryRules: selectPending('category_rules', toCategoryRule, limit),
        settings: selectPending('settings', toSetting, limit),
        savingsGoals: selectPending('savings_goals', toSavingsGoal, limit),
      };
    },

    /** Marca como subido lo que ya recibió el servidor (solo si no cambió mientras tanto). */
    markSynced(sent) {
      sql.inTransaction(() => {
        for (const [listName, markSql] of Object.entries(MARK_SYNCED_SQL)) {
          for (const item of sent[listName] ?? []) sql.execute(markSql, [keyOf(listName, item), item.updatedAt]);
        }
      });
    },

    /** Aplica los cambios que llegan del servidor. Devuelve cuántos modificaron algo local. */
    applyRemote(changes) {
      let appliedCount = 0;
      const applyAll = (items, applyOne) => {
        for (const remote of items) if (applyOne(sql, remote)) appliedCount++;
      };
      sql.inTransaction(() => {
        applyAll(changes.transactions, applyRemoteTransaction);
        applyAll(changes.categoryRules, applyRemoteCategoryRule);
        applyAll(changes.settings, applyRemoteSetting);
        applyAll(changes.savingsGoals ?? [], applyRemoteSavingsGoal);
      });
      return appliedCount;
    },

    /** Vuelve a marcar todo lo local para subirlo (tras borrar el respaldo). No cambia `updated_at`. */
    markAllForBackup() {
      sql.inTransaction(() => {
        for (const table of BACKED_UP_TABLES) sql.execute(`UPDATE ${table} SET needs_backup=1 WHERE needs_backup=0`);
      });
    },

    pendingCount() {
      const counts = BACKED_UP_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table} WHERE needs_backup=1)`);
      return sql.queryOne(`SELECT ${counts.join(' + ')} AS count`).count;
    },
  };
}
