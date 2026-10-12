// Dos almacenes de clave y valor:
//   - `settings`: ajustes que se sincronizan con el respaldo (presupuesto, búsqueda de Gmail...)
//   - `local_state`: solo locales de este teléfono (cursores, caché del tipo de cambio...)
// El valor se guarda como JSON, así que puede ser texto, número, booleano u objeto.

const readJson = (row, defaultValue) => (row ? JSON.parse(row.value) : defaultValue);

export function createSettingsStore(sql) {
  return {
    get(name, defaultValue = null) {
      return readJson(sql.queryOne('SELECT value FROM settings WHERE name=?', [name]), defaultValue);
    },
    set(name, value) {
      sql.execute(
        `INSERT INTO settings(name, value, updated_at, needs_backup) VALUES(?,?,?,1)
         ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, needs_backup=1`,
        [name, JSON.stringify(value), Date.now()],
      );
    },
  };
}

export function createLocalStateStore(sql) {
  return {
    get(name, defaultValue = null) {
      return readJson(sql.queryOne('SELECT value FROM local_state WHERE name=?', [name]), defaultValue);
    },
    set(name, value) {
      sql.execute(
        'INSERT INTO local_state(name, value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value',
        [name, JSON.stringify(value)],
      );
    },
  };
}
