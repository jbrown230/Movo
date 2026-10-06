// Redis como capa efímera: caché de verificación de tokens, límite de peticiones
// y tipo de cambio. Si Redis no está disponible, todo sigue funcionando con un
// respaldo en memoria (más lento y por proceso, pero sin caerse).
import { createClient } from 'redis';

export function createCache(url, log = console) {
  const mem = new Map(); // respaldo: key -> {v, exp}
  let client = null;
  if (url) {
    client = createClient({ url, socket: { reconnectStrategy: (n) => Math.min(n * 500, 5000) } });
    client.on('error', (e) => log.warn?.('[redis]', e.message));
    client.connect().catch((e) => log.warn?.('[redis] sin conexión:', e.message));
  }
  const ready = () => !!client?.isReady;
  const memGet = (k) => { const e = mem.get(k); if (!e) return null; if (e.exp < Date.now()) { mem.delete(k); return null; } return e.v; };

  return {
    ready,
    async get(k) {
      if (ready()) { try { return await client.get(k); } catch {} }
      return memGet(k);
    },
    async set(k, v, ttlSec) {
      if (ready()) { try { await client.set(k, v, { EX: Math.max(1, Math.floor(ttlSec)) }); return; } catch {} }
      if (mem.size > 5000) mem.clear();
      mem.set(k, { v, exp: Date.now() + ttlSec * 1000 });
    },
    /** Contador con expiración (ventana fija). */
    async hit(k, ttlSec) {
      if (ready()) {
        try { const n = await client.incr(k); if (n === 1) await client.expire(k, ttlSec); return n; } catch {}
      }
      const n = (Number(memGet(k)) || 0) + 1;
      const e = mem.get(k);
      mem.set(k, { v: n, exp: e?.exp > Date.now() ? e.exp : Date.now() + ttlSec * 1000 });
      return n;
    },
    async close() { if (client) await client.quit().catch(() => {}); },
  };
}
