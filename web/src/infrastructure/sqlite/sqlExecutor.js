// Envoltorio mínimo sobre una base de sql.js: consultas, escrituras y transacciones.
// Los repositorios usan esto en lugar de hablar directo con sql.js.

/**
 * @param {import('sql.js').Database} db
 * @param {{ onChange?: () => void }} [options]  `onChange` se llama después de cada escritura (para guardar la base).
 */
export function createSqlExecutor(db, { onChange = () => {} } = {}) {
  let transactionDepth = 0;

  /** Devuelve todas las filas como objetos { columna: valor }. */
  function query(sql, params = []) {
    const statement = db.prepare(sql);
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows;
  }

  /** Devuelve la primera fila, o null si no hay. */
  function queryOne(sql, params = []) {
    return query(sql, params)[0] ?? null;
  }

  /** Ejecuta una escritura (INSERT, UPDATE, DELETE). */
  function execute(sql, params = []) {
    db.run(sql, params);
    onChange();
  }

  /**
   * Ejecuta `work` como una unidad: si algo falla, no se aplica nada.
   * Si ya hay una transacción abierta, `work` simplemente se suma a ella.
   */
  function inTransaction(work) {
    if (transactionDepth > 0) return work();

    db.exec('BEGIN');
    transactionDepth++;
    try {
      const result = work();
      db.exec('COMMIT');
      onChange();
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      transactionDepth--;
    }
  }

  return { query, queryOne, execute, inTransaction };
}
