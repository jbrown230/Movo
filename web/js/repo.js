// Capa de datos local sobre SQLite (sql.js). Toda la lógica pesada vive aquí,
// en el teléfono: ingesta, categorización, agregaciones y control de cambios.
// Recibe un objeto Database de sql.js, así que se prueba igual en Node.

import { parseEmailAll, categorize, PARSER_VERSION } from './parser.js';
import { hash53, normKey, uid, monthRange } from './format.js';

const SCHEMA_VERSION = 2;

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

export function migrate(db) {
  const v = db.exec('PRAGMA user_version')[0]?.values[0][0] || 0;
  for (let i = v + 1; i <= SCHEMA_VERSION; i++) {
    db.exec('BEGIN');
    try { db.exec(MIGRATIONS[i]); db.exec(`PRAGMA user_version = ${i}`); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

export function createRepo(db, { onChange = () => {} } = {}) {
  const all = (sql, p = []) => {
    const st = db.prepare(sql); st.bind(p);
    const rows = []; while (st.step()) rows.push(st.getAsObject());
    st.free(); return rows;
  };
  const get = (sql, p = []) => all(sql, p)[0] || null;
  const run = (sql, p = []) => { db.run(sql, p); };
  const tx = (fn) => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); onChange(); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  const repo = {
    // ---------- meta (solo local) ----------
    meta(k, def = null) { const r = get('SELECT v FROM meta WHERE k=?', [k]); return r ? JSON.parse(r.v) : def; },
    setMeta(k, v) { run('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', [k, JSON.stringify(v)]); onChange(); },

    // ---------- ajustes (se sincronizan) ----------
    setting(k, def = null) { const r = get('SELECT v FROM setting WHERE k=?', [k]); return r ? JSON.parse(r.v) : def; },
    setSetting(k, v) {
      run('INSERT INTO setting(k,v,updated_at,dirty) VALUES(?,?,?,1) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, dirty=1',
        [k, JSON.stringify(v), Date.now()]); onChange();
    },

    // ---------- reglas ----------
    rules() { return all('SELECT match, cat FROM rule WHERE deleted=0 ORDER BY updated_at DESC'); },

    /** La persona decide cómo contar un movimiento: gasto, ingreso o entre sus cuentas. */
    setDir(txId, dir) {
      const t = repo.getTx(txId); if (!t || !['in', 'out', 'self'].includes(dir)) return null;
      const c = dir === 'out' ? categorize(t.who, t.type, 'out', repo.rules()) : categorize(t.who, t.type, dir);
      tx(() => run("UPDATE tx SET dir=?, cat=?, cat_origin='elegida por ti', updated_at=?, dirty=1 WHERE id=?", [dir, c.cat, Date.now(), txId]));
      return repo.getTx(txId);
    },

    /** Cambia la categoría y guarda una regla para el comercio/destinatario. */
    recategorize(txId, cat) {
      const t = get('SELECT * FROM tx WHERE id=?', [txId]); if (!t) return 0;
      const key = normKey(t.who), now = Date.now();
      return tx(() => {
        run(`INSERT INTO rule(id,match,cat,updated_at,deleted,dirty) VALUES(?,?,?,?,0,1)
             ON CONFLICT(id) DO UPDATE SET cat=excluded.cat, updated_at=excluded.updated_at, deleted=0, dirty=1`, [key, key, cat, now]);
        const rows = all('SELECT id, who FROM tx WHERE deleted=0 AND dir=?', [t.dir]).filter((r) => normKey(r.who) === key);
        for (const r of rows) run("UPDATE tx SET cat=?, cat_origin='tu regla', updated_at=?, dirty=1 WHERE id=?", [cat, now, r.id]);
        return rows.length;
      });
    },

    // ---------- correos ----------
    hasMail(id, messageId) {
      return !!get('SELECT 1 FROM mail WHERE id=? OR (message_id IS NOT NULL AND message_id=?)', [id, messageId || '\u0000']);
    },

    /**
     * Ingesta idempotente: el mismo correo nunca crea movimientos repetidos.
     * Un correo puede traer varias transacciones (tabla de tarjeta del BCR).
     * Las transacciones "Negadas" no se registran como gasto.
     * El id de cada movimiento se deriva del Message-ID: dos teléfonos del
     * mismo usuario generan los mismos ids y el respaldo no duplica.
     * @returns {{status:'duplicado'|'registrado'|'sin_movimiento'|'negada', tx?:object, txs?:object[], parsed?:object}}
     */
    ingestMail(mail, { fx = null } = {}) {
      const messageId = mail.messageId || null;
      if (repo.hasMail(mail.id, messageId)) return { status: 'duplicado' };
      const p = parseEmailAll(mail);
      const key = messageId || mail.id;
      const insertMail = (status, template, txId, note) => run(
        `INSERT INTO mail(id,message_id,bank,from_addr,from_name,subject,body,received_at,status,template,tx_id,note)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [mail.id, messageId, p.bank, mail.from || null, mail.fromName || null, mail.subject || '', mail.body || '',
          mail.date || new Date().toISOString(), status, template, txId, note]);
      return tx(() => {
        if (!p.ok) { insertMail('sin_movimiento', null, null, p.reason); return { status: 'sin_movimiento', parsed: p }; }
        const ok = p.items.filter((i) => !i.declined), declined = p.items.length - ok.length;
        if (!ok.length) {
          const i = p.items[0];
          insertMail('negada', p.template, null, `El banco marcó la transacción como "${i.status || 'negada'}" (${i.who}, ${i.cur === 'USD' ? 'US$' : '₡'}${(i.amountCents / 100).toFixed(2)}). No se registra como gasto.`);
          return { status: 'negada', parsed: p };
        }
        const rules = repo.rules(), ids = [];
        p.items.forEach((it, idx) => {
          if (it.declined) return;
          const id = 'm' + hash53(idx === 0 ? key : key + '#' + idx);
          ids.push(id);
          if (get('SELECT id FROM tx WHERE id=?', [id])) return;
          const c = categorize(it.who, it.type, it.dir, rules);
          const rate = it.cur === 'USD' ? (fx || 0) : null;
          const crcCents = it.cur === 'USD' ? Math.round(it.amountCents * (rate || 0)) : it.amountCents;
          run(`INSERT INTO tx(id,date,amount_cents,cur,crc_cents,fx,who,cat,cat_origin,type,dir,bank,message_id,note,updated_at,deleted,dirty)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
            [id, it.date, it.amountCents, it.cur, crcCents, rate, it.who, c.cat, c.origin, it.type, it.dir, p.bank, key, it.note, Date.now()]);
        });
        insertMail('registrado', p.template, ids[0], declined ? `${declined} transacción(es) negada(s) en este correo no se registraron.` : null);
        const txs = ids.map((i) => repo.getTx(i));
        return { status: 'registrado', tx: txs[0], txs, parsed: p };
      });
    },

    /** Vuelve a leer un correo que no generó movimiento (por ejemplo, tras mejorar el lector). */
    reparse(id) {
      const m = repo.getMail(id);
      if (!m) return { status: 'no_existe' };
      if (m.status === 'registrado' || m.status === 'descartado') return { status: 'duplicado' };
      run('DELETE FROM mail WHERE id=?', [id]);
      return repo.ingestMail({ id: m.id, messageId: m.message_id, from: m.from_addr, fromName: m.from_name, subject: m.subject, body: m.body, date: m.received_at }, { fx: repo.meta('fx')?.rate || null });
    },
    /**
     * Si cambió la versión del lector: reintenta los correos no reconocidos y
     * corrige la dirección (gasto / ingreso / entre mis cuentas) de lo ya leído,
     * sin tocar lo que la persona cambió a mano.
     */
    reparseIfParserChanged() {
      if (repo.meta('parser_version') === PARSER_VERSION) return 0;
      let n = 0;
      for (const m of all("SELECT id FROM mail WHERE status IN ('sin_movimiento','negada')")) if (repo.reparse(m.id).status === 'registrado') n++;
      for (const m of all("SELECT * FROM mail WHERE status='registrado' AND template IS NOT NULL")) {
        const p = parseEmailAll({ from: m.from_addr, subject: m.subject, body: m.body, date: m.received_at });
        if (!p.ok) continue;
        const key = m.message_id || m.id;
        p.items.forEach((it, idx) => {
          const t = get('SELECT * FROM tx WHERE id=?', ['m' + hash53(idx === 0 ? key : key + '#' + idx)]);
          if (!t || t.deleted || t.dir === it.dir || t.cat_origin === 'elegida por ti') return;
          const c = categorize(t.who, t.type, it.dir, repo.rules());
          run('UPDATE tx SET dir=?, cat=?, cat_origin=?, note=?, updated_at=?, dirty=1 WHERE id=?', [it.dir, c.cat, c.origin, it.note, Date.now(), t.id]);
          n++;
        });
      }
      repo.setMeta('parser_version', PARSER_VERSION);
      return n;
    },
    txsForMail(m) { return all('SELECT * FROM tx WHERE message_id=? AND deleted=0 ORDER BY date', [m.message_id || m.id]); },
    mailForTx(t) { return t.message_id ? get('SELECT id FROM mail WHERE message_id=? OR id=?', [t.message_id, t.message_id]) : null; },

    mails() { return all('SELECT id, bank, from_name, from_addr, subject, substr(body,1,140) AS preview, received_at, status, tx_id FROM mail ORDER BY received_at DESC LIMIT 300'); },
    getMail(id) { return get('SELECT * FROM mail WHERE id=?', [id]); },

    // ---------- movimientos ----------
    addManual({ amountCents, who, cat, type = 'efectivo', dir = 'out', date = new Date().toISOString(), note = null, mailId = null }) {
      const id = uid();
      const m = mailId ? repo.getMail(mailId) : null;
      const mailKey = m ? (m.message_id || m.id) : null;
      return tx(() => {
        run(`INSERT INTO tx(id,date,amount_cents,cur,crc_cents,fx,who,cat,cat_origin,type,dir,bank,message_id,note,updated_at,deleted,dirty)
             VALUES(?,?,?,'CRC',?,NULL,?,?,'elegida por ti',?,?,NULL,?,?,?,0,1)`,
          [id, date, amountCents, amountCents, who, cat, type, dir, mailKey, note, Date.now()]);
        if (mailId) run("UPDATE mail SET status='registrado', tx_id=?, note='Registrado a mano.' WHERE id=?", [id, mailId]);
        return repo.getTx(id);
      });
    },
    deleteTx(id) {
      tx(() => {
        run('UPDATE tx SET deleted=1, updated_at=?, dirty=1 WHERE id=?', [Date.now(), id]);
        run("UPDATE mail SET status='descartado', tx_id=NULL, note='Eliminaste este movimiento.' WHERE tx_id=?", [id]);
      });
    },
    getTx(id) { return get('SELECT * FROM tx WHERE id=?', [id]); },
    listTx(limit = 400) { return all('SELECT * FROM tx WHERE deleted=0 ORDER BY date DESC LIMIT ?', [limit]); },

    /** Agregación del mes en SQL, en el propio teléfono. */
    monthSummary(d = new Date()) {
      const [a, b] = monthRange(d);
      const byCat = all(`SELECT cat, SUM(crc_cents) AS total, COUNT(*) AS n FROM tx
                         WHERE deleted=0 AND dir='out' AND date>=? AND date<? GROUP BY cat ORDER BY total DESC`, [a, b]);
      const income = get(`SELECT COALESCE(SUM(crc_cents),0) AS t FROM tx WHERE deleted=0 AND dir='in' AND date>=? AND date<?`, [a, b]).t;
      const moved = get(`SELECT COALESCE(SUM(crc_cents),0) AS t FROM tx WHERE deleted=0 AND dir='self' AND date>=? AND date<?`, [a, b]).t;
      return { spent: byCat.reduce((s, r) => s + r.total, 0), income, moved, byCat };
    },

    /** Corrige movimientos en USD que se guardaron sin tipo de cambio. */
    backfillFx(fx) {
      if (!fx) return;
      const rows = all("SELECT id, amount_cents FROM tx WHERE cur='USD' AND (fx IS NULL OR fx=0)");
      if (!rows.length) return;
      tx(() => { for (const r of rows) run('UPDATE tx SET fx=?, crc_cents=?, updated_at=?, dirty=1 WHERE id=?', [fx, Math.round(r.amount_cents * fx), Date.now(), r.id]); });
    },

    // ---------- sincronización (respaldo opcional) ----------
    dirty(limit = 500) {
      const t = all('SELECT * FROM tx WHERE dirty=1 LIMIT ?', [limit]).map((r) => ({
        id: r.id, updatedAt: r.updated_at, deleted: !!r.deleted,
        data: { date: r.date, amountCents: r.amount_cents, cur: r.cur, crcCents: r.crc_cents, fx: r.fx, who: r.who, cat: r.cat,
          catOrigin: r.cat_origin, type: r.type, dir: r.dir, bank: r.bank, messageId: r.message_id, note: r.note },
      }));
      const rl = all('SELECT * FROM rule WHERE dirty=1 LIMIT ?', [limit]).map((r) => ({ id: r.id, updatedAt: r.updated_at, deleted: !!r.deleted, data: { match: r.match, cat: r.cat } }));
      const st = all('SELECT * FROM setting WHERE dirty=1 LIMIT ?', [limit]).map((r) => ({ id: r.k, updatedAt: r.updated_at, deleted: false, data: { v: JSON.parse(r.v) } }));
      return { tx: t, rule: rl, setting: st };
    },
    markClean(sent) {
      tx(() => {
        for (const r of sent.tx || []) run('UPDATE tx SET dirty=0 WHERE id=? AND updated_at=?', [r.id, r.updatedAt]);
        for (const r of sent.rule || []) run('UPDATE rule SET dirty=0 WHERE id=? AND updated_at=?', [r.id, r.updatedAt]);
        for (const r of sent.setting || []) run('UPDATE setting SET dirty=0 WHERE k=? AND updated_at=?', [r.id, r.updatedAt]);
      });
    },
    /** Aplica cambios del servidor con "gana el más reciente" (last-write-wins). */
    applyRemote(changes) {
      let n = 0;
      tx(() => {
        for (const r of changes.tx || []) {
          const cur = get('SELECT updated_at, dirty FROM tx WHERE id=?', [r.id]);
          if (cur && cur.updated_at >= r.updatedAt) continue;
          const d = r.data || {};
          run(`INSERT INTO tx(id,date,amount_cents,cur,crc_cents,fx,who,cat,cat_origin,type,dir,bank,message_id,note,updated_at,deleted,dirty)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
               ON CONFLICT(id) DO UPDATE SET date=excluded.date, amount_cents=excluded.amount_cents, cur=excluded.cur, crc_cents=excluded.crc_cents,
               fx=excluded.fx, who=excluded.who, cat=excluded.cat, cat_origin=excluded.cat_origin, type=excluded.type, dir=excluded.dir,
               bank=excluded.bank, message_id=excluded.message_id, note=excluded.note, updated_at=excluded.updated_at, deleted=excluded.deleted, dirty=0`,
            [r.id, d.date, d.amountCents | 0, d.cur || 'CRC', d.crcCents | 0, d.fx ?? null, d.who || '', d.cat || 'otros', d.catOrigin || null,
              d.type || 'transferencia', d.dir || 'out', d.bank || null, d.messageId || null, d.note || null, r.updatedAt, r.deleted ? 1 : 0]);
          n++;
        }
        for (const r of changes.rule || []) {
          const cur = get('SELECT updated_at FROM rule WHERE id=?', [r.id]);
          if (cur && cur.updated_at >= r.updatedAt) continue;
          run(`INSERT INTO rule(id,match,cat,updated_at,deleted,dirty) VALUES(?,?,?,?,?,0)
               ON CONFLICT(id) DO UPDATE SET match=excluded.match, cat=excluded.cat, updated_at=excluded.updated_at, deleted=excluded.deleted, dirty=0`,
            [r.id, r.data?.match || r.id, r.data?.cat || 'otros', r.updatedAt, r.deleted ? 1 : 0]);
          n++;
        }
        for (const r of changes.setting || []) {
          const cur = get('SELECT updated_at FROM setting WHERE k=?', [r.id]);
          if (cur && cur.updated_at >= r.updatedAt) continue;
          run(`INSERT INTO setting(k,v,updated_at,dirty) VALUES(?,?,?,0)
               ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, dirty=0`, [r.id, JSON.stringify(r.data?.v ?? null), r.updatedAt]);
          n++;
        }
      });
      return n;
    },
    pendingCount() { return get('SELECT (SELECT COUNT(*) FROM tx WHERE dirty=1)+(SELECT COUNT(*) FROM rule WHERE dirty=1)+(SELECT COUNT(*) FROM setting WHERE dirty=1) AS n').n; },
    counts() { return get("SELECT (SELECT COUNT(*) FROM tx WHERE deleted=0) AS tx, (SELECT COUNT(*) FROM mail) AS mail"); },
  };
  return repo;
}
