// La API HTTP (Express). Su único trabajo es traducir entre HTTP y los casos de uso:
// leer la petición, llamar al caso de uso y devolver la respuesta. No tiene reglas de negocio.

import express from 'express';
import { FeatureDisabledError } from '../../application/errors.js';
import { errorHandler } from './errorHandler.js';
import { parseSyncRequest } from './parseSyncRequest.js';
import { createRequireUser } from './requireUser.js';
import { toSyncResponse } from './toSyncResponse.js';

const MAX_BODY_SIZE = '1mb';
const EXCHANGE_RATE_REQUESTS_PER_MINUTE_PER_IP = 30;

/** Express 4 no captura los errores de funciones async: este envoltorio los manda al manejador de errores. */
const handle = (routeHandler) => (request, response, next) => routeHandler(request, response, next).catch(next);

/**
 * @param {Object} options
 * @param {ReturnType<import('../../application/createUseCases.js').createUseCases>} options.useCases
 * @param {string} [options.staticDirectory]  Carpeta con la app compilada, para servirla desde aquí (opcional).
 */
export function createHttpApp({ useCases, staticDirectory = '' }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  const requireUser = createRequireUser(useCases.authenticateUser);
  const requireBackupEnabled = (request, response, next) =>
    useCases.isBackupEnabled
      ? next()
      : next(new FeatureDisabledError('El respaldo no está habilitado en este servidor.'));

  app.get(
    '/api/health',
    handle(async (request, response) => response.json(await useCases.getHealth())),
  );

  app.get('/api/config', (request, response) => response.json(useCases.getPublicConfig()));

  app.get(
    '/api/fx',
    handle(async (request, response) => {
      await useCases.ensureWithinLimit({
        who: `ip:${request.ip}`,
        limitPerMinute: EXCHANGE_RATE_REQUESTS_PER_MINUTE_PER_IP,
        message: 'Demasiadas solicitudes.',
      });
      response.json(await useCases.getExchangeRate());
    }),
  );

  app.post(
    '/api/sync',
    requireBackupEnabled,
    requireUser,
    handle(async (request, response) => {
      const { cursor, records } = parseSyncRequest(request.body);
      const result = await useCases.syncBackup({ userId: request.userId, cursor, records });
      response.json(toSyncResponse(result));
    }),
  );

  app.delete(
    '/api/me',
    requireBackupEnabled,
    requireUser,
    handle(async (request, response) => {
      response.json({ deleted: await useCases.deleteUserBackup(request.userId) });
    }),
  );

  app.use('/api', (request, response) => response.status(404).json({ error: 'No encontrado.' }));

  if (staticDirectory) app.use(express.static(staticDirectory, { index: 'index.html' }));

  app.use(errorHandler);
  return app;
}
