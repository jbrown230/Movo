// Repositorio de movimientos (tabla `transactions`).
// Traduce entre las filas de SQLite y la entidad Transaction (ver domain/types.js).

import { Currency, Direction } from '../../domain/types.js';

export const toTransaction = (row) => ({
  id: row.id,
  date: row.occurred_at,
  amountCents: row.amount_cents,
  currency: row.currency,
  crcCents: row.amount_crc_cents,
  exchangeRate: row.exchange_rate,
  counterparty: row.counterparty,
  category: row.category,
  categoryOrigin: row.category_origin,
  type: row.type,
  direction: row.direction,
  bank: row.bank,
  mailKey: row.mail_key,
  note: row.note,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
});

/** Campos de la entidad que se pueden cambiar con `update`, y su columna. */
const UPDATABLE_COLUMNS = {
  direction: 'direction',
  category: 'category',
  categoryOrigin: 'category_origin',
  note: 'note',
  crcCents: 'amount_crc_cents',
  exchangeRate: 'exchange_rate',
};

function insertTransaction(sql, transaction) {
  sql.execute(
    `INSERT INTO transactions(
       id, occurred_at, amount_cents, currency, amount_crc_cents, exchange_rate, counterparty, category,
       category_origin, type, direction, bank, mail_key, note, updated_at, is_deleted, needs_backup)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
    [
      transaction.id,
      transaction.date,
      transaction.amountCents,
      transaction.currency,
      transaction.crcCents,
      transaction.exchangeRate ?? null,
      transaction.counterparty,
      transaction.category,
      transaction.categoryOrigin,
      transaction.type,
      transaction.direction,
      transaction.bank ?? null,
      transaction.mailKey ?? null,
      transaction.note ?? null,
      Date.now(),
    ],
  );
}

/** Cambia solo los campos indicados y lo marca para el próximo respaldo. */
function updateTransaction(sql, id, changes) {
  const fields = Object.keys(changes).filter((field) => field in UPDATABLE_COLUMNS);
  const assignments = fields.map((field) => `${UPDATABLE_COLUMNS[field]}=?`);
  const values = fields.map((field) => changes[field]);
  sql.execute(`UPDATE transactions SET ${[...assignments, 'updated_at=?', 'needs_backup=1'].join(', ')} WHERE id=?`, [
    ...values,
    Date.now(),
    id,
  ]);
}

/** Total en colones de los movimientos activos con una dirección, dentro de un periodo. */
function sumByDirection(sql, direction, range) {
  return sql.queryOne(
    `SELECT COALESCE(SUM(amount_crc_cents), 0) AS total FROM transactions
     WHERE is_deleted=0 AND direction=? AND occurred_at>=? AND occurred_at<?`,
    [direction, range.from, range.to],
  ).total;
}

/** Gastos por categoría, ingresos y dinero movido entre cuentas propias, dentro de un periodo. */
function summarizeMonth(sql, range) {
  const byCategory = sql
    .query(
      `SELECT category, SUM(amount_crc_cents) AS total, COUNT(*) AS count FROM transactions
       WHERE is_deleted=0 AND direction=? AND occurred_at>=? AND occurred_at<?
       GROUP BY category ORDER BY total DESC`,
      [Direction.EXPENSE, range.from, range.to],
    )
    .map((row) => ({ category: row.category, totalCents: row.total, count: row.count }));
  return {
    byCategory,
    incomeCents: sumByDirection(sql, Direction.INCOME, range),
    movedBetweenOwnAccountsCents: sumByDirection(sql, Direction.OWN_TRANSFER, range),
  };
}

export function createTransactionRepository(sql) {
  const selectMany = (query, params = []) => sql.query(query, params).map(toTransaction);

  return {
    get(id) {
      const row = sql.queryOne('SELECT * FROM transactions WHERE id=?', [id]);
      return row ? toTransaction(row) : null;
    },

    /** ¿Existe ese id, aunque la persona lo haya eliminado? */
    exists(id) {
      return sql.queryOne('SELECT id FROM transactions WHERE id=?', [id]) !== null;
    },

    /** Los movimientos no eliminados, del más reciente al más antiguo. */
    list(limit = 400) {
      return selectMany('SELECT * FROM transactions WHERE is_deleted=0 ORDER BY occurred_at DESC LIMIT ?', [limit]);
    },

    listForMail(mailKey) {
      return selectMany('SELECT * FROM transactions WHERE mail_key=? AND is_deleted=0 ORDER BY occurred_at', [mailKey]);
    },

    listByDirection(direction) {
      return selectMany('SELECT * FROM transactions WHERE is_deleted=0 AND direction=?', [direction]);
    },

    /** Movimientos en dólares que se guardaron sin tipo de cambio. */
    listUsdWithoutRate() {
      return selectMany('SELECT * FROM transactions WHERE currency=? AND (exchange_rate IS NULL OR exchange_rate=0)', [
        Currency.USD,
      ]);
    },

    countActive() {
      return sql.queryOne('SELECT COUNT(*) AS count FROM transactions WHERE is_deleted=0').count;
    },

    insert: (transaction) => insertTransaction(sql, transaction),
    update: (id, changes) => updateTransaction(sql, id, changes),

    /** Eliminar es "borrado lógico": queda marcado para que el respaldo también lo borre. */
    softDelete(id) {
      sql.execute('UPDATE transactions SET is_deleted=1, updated_at=?, needs_backup=1 WHERE id=?', [Date.now(), id]);
    },

    summarizeMonth: (range) => summarizeMonth(sql, range),
  };
}
