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
    incrementWindowCounter: (key, ttlSeconds) => withFallback('incrementWindowCounter', key, ttlSeconds),
    isSharedCacheReady: redisIsReady,

    async close() {
      await redis?.close();
    },
  };
}
