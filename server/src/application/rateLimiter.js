// Límite de solicitudes por minuto. Cuenta en una ventana fija de un minuto.

import { TooManyRequestsError } from './errors.js';

const MS_PER_MINUTE = 60_000;
const COUNTER_LIFETIME_SECONDS = 70; // un poco más que el minuto, para que el contador no venza antes

/** @param {{ cache: import('./ports.js').Cache }} dependencies */
export function createRateLimiter({ cache }) {
  /**
   * Cuenta una solicitud y lanza TooManyRequestsError si `who` ya pasó el límite este minuto.
   *
   * @param {{ who: string, limitPerMinute: number, message: string }} options
   */
  return async function ensureWithinLimit({ who, limitPerMinute, message }) {
    const currentMinute = Math.floor(Date.now() / MS_PER_MINUTE);
    const requestsThisMinute = await cache.incrementWindowCounter(
      `rl:${who}:${currentMinute}`,
      COUNTER_LIFETIME_SECONDS,
    );
    if (requestsThisMinute > limitPerMinute) throw new TooManyRequestsError(message);
  };
}
