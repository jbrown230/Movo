// Middleware: exige un token de Google en el encabezado Authorization y deja en `request.userId`
// la identidad de la persona. Todo acceso a datos se filtra con ese id.

import { UnauthorizedError } from '../../application/errors.js';

const BEARER_TOKEN = /^Bearer\s+(\S{20,4096})$/;

/** @param {(accessToken: string) => Promise<string>} authenticateUser */
export function createRequireUser(authenticateUser) {
  return async function requireUser(request, response, next) {
    try {
      const match = BEARER_TOKEN.exec(request.headers.authorization || '');
      if (!match) throw new UnauthorizedError('Falta el token de Google.');
      request.userId = await authenticateUser(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
