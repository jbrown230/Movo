// Repositorio de reglas de categoría que crea la persona (tabla `rule`).

export function createRuleRepository(sql) {
  return {
    /** Reglas activas, las más recientes primero. */
    list() {
      return sql
        .query('SELECT match, cat FROM rule WHERE deleted=0 ORDER BY updated_at DESC')
        .map((row) => ({ match: row.match, category: row.cat }));
    },

    /** Crea la regla o, si ya existe para ese comercio, cambia su categoría. */
    save(match, category) {
      sql.execute(
        `INSERT INTO rule(id,match,cat,updated_at,deleted,dirty) VALUES(?,?,?,?,0,1)
         ON CONFLICT(id) DO UPDATE SET cat=excluded.cat, updated_at=excluded.updated_at, deleted=0, dirty=1`,
        [match, match, category, Date.now()],
      );
    },
  };
}
