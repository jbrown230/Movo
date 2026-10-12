// Caso de uso: saber quién es la persona que hace la solicitud.
//
// No hay contraseñas ni sesiones propias: el teléfono envía su token de acceso de Google, el
// servidor lo valida UNA vez con Google y guarda el resultado en la caché hasta que el token venza.

import { createHash } from 'node:crypto';
import { ServiceUnavailableError, UnauthorizedError } from './errors.js';

const DEFAULT_TOKEN_LIFETIME_SECONDS = 300;
const MAX_TOKEN_CACHE_SECONDS = 3600;
const USER_RATE_LIMIT_MESSAGE = 'Demasiadas solicitudes. Intenta en un minuto.';

/**
 * @param {Object} dependencies
 * @param {import('./ports.js').Cache} dependencies.cache
 * @param {import('./ports.js').TokenVerifier} dependencies.tokenVerifier
 * @param {ReturnType<import('./rateLimiter.js').createRateLimiter>} dependencies.ensureWithinLimit
 * @param {string} dependencies.expectedClientId  Id de cliente de Google de esta app ('' = no comprobar).
 * @param {number} dependencies.requestsPerMinute
 */
export function createAuthenticateUser({
  cache,
  tokenVerifier,
  ensureWithinLimit,
  expectedClientId,
  requestsPerMinute,
}) {
  // La caché guarda un resumen del token, nunca el token completo.
  const cacheKeyFor = (token) => 'tok:' + createHash('sha256').update(token).digest('hex');

  async function verifyWithGoogle(token) {
    let verified;
    try {
      verified = await tokenVerifier.verifyAccessToken(token);
    } catch {
      throw new ServiceUnavailableError('No se pudo validar con Google.');
    }
    if (!verified?.userId) throw new UnauthorizedError('Token inválido o vencido.');

    const isFromThisApp = verified.audience === expectedClientId || verified.authorizedParty === expectedClientId;
    if (expectedClientId && !isFromThisApp) throw new UnauthorizedError('El token es de otra aplicación.');
    return verified;
  }

  async function findUserId(token) {
    const cachedUserId = await cache.get(cacheKeyFor(token));
    if (cachedUserId) return cachedUserId;

    const verified = await verifyWithGoogle(token);
    const lifetime = Math.min(verified.expiresInSeconds || DEFAULT_TOKEN_LIFETIME_SECONDS, MAX_TOKEN_CACHE_SECONDS);
    await cache.set(cacheKeyFor(token), verified.userId, lifetime);
    return verified.userId;
  }

  /**
   * @param {string} accessToken  Token de acceso de Google.
   * @returns {Promise<string>}   Id de la persona. Todo acceso a datos se filtra con este id.
   */
  return async function authenticateUser(accessToken) {
    const userId = await findUserId(accessToken);
    await ensureWithinLimit({ who: userId, limitPerMinute: requestsPerMinute, message: USER_RATE_LIMIT_MESSAGE });
    return userId;
  };
}
