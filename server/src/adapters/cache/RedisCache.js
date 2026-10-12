// Caché compartida en Redis. Sus operaciones lanzan error si Redis no responde:
// quien la use debe tener un plan B (ver ResilientCache).

import { createClient } from 'redis';

const MAX_RECONNECT_DELAY_MS = 5000;
const RECONNECT_STEP_MS = 500;

/** @param {string} url @param {{ warn?: Function }} [log] */
export function createRedisCache(url, log = console) {
  const client = createClient({
    url,
    socket: { reconnectStrategy: (attempt) => Math.min(attempt * RECONNECT_STEP_MS, MAX_RECONNECT_DELAY_MS) },
  });
  client.on('error', (error) => log.warn?.('[redis]', error.message));
  client.connect().catch((error) => log.warn?.('[redis] sin conexión:', error.message));

  return {
    isReady: () => client.isReady,
    get: (key) => client.get(key),

    async set(key, value, ttlSeconds) {
      await client.set(key, value, { EX: Math.max(1, Math.floor(ttlSeconds)) });
    },

    async incrementWindowCounter(key, ttlSeconds) {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, ttlSeconds); // el contador vence solo
      return count;
    },

    async close() {
      await client.quit().catch(() => {});
    },
  };
}
