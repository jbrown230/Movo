// Límite de solicitudes por minuto, con ventana deslizante: cuenta las solicitudes de los últimos
// 60 segundos, no las del minuto del reloj. Con una ventana fija, alguien podía hacer el doble del
// límite en dos segundos (al final de un minuto y al empezar el siguiente).

import { TooManyRequestsError } from './errors.js';

const WINDOW_SECONDS = 60;

/** @param {{ cache: import('./ports.js').Cache }} dependencies */
export function createRateLimiter({ cache }) {
  /**
   * Cuenta una solicitud y lanza TooManyRequestsError si `who` ya pasó el límite en el último minuto.
   *
   * @param {{ who: string, limitPerMinute: number, message: string }} options
   */
  return async function ensureWithinLimit({ who, limitPerMinute, message }) {
    const requestsLastMinute = await cache.countInSlidingWindow(`rl:${who}`, WINDOW_SECONDS);
    if (requestsLastMinute > limitPerMinute) throw new TooManyRequestsError(message);
  };
}
