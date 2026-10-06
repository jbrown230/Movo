// Respaldo por usuario en MongoDB. Una sola colección "records": cada documento
// es { userId, kind, id, updatedAt, srvAt, deleted, data } y TODA consulta lleva
// userId en el filtro, así los datos de cada persona quedan separados.
import { MongoClient } from 'mongodb';

let seq = 0;
export const nextSrvAt = () => Date.now() * 1000 + (seq = (seq + 1) % 1000);

export function mongoStore(url, log = console) {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 4000 });
  let col = null;
  const ready = client.connect().then(async () => {
    col = client.db().collection('records');
    await col.createIndex({ userId: 1, kind: 1, id: 1 }, { unique: true });
    await col.createIndex({ userId: 1, srvAt: 1 });
    log.info?.('[mongo] conectado');
  }).catch((e) => { log.warn?.('[mongo] sin conexión:', e.message); });

  const need = async () => { await ready; if (!col) throw Object.assign(new Error('Respaldo no disponible por ahora.'), { status: 503 }); return col; };

  return {
    async ping() { try { await need(); await client.db().command({ ping: 1 }); return true; } catch { return false; } },

    /** Último en escribir gana: solo se reemplaza si el cambio es más reciente. */
    async push(userId, changes) {
      if (!changes.length) return 0;
      const c = await need();
      const ops = changes.map((r) => ({
        updateOne: {
          filter: { userId, kind: r.kind, id: r.id, updatedAt: { $lt: r.updatedAt } },
          update: { $set: { userId, kind: r.kind, id: r.id, updatedAt: r.updatedAt, deleted: r.deleted, data: r.data, srvAt: nextSrvAt() } },
          upsert: true,
        },
      }));
      try { const res = await c.bulkWrite(ops, { ordered: false }); return res.upsertedCount + res.modifiedCount; }
      catch (e) {
        // E11000 = ya existe una versión más nueva: se ignora a propósito.
        const errs = e.writeErrors || e.result?.getWriteErrors?.() || [];
        if (errs.length && errs.every((w) => (w.code ?? w.err?.code) === 11000)) return (e.result?.upsertedCount || 0) + (e.result?.modifiedCount || 0);
        throw e;
      }
    },

    async pull(userId, since, limit = 1000) {
      const c = await need();
      return c.find({ userId, srvAt: { $gt: since } }, { projection: { _id: 0, userId: 0 } }).sort({ srvAt: 1 }).limit(limit).toArray();
    },

    async wipe(userId) { const c = await need(); return (await c.deleteMany({ userId })).deletedCount; },
    async close() { await client.close().catch(() => {}); },
  };
}

/** Implementación en memoria con la misma semántica (tests y modo sin MongoDB). */
export function memoryStore() {
  const rows = new Map();
  const key = (u, k, id) => `${u}\u0000${k}\u0000${id}`;
  return {
    async ping() { return true; },
    async push(userId, changes) {
      let n = 0;
      for (const r of changes) {
        const k = key(userId, r.kind, r.id), cur = rows.get(k);
        if (cur && cur.updatedAt >= r.updatedAt) continue;
        rows.set(k, { userId, kind: r.kind, id: r.id, updatedAt: r.updatedAt, deleted: r.deleted, data: r.data, srvAt: nextSrvAt() }); n++;
      }
      return n;
    },
    async pull(userId, since, limit = 1000) {
      return [...rows.values()].filter((r) => r.userId === userId && r.srvAt > since).sort((a, b) => a.srvAt - b.srvAt).slice(0, limit)
        .map(({ userId: _u, ...r }) => r);
    },
    async wipe(userId) { let n = 0; for (const [k, r] of rows) if (r.userId === userId) { rows.delete(k); n++; } return n; },
    async close() {},
  };
}
