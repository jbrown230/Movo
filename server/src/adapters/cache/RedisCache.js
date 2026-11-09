// Caché compartida en Redis. Sus operaciones lanzan error si Redis no responde:
// quien la use debe tener un plan B (ver ResilientCache).
//
// Usa tres estructuras de Redis:
//   - string con vencimiento: el tipo de cambio (`fx:…`) y los tokens ya validados (`tok:…`);
//   - sorted set: las solicitudes de cada persona en el último minuto (`rl:…`), para el límite por minuto;
//   - hash: el resumen del respaldo de cada persona (`bk:…`), un campo por tipo de registro.

import { createClient } from 'redis';

const MAX_RECONNECT_DELAY_MS = 5000;
const RECONNECT_STEP_MS = 500;

const wholeSeconds = (seconds) => Math.max(1, Math.ceil(seconds));

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
      await client.set(key, value, { EX: wholeSeconds(ttlSeconds) });
    },

    /**
     * Ventana deslizante con un sorted set: cada solicitud es un miembro cuyo puntaje es su hora.
     * Se borran las que salieron de la ventana, se agrega la nueva y se cuentan las que quedan,
     * todo en una sola transacción (MULTI) para que dos solicitudes a la vez no se pisen.
     */
    async countInSlidingWindow(key, windowSeconds) {
      const now = Date.now();
      const [, , count] = await client
        .multi()
        .zRemRangeByScore(key, 0, now - windowSeconds * 1000)
        .zAdd(key, { score: now, value: `${now}:${Math.random().toString(36).slice(2)}` }) // dos en el mismo ms no se pisan
        .zCard(key)
        .expire(key, wholeSeconds(windowSeconds)) // si la persona deja de pedir, la clave desaparece sola
        .exec();
      return Number(count);
    },

    async getHash(key) {
      const fields = await client.hGetAll(key);
      return Object.keys(fields).length ? { ...fields } : null; // el cliente lo devuelve sin prototipo
    },

    async setHash(key, fields, ttlSeconds) {
      await client.multi().del(key).hSet(key, fields).expire(key, wholeSeconds(ttlSeconds)).exec();
    },

    async delete(key) {
      await client.del(key);
    },

    async close() {
      await client.quit().catch(() => {});
    },
  };
}
