// Repositorio de movimientos (tabla `tx`).
// Traduce entre las filas de SQLite (nombres cortos) y la entidad Transaction (nombres claros).

import { Direction } from '../../domain/types.js';

const toTransaction = (row) => ({
  id: row.id,
  date: row.date,
  amountCents: row.amount_cents,
  currency: row.cur,
  crcCents: row.crc_cents,
  exchangeRate: row.fx,
  counterparty: row.who,
  category: row.cat,
  categoryOrigin: row.cat_origin,
  type: row.type,
  direction: row.dir,
  bank: row.bank,
  mailKey: row.message_id,
  note: row.note,
  updatedAt: row.updated_at,
  deleted: Boolean(row.deleted),
});

/** Campos de la entidad que se pueden cambiar con `update`, y su columna. */
const UPDATABLE_COLUMNS = {
  direction: 'dir',
  category: 'cat',
  categoryOrigin: 'cat_origin',
  note: 'note',
  crcCents: 'crc_cents',
  exchangeRate: 'fx',
};

export function createTransactionRepository(sql) {
  const sumByDirection = (direction, range) =>
    sql.queryOne(
      'SELECT COALESCE(SUM(crc_cents), 0) AS total FROM tx WHERE deleted=0 AND dir=? AND date>=? AND date<?',
      [direction, range.from, range.to],
    ).total;

  return {
    get(id) {
      const row = sql.queryOne('SELECT * FROM tx WHERE id=?', [id]);
      return row ? toTransaction(row) : null;
    },

    /** ¿Existe ese id, aunque la persona lo haya eliminado? */
    exists(id) {
      return sql.queryOne('SELECT id FROM tx WHERE id=?', [id]) !== null;
    },

    /** Los movimientos no eliminados, del más reciente al más antiguo. */
    list(limit = 400) {
      return sql.query('SELECT * FROM tx WHERE deleted=0 ORDER BY date DESC LIMIT ?', [limit]).map(toTransaction);
    },

    listForMail(mailKey) {
      return sql.query('SELECT * FROM tx WHERE message_id=? AND deleted=0 ORDER BY date', [mailKey]).map(toTransaction);
    },

    listByDirection(direction) {
      return sql.query('SELECT * FROM tx WHERE deleted=0 AND dir=?', [direction]).map(toTransaction);
    },

    /** Movimientos en dólares que se guardaron sin tipo de cambio. */
    listUsdWithoutRate() {
      return sql
        .query("SELECT * FROM tx WHERE cur='USD' AND (fx IS NULL OR fx=0)")
        .map(toTransaction);
    },

    countActive() {
      return sql.queryOne('SELECT COUNT(*) AS n FROM tx WHERE deleted=0').n;
    },

    insert(transaction) {
      sql.execute(
        `INSERT INTO tx(id,date,amount_cents,cur,crc_cents,fx,who,cat,cat_origin,type,dir,bank,message_id,note,updated_at,deleted,dirty)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
        [
          transaction.id, transaction.date, transaction.amountCents, transaction.currency, transaction.crcCents,
          transaction.exchangeRate ?? null, transaction.counterparty, transaction.category, transaction.categoryOrigin,
          transaction.type, transaction.direction, transaction.bank ?? null, transaction.mailKey ?? null,
          transaction.note ?? null, Date.now(),
        ],
      );
    },

    /** Cambia solo los campos indicados y lo marca para el próximo respaldo. */
    update(id, changes) {
      const fields = Object.keys(changes).filter((field) => field in UPDATABLE_COLUMNS);
      const assignments = fields.map((field) => `${UPDATABLE_COLUMNS[field]}=?`);
      const values = fields.map((field) => changes[field]);
      sql.execute(
        `UPDATE tx SET ${[...assignments, 'updated_at=?', 'dirty=1'].join(', ')} WHERE id=?`,
        [...values, Date.now(), id],
      );
    },

    /** Eliminar es "borrado lógico": queda marcado para que el respaldo también lo borre. */
    softDelete(id) {
      sql.execute('UPDATE tx SET deleted=1, updated_at=?, dirty=1 WHERE id=?', [Date.now(), id]);
    },

    /** Gastos por categoría, ingresos y dinero movido entre cuentas propias, dentro de un periodo. */
    summarizeMonth(range) {
      const byCategory = sql
        .query(
          `SELECT cat, SUM(crc_cents) AS total, COUNT(*) AS n FROM tx
           WHERE deleted=0 AND dir=? AND date>=? AND date<? GROUP BY cat ORDER BY total DESC`,
          [Direction.EXPENSE, range.from, range.to],
        )
        .map((row) => ({ category: row.cat, totalCents: row.total, count: row.n }));
      return {
        byCategory,
        incomeCents: sumByDirection(Direction.INCOME, range),
        movedBetweenOwnAccountsCents: sumByDirection(Direction.OWN_TRANSFER, range),
      };
    },
  };
}
