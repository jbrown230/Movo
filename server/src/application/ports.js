// Puertos: lo que los casos de uso necesitan del mundo exterior.
//
// Los casos de uso no saben si el respaldo está en MongoDB o en memoria, ni si la caché es Redis.
// Solo conocen estas formas. Los adaptadores (carpeta adapters/) las implementan y las pruebas
// usan versiones simples en memoria.

/**
 * Dónde se guardan los datos de respaldo de cada persona.
 * TODA operación recibe `userId`: los datos de una persona nunca se mezclan con los de otra.
 *
 * @typedef {Object} BackupStore
 * @property {(userId: string, records: import('./../domain/backupRecord.js').BackupRecord[]) => Promise<number>} saveChanges
 *           Guarda los registros que sean más recientes que los existentes. Devuelve cuántos guardó.
 * @property {(userId: string, cursor: number, limit: number) => Promise<import('./../domain/backupRecord.js').StoredBackupRecord[]>} findChangesAfter
 *           Registros guardados después del cursor, del más antiguo al más reciente.
 * @property {(userId: string) => Promise<number>} deleteAll
 *           Borra todo lo de la persona. Devuelve cuántos registros eliminó.
 * @property {(userId: string) => Promise<BackupSummary>} summarize
 *           Cuántos registros guarda la persona de cada tipo, y cuándo cambió el último.
 * @property {() => Promise<boolean>} ping
 * @property {() => Promise<void>} close
 */

/**
 * Resumen del respaldo de una persona.
 *
 * @typedef {Object} BackupSummary
 * @property {Record<string, number>} activeByKind  Registros vigentes por tipo ('transaction', 'category_rule', …).
 * @property {number} deleted                      Registros marcados como eliminados (de cualquier tipo).
 * @property {number} lastUpdatedAt                Fecha (ms) del cambio más reciente, o 0 si no hay nada.
 */

/**
 * Memoria rápida con vencimiento. Guarda cosas que se pueden volver a calcular.
 *
 * @typedef {Object} Cache
 * @property {(key: string) => Promise<string|null>} get
 * @property {(key: string, value: string, ttlSeconds: number) => Promise<void>} set
 * @property {(key: string, windowSeconds: number) => Promise<number>} countInSlidingWindow
 *           Anota una solicitud ahora y devuelve cuántas hubo en los últimos `windowSeconds` (incluida esta).
 *           Sirve para límites por minuto.
 * @property {(key: string) => Promise<Record<string, string>|null>} getHash  Campos guardados, o null si no hay.
 * @property {(key: string, fields: Record<string, string|number>, ttlSeconds: number) => Promise<void>} setHash
 *           Reemplaza todos los campos de la clave.
 * @property {(key: string) => Promise<void>} delete  Borra la clave ya (invalidación explícita).
 * @property {() => boolean} isSharedCacheReady  true si la caché compartida (Redis) responde.
 * @property {() => Promise<void>} close
 */

/**
 * Comprueba un token de acceso de Google.
 *
 * @typedef {Object} VerifiedToken
 * @property {string} userId              Id de la cuenta de Google.
 * @property {string|undefined} audience  Aplicación para la que se emitió el token.
 * @property {string|undefined} authorizedParty
 * @property {number} expiresInSeconds
 *
 * @typedef {Object} TokenVerifier
 * @property {(token: string) => Promise<VerifiedToken|null>} verifyAccessToken
 *           null si el token no es válido. Lanza un error si no se pudo consultar a Google.
 */

/**
 * Fuente del tipo de cambio del dólar y del euro.
 *
 * @typedef {Object} ExchangeRate
 * @property {number} rate              Colones por dólar.
 * @property {string|null} date
 * @property {string} source            Texto que se le muestra a la persona.
 * @property {{ rate: number, date: string }|null} euro  Colones por euro, o null si no se conoce.
 * @property {{ rate: number, date: string, source?: string }|null} nio  Colones por córdoba nicaragüense y de dónde sale
 *           el valor, o null si no se conoce.
 * @property {Array<{ date: string, usd: number, eur: number|null, nio?: number }>} history
 *           Colones por dólar y por euro de cada día reciente, del más viejo al más nuevo. Vacío si no hay fuente.
 *
 * @typedef {Object} ExchangeRateSource
 * @property {() => Promise<ExchangeRate>} fetchLatestRate
 */

export {};
