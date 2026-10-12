// Errores que los casos de uso pueden lanzar. La capa HTTP decide qué código de respuesta le toca a cada uno
// (ver adapters/http/errorHandler.js). Así los casos de uso no saben nada de HTTP.

/** Lo que llegó está mal formado (cuerpo, ids, listas). */
export class InvalidRequestError extends Error {}

/** Falta la identidad de la persona, o el token no sirve. */
export class UnauthorizedError extends Error {}

/** La persona o la dirección IP hizo demasiadas solicitudes en poco tiempo. */
export class TooManyRequestsError extends Error {}

/** Un servicio externo (Google, MongoDB) no respondió. Se puede reintentar más tarde. */
export class ServiceUnavailableError extends Error {}

/** La función está apagada en este servidor (por ejemplo, el respaldo en la nube). */
export class FeatureDisabledError extends Error {}
