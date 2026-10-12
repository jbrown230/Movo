// Repositorio de reglas de categoría que crea la persona (tabla `category_rules`).
// `counterparty_key` es el nombre del comercio o persona ya normalizado (ver domain/names.js).

export function createRuleRepository(sql) {
  return {
    /** Reglas activas, las más recientes primero. */
    list() {
      return sql
        .query('SELECT counterparty_key, category FROM category_rules WHERE is_deleted=0 ORDER BY updated_at DESC')
        .map((row) => ({ counterpartyKey: row.counterparty_key, category: row.category }));
    },

    /** Crea la regla o, si ya existe para ese comercio, cambia su categoría. */
    save(counterpartyKey, category) {
      sql.execute(
        `INSERT INTO category_rules(id, counterparty_key, category, updated_at, is_deleted, needs_backup)
         VALUES(?,?,?,?,0,1)
         ON CONFLICT(id) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at,
           is_deleted=0, needs_backup=1`,
        [counterpartyKey, counterpartyKey, category, Date.now()],
      );
    },
  };
}
