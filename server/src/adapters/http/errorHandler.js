// Traduce los errores de la aplicación a respuestas HTTP.

import {
  FeatureDisabledError,
  InvalidRequestError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../application/errors.js';

const STATUS_BY_ERROR_TYPE = [
  [InvalidRequestError, 400],
  [UnauthorizedError, 401],
  [FeatureDisabledError, 404],
  [TooManyRequestsError, 429],
  [ServiceUnavailableError, 503],
];

const INTERNAL_ERROR = 500;

function statusOf(error) {
  const known = STATUS_BY_ERROR_TYPE.find(([ErrorType]) => error instanceof ErrorType);
  if (known) return known[1];
  // Errores de la lectura del cuerpo (JSON mal formado, cuerpo demasiado grande) ya traen su código 4xx.
  const isClientError = Number.isInteger(error.status) && error.status >= 400 && error.status < INTERNAL_ERROR;
  return isClientError ? error.status : INTERNAL_ERROR;
}

/** Último eslabón de Express. Los errores inesperados no muestran detalles a quien consulta. */
// Express reconoce un manejador de errores por tener exactamente 4 parámetros.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, request, response, next) {
  const status = statusOf(error);
  if (status === INTERNAL_ERROR) console.error(error);
  response.status(status).json({ error: status === INTERNAL_ERROR ? 'Error interno.' : error.message });
}
