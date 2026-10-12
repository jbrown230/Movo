// Cola del respaldo en la nube: qué cambios faltan por subir y cómo aplicar los que llegan.
//
// Los registros que cambian se marcan con `dirty=1`. Al sincronizar, se suben y se
// marcan como limpios. Lo que llega del servidor se aplica con "gana el más reciente":
// solo reemplaza lo local si su `updatedAt` es mayor.
//
// El formato de red (nombres como `amountCents`, `cat`, `dir`) lo comparten el
// teléfono y el servidor (server/src/validate.js). No lo cambies sin cambiar ambos.

const PUSH_LIMIT = 500;

const transactionToWire = (row) => ({
  id: row.id,
  updatedAt: row.updated_at,
  deleted: Boolean(row.deleted),
  data: {
    date: row.date, amountCents: row.amount_cents, cur: row.cur, crcCents: row.crc_cents, fx: row.fx,
    who: row.who, cat: row.cat, catOrigin: row.cat_origin, type: row.type, dir: row.dir,
    bank: row.bank, messageId: row.message_id, note: row.note,
  },
});

const ruleToWire = (row) => ({
  id: row.id, updatedAt: row.updated_at, deleted: Boolean(row.deleted),
  data: { match: row.match, cat: row.cat },
});

const settingToWire = (row) => ({
  id: row.k, updatedAt: row.updated_at, deleted: false,
  data: { v: JSON.parse(row.v) },
});

export function createBackupRepository(sql) {
  const isOlderOrEqual = (table, keyColumn, id, incomingUpdatedAt) => {
    const current = sql.queryOne(`SELECT updated_at FROM ${table} WHERE ${keyColumn}=?`, [id]);
    return Boolean(current && current.updated_at >= incomingUpdatedAt);
  };

  function applyRemoteTransaction(remote) {
    if (isOlderOrEqual('tx', 'id', remote.id, remote.updatedAt)) return false;
    const data = remote.data || {};
    sql.execute(
      `INSERT INTO tx(id,date,amount_cents,cur,crc_cents,fx,who,cat,cat_origin,type,dir,bank,message_id,note,updated_at,deleted,dirty)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
       ON CONFLICT(id) DO UPDATE SET date=excluded.date, amount_cents=excluded.amount_cents, cur=excluded.cur,
         crc_cents=excluded.crc_cents, fx=excluded.fx, who=excluded.who, cat=excluded.cat, cat_origin=excluded.cat_origin,
         type=excluded.type, dir=excluded.dir, bank=excluded.bank, message_id=excluded.message_id, note=excluded.note,
         updated_at=excluded.updated_at, deleted=excluded.deleted, dirty=0`,
      [
        remote.id, data.date, data.amountCents | 0, data.cur || 'CRC', data.crcCents | 0, data.fx ?? null,
        data.who || '', data.cat || 'otros', data.catOrigin || null, data.type || 'transferencia', data.dir || 'out',
        data.bank || null, data.messageId || null, data.note || null, remote.updatedAt, remote.deleted ? 1 : 0,
      ],
    );
    return true;
  }

  function applyRemoteRule(remote) {
    if (isOlderOrEqual('rule', 'id', remote.id, remote.updatedAt)) return false;
    sql.execute(
      `INSERT INTO rule(id,match,cat,updated_at,deleted,dirty) VALUES(?,?,?,?,?,0)
       ON CONFLICT(id) DO UPDATE SET match=excluded.match, cat=excluded.cat, updated_at=excluded.updated_at,
         deleted=excluded.deleted, dirty=0`,
      [remote.id, remote.data?.match || remote.id, remote.data?.cat || 'otros', remote.updatedAt, remote.deleted ? 1 : 0],
    );
    return true;
  }

  function applyRemoteSetting(remote) {
    if (isOlderOrEqual('setting', 'k', remote.id, remote.updatedAt)) return false;
    sql.execute(
      `INSERT INTO setting(k,v,updated_at,dirty) VALUES(?,?,?,0)
       ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, dirty=0`,
      [remote.id, JSON.stringify(remote.data?.v ?? null), remote.updatedAt],
    );
    return true;
  }

  return {
    /** Cambios locales que faltan por subir. */
    collectPending(limit = PUSH_LIMIT) {
      return {
        tx: sql.query('SELECT * FROM tx WHERE dirty=1 LIMIT ?', [limit]).map(transactionToWire),
        rule: sql.query('SELECT * FROM rule WHERE dirty=1 LIMIT ?', [limit]).map(ruleToWire),
        setting: sql.query('SELECT * FROM setting WHERE dirty=1 LIMIT ?', [limit]).map(settingToWire),
      };
    },

    /** Marca como subido lo que ya recibió el servidor (solo si no cambió mientras tanto). */
    markSynced(sent) {
      sql.inTransaction(() => {
        for (const item of sent.tx || []) sql.execute('UPDATE tx SET dirty=0 WHERE id=? AND updated_at=?', [item.id, item.updatedAt]);
        for (const item of sent.rule || []) sql.execute('UPDATE rule SET dirty=0 WHERE id=? AND updated_at=?', [item.id, item.updatedAt]);
        for (const item of sent.setting || []) sql.execute('UPDATE setting SET dirty=0 WHERE k=? AND updated_at=?', [item.id, item.updatedAt]);
      });
    },

    /** Aplica los cambios que llegan del servidor. Devuelve cuántos modificaron algo local. */
    applyRemote(changes) {
      let applied = 0;
      const applyAll = (items, applyOne) => {
        for (const remote of items || []) if (applyOne(remote)) applied++;
      };
      sql.inTransaction(() => {
        applyAll(changes.tx, applyRemoteTransaction);
        applyAll(changes.rule, applyRemoteRule);
        applyAll(changes.setting, applyRemoteSetting);
      });
      return applied;
    },

    pendingCount() {
      return sql.queryOne(
        `SELECT (SELECT COUNT(*) FROM tx WHERE dirty=1) + (SELECT COUNT(*) FROM rule WHERE dirty=1)
              + (SELECT COUNT(*) FROM setting WHERE dirty=1) AS n`,
      ).n;
    },
  };
}
