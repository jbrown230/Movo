// Esquema de la base local.
//
// Las migraciones se aplican una sola vez, en orden, y llevan el número en `PRAGMA user_version`.
// Una instalación nueva ejecuta todas desde la 1. Cuando necesites cambiar el esquema DESPUÉS de
// publicar una versión, no edites una migración existente: agrega una nueva al final.
//
// TABLAS
//
//   transactions      Cada movimiento de dinero.
//   mails             Cada correo del banco que Movo leyó.
//   category_rules    Reglas que crea la persona ("este comercio va en Comida").
//   settings          Ajustes que se sincronizan con el respaldo (presupuesto, búsqueda de Gmail).
//   savings_goals     Metas de ahorro de la persona (desde la migración 2).
//   local_state       Estado que solo importa en este teléfono (cursores, caché del tipo de cambio).
//
// Las columnas `needs_backup` e `is_deleted` sirven para el respaldo en la nube:
//   needs_backup = 1  ->  el cambio todavía no se subió al servidor
//   is_deleted   = 1  ->  "borrado lógico": la fila queda para que el servidor también la borre

const MIGRATIONS = {
  1: `
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,                      -- fecha y hora del movimiento (ISO, UTC)
      amount_cents INTEGER NOT NULL,                  -- monto original, en céntimos de su moneda
      currency TEXT NOT NULL DEFAULT 'CRC',           -- CRC | USD
      amount_crc_cents INTEGER NOT NULL,              -- monto convertido a colones, en céntimos
      exchange_rate REAL,                             -- tipo de cambio usado (solo si fue en dólares)
      counterparty TEXT NOT NULL,                     -- comercio o persona
      category TEXT NOT NULL,
      category_origin TEXT,                           -- quién decidió la categoría
      type TEXT NOT NULL,                             -- sinpe | tarjeta | transferencia | efectivo
      direction TEXT NOT NULL DEFAULT 'out',          -- out = gasto, in = ingreso, self = entre mis cuentas
      bank TEXT,
      mail_key TEXT,                                  -- Message-ID del correo del que salió (si hubo uno)
      note TEXT,
      updated_at INTEGER NOT NULL,                    -- milisegundos; decide quién gana al sincronizar
      is_deleted INTEGER NOT NULL DEFAULT 0,
      needs_backup INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX transactions_by_date ON transactions(occurred_at);
    CREATE INDEX transactions_by_mail_key ON transactions(mail_key);

    CREATE TABLE mails (
      id TEXT PRIMARY KEY,                            -- id de Gmail o id local
      message_id TEXT,                                -- cabecera Message-ID (igual en cualquier teléfono)
      bank TEXT,
      from_address TEXT,
      from_name TEXT,
      subject TEXT,
      body TEXT,
      received_at TEXT,
      status TEXT NOT NULL,                           -- registrado | sin_movimiento | negada | descartado
      template TEXT,                                  -- plantilla del lector que lo entendió
      transaction_id TEXT,                            -- primer movimiento que salió de este correo
      note TEXT                                       -- resultado de la lectura, en palabras
    );
    CREATE UNIQUE INDEX mails_by_message_id ON mails(message_id);

    CREATE TABLE category_rules (
      id TEXT PRIMARY KEY,                            -- igual a counterparty_key
      counterparty_key TEXT NOT NULL,                 -- nombre del comercio ya normalizado
      category TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      needs_backup INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE settings (
      name TEXT PRIMARY KEY,
      value TEXT,                                     -- JSON
      updated_at INTEGER NOT NULL,
      needs_backup INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE local_state (
      name TEXT PRIMARY KEY,
      value TEXT                                      -- JSON
    );
  `,
  2: `
    CREATE TABLE savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL,                  -- monto a ahorrar, en céntimos de colones
      target_date TEXT NOT NULL,                      -- fecha límite, "AAAA-MM-DD" (incluida)
      start_date TEXT NOT NULL,                       -- primer día del mes en que se creó, "AAAA-MM-01"
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      needs_backup INTEGER NOT NULL DEFAULT 1
    );
  `,
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
