// Caché en la memoria del propio proceso. Es el respaldo cuando Redis no está disponible
// (más lenta y por proceso, pero el servidor sigue funcionando).

const MAX_ENTRIES = 5000;

/** @returns {Omit<import('../../application/ports.js').Cache, 'isSharedCacheReady'>} */
export function createInMemoryCache() {
  /** @type {Map<string, {value: string|number, expiresAt: number}>} */
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

  return {
    async get(key) {
      return readLive(key)?.value ?? null;
    },

    async set(key, value, ttlSeconds) {
      if (entries.size > MAX_ENTRIES) entries.clear(); // límite simple para no crecer sin fin
      entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },

    async incrementWindowCounter(key, ttlSeconds) {
      const current = readLive(key);
      const count = (Number(current?.value) || 0) + 1;
      const expiresAt = current?.expiresAt ?? Date.now() + ttlSeconds * 1000;
      entries.set(key, { value: count, expiresAt });
      return count;
    },

    async close() {},
  };
}
