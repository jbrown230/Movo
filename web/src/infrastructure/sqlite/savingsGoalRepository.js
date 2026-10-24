// Repositorio de metas de ahorro (tabla `savings_goals`).

/** @returns {import('../../domain/savingsGoals.js').SavingsGoal} */
export const toSavingsGoal = (row) => ({
  id: row.id,
  name: row.name,
  targetCents: row.target_cents,
  targetDay: row.target_date,
  startDay: row.start_date,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
});

export function createSavingsGoalRepository(sql) {
  return {
    /** Metas activas, la de fecha límite más cercana primero. */
    list() {
      return sql.query('SELECT * FROM savings_goals WHERE is_deleted=0 ORDER BY target_date, name').map(toSavingsGoal);
    },

    get(id) {
      const row = sql.queryOne('SELECT * FROM savings_goals WHERE id=? AND is_deleted=0', [id]);
      return row ? toSavingsGoal(row) : null;
    },

    /** Crea la meta o, si ya existe, cambia su nombre, monto y fecha. El inicio no cambia. */
    save({ id, name, targetCents, targetDay, startDay }) {
      sql.execute(
        `INSERT INTO savings_goals(id, name, target_cents, target_date, start_date, updated_at, is_deleted, needs_backup)
         VALUES(?,?,?,?,?,?,0,1)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, target_cents=excluded.target_cents,
           target_date=excluded.target_date, updated_at=excluded.updated_at, is_deleted=0, needs_backup=1`,
        [id, name, targetCents, targetDay, startDay, Date.now()],
      );
    },

    /** Borrado lógico: la fila queda para que el respaldo también la borre. */
    remove(id) {
      sql.execute('UPDATE savings_goals SET is_deleted=1, updated_at=?, needs_backup=1 WHERE id=?', [Date.now(), id]);
    },
  };
}
