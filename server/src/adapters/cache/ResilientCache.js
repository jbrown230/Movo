// Caché que usa Redis cuando responde y, si no, la memoria del proceso. Redis nunca tumba al servidor.

/**
 * @param {Object} parts
 * @param {ReturnType<import('./RedisCache.js').createRedisCache>|null} parts.redis  null si no hay REDIS_URL.
 * @param {ReturnType<import('./InMemoryCache.js').createInMemoryCache>} parts.memory
 * @returns {import('../../application/ports.js').Cache}
 */
export function createResilientCache({ redis, memory }) {
  const redisIsReady = () => Boolean(redis?.isReady());

  /** Prueba primero en Redis; si no está listo o falla, usa la memoria. */
  async function withFallback(operationName, ...args) {
    if (redisIsReady()) {
      try {
        return await redis[operationName](...args);
      } catch {
        // Redis falló a mitad de camino: se sigue con la memoria.
      }
    }
    return memory[operationName](...args);
  }

  return {
    get: (key) => withFallback('get', key),
    set: (key, value, ttlSeconds) => withFallback('set', key, value, ttlSeconds),
    countInSlidingWindow: (key, windowSeconds) => withFallback('countInSlidingWindow', key, windowSeconds),
    getHash: (key) => withFallback('getHash', key),
    setHash: (key, fields, ttlSeconds) => withFallback('setHash', key, fields, ttlSeconds),

    /**
     * Se borra en los dos lados: si Redis estuvo caído, la memoria pudo guardar una copia
     * que, sin esto, seguiría viva cuando Redis vuelva a fallar.
     */
    async delete(key) {
      await memory.delete(key);
      if (!redisIsReady()) return;
      try {
        await redis.delete(key);
      } catch {
        // Redis falló: su copia vence sola por su TTL.
      }
    },

    isSharedCacheReady: redisIsReady,

    async close() {
      await redis?.close();
    },
  };
}
