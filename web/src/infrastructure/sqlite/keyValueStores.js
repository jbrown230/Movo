// Dos almacenes de clave y valor:
//   - ajustes (`setting`): se sincronizan con el respaldo (presupuesto, búsqueda de Gmail...)
//   - meta (`meta`): solo locales de este teléfono (cursores, caché del tipo de cambio...)

const readJson = (row, defaultValue) => (row ? JSON.parse(row.v) : defaultValue);

export function createSettingsStore(sql) {
  return {
    get(key, defaultValue = null) {
      return readJson(sql.queryOne('SELECT v FROM setting WHERE k=?', [key]), defaultValue);
    },
    set(key, value) {
      sql.execute(
        `INSERT INTO setting(k,v,updated_at,dirty) VALUES(?,?,?,1)
         ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, dirty=1`,
        [key, JSON.stringify(value), Date.now()],
      );
    },
  };
}

export function createMetaStore(sql) {
  return {
    get(key, defaultValue = null) {
      return readJson(sql.queryOne('SELECT v FROM meta WHERE k=?', [key]), defaultValue);
    },
    set(key, value) {
      sql.execute(
        'INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v',
        [key, JSON.stringify(value)],
      );
    },
  };
}
