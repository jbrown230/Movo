// Cola del respaldo en la nube: qué cambios faltan por subir y cómo aplicar los que llegan.
//
// Los registros que cambian se marcan con `needs_backup=1`. Al sincronizar, se suben y se
// marcan como limpios. Lo que llega del servidor se aplica con "gana el más reciente":
// solo reemplaza lo local si su `updatedAt` es mayor.
//
// Este repositorio habla con entidades de la app (ver BackupChanges en domain/types.js).
// Cómo viajan por la red lo decide infrastructure/backend/backupWireFormat.js.

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

/** ¿Lo que ya hay en el teléfono es igual de reciente o más que lo que llega? */
function isLocalNewerOrEqual(sql, row, incomingUpdatedAt) {
  const current = sql.queryOne(`SELECT updated_at FROM ${row.table} WHERE ${row.keyColumn}=?`, [row.key]);
  return Boolean(current && current.updated_at >= incomingUpdatedAt);
}

// ---- aplicar lo que llega del servidor (cada función devuelve true si cambió algo local) ----

function applyRemoteTransaction(sql, remote) {
  if (isLocalNewerOrEqual(sql, { table: 'transactions', keyColumn: 'id', key: remote.id }, remote.updatedAt))
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
      remote.date,
      remote.amountCents,
      remote.currency,
      remote.crcCents,
      remote.exchangeRate ?? null,
      remote.counterparty,
      remote.category,
      remote.categoryOrigin ?? null,
      remote.type,
      remote.direction,
      remote.bank ?? null,
      remote.mailKey ?? null,
      remote.note ?? null,
      remote.updatedAt,
      remote.isDeleted ? 1 : 0,
    ],
  );
  return true;
}

function applyRemoteCategoryRule(sql, remote) {
  if (isLocalNewerOrEqual(sql, { table: 'category_rules', keyColumn: 'id', key: remote.id }, remote.updatedAt))
    return false;
  sql.execute(
    `INSERT INTO category_rules(id, counterparty_key, category, updated_at, is_deleted, needs_backup)
     VALUES(?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET counterparty_key=excluded.counterparty_key, category=excluded.category,
       updated_at=excluded.updated_at, is_deleted=excluded.is_deleted, needs_backup=0`,
    [remote.id, remote.counterpartyKey || remote.id, remote.category, remote.updatedAt, remote.isDeleted ? 1 : 0],
  );
  return true;
}

function applyRemoteSetting(sql, remote) {
  if (isLocalNewerOrEqual(sql, { table: 'settings', keyColumn: 'name', key: remote.name }, remote.updatedAt))
    return false;
  sql.execute(
    `INSERT INTO settings(name, value, updated_at, needs_backup) VALUES(?,?,?,0)
     ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, needs_backup=0`,
    [remote.name, JSON.stringify(remote.value ?? null), remote.updatedAt],
  );
  return true;
}

// ---- marcar como subido ----

const MARK_SYNCED_SQL = {
  transactions: 'UPDATE transactions SET needs_backup=0 WHERE id=? AND updated_at=?',
  categoryRules: 'UPDATE category_rules SET needs_backup=0 WHERE id=? AND updated_at=?',
  settings: 'UPDATE settings SET needs_backup=0 WHERE name=? AND updated_at=?',
};
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
      };
    },

    /** Marca como subido lo que ya recibió el servidor (solo si no cambió mientras tanto). */
    markSynced(sent) {
      sql.inTransaction(() => {
        for (const [listName, markSql] of Object.entries(MARK_SYNCED_SQL)) {
          for (const item of sent[listName]) sql.execute(markSql, [keyOf(listName, item), item.updatedAt]);
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
      });
      return appliedCount;
    },

    pendingCount() {
      return sql.queryOne(
        `SELECT (SELECT COUNT(*) FROM transactions WHERE needs_backup=1)
              + (SELECT COUNT(*) FROM category_rules WHERE needs_backup=1)
              + (SELECT COUNT(*) FROM settings WHERE needs_backup=1) AS count`,
      ).count;
    },
  };
}
