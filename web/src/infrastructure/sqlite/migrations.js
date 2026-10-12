// Esquema de la base local. Cada versión se aplica una sola vez, en orden.
// NUNCA edites una migración que ya se publicó: agrega una nueva al final.

const MIGRATIONS = {
  1: `
    CREATE TABLE tx (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,       -- monto original, en céntimos
      cur TEXT NOT NULL DEFAULT 'CRC',
      crc_cents INTEGER NOT NULL,          -- monto convertido a colones
      fx REAL,                             -- tipo de cambio usado (si fue USD)
      who TEXT NOT NULL,
      cat TEXT NOT NULL,
      cat_origin TEXT,
      type TEXT NOT NULL,                  -- sinpe | tarjeta | transferencia | efectivo
      dir TEXT NOT NULL DEFAULT 'out',     -- out = gasto, in = ingreso, self = entre mis cuentas
      bank TEXT,
      message_id TEXT,
      note TEXT,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 1     -- 1 = falta subirlo al respaldo
    );
    CREATE INDEX tx_date ON tx(date);
    CREATE INDEX tx_msg ON tx(message_id);
    CREATE TABLE mail (
      id TEXT PRIMARY KEY,                 -- id de Gmail o id local
      message_id TEXT,
      bank TEXT,
      from_addr TEXT,
      from_name TEXT,
      subject TEXT,
      body TEXT,
      received_at TEXT,
      status TEXT NOT NULL,                -- registrado | sin_movimiento
      template TEXT,
      tx_id TEXT
    );
    CREATE UNIQUE INDEX mail_msg ON mail(message_id);
    CREATE TABLE rule (
      id TEXT PRIMARY KEY,                 -- = match normalizado
      match TEXT NOT NULL,
      cat TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE setting (
      k TEXT PRIMARY KEY, v TEXT, updated_at INTEGER NOT NULL, dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
  `,
  // v2: nota del resultado de lectura (p. ej. "transacción negada") y estado 'negada'.
  2: `ALTER TABLE mail ADD COLUMN note TEXT;`,
};

const LATEST_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

/** Lleva la base a la última versión del esquema. */
export function migrate(db) {
  const currentVersion = db.exec('PRAGMA user_version')[0]?.values[0][0] || 0;
  for (let version = currentVersion + 1; version <= LATEST_VERSION; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
