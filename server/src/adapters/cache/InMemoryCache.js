// Caché en la memoria del propio proceso. Es el respaldo cuando Redis no está disponible
// (más lenta y por proceso, pero el servidor sigue funcionando). Imita las estructuras de
// RedisCache: valores con vencimiento, ventanas deslizantes y hashes.

const MAX_ENTRIES = 5000;

/** @returns {Omit<import('../../application/ports.js').Cache, 'isSharedCacheReady'>} */
export function createInMemoryCache() {
  /** @type {Map<string, {value: unknown, expiresAt: number}>} */
  const entries = new Map();

  function readLive(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry;
  }

  function store(key, value, ttlSeconds) {
    if (entries.size > MAX_ENTRIES) entries.clear(); // límite simple para no crecer sin fin
    entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  return {
    async get(key) {
      return readLive(key)?.value ?? null;
    },

    async set(key, value, ttlSeconds) {
      store(key, value, ttlSeconds);
    },

    async countInSlidingWindow(key, windowSeconds) {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      const recent = (readLive(key)?.value ?? []).filter((time) => time > windowStart);
      recent.push(now);
      store(key, recent, windowSeconds);
      return recent.length;
    },

    async getHash(key) {
      const fields = readLive(key)?.value;
      return fields ? { ...fields } : null;
    },

    async setHash(key, fields, ttlSeconds) {
      const asText = Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, String(value)]));
      store(key, asText, ttlSeconds);
    },

    async delete(key) {
      entries.delete(key);
    },

    async close() {},
  };
}
