// Puertos: lo que la capa de aplicación necesita del mundo exterior.
//
// La aplicación no sabe si el correo viene de Gmail o de otro lado, ni si el
// servidor es Express. Solo conoce estas formas. La infraestructura las implementa
// (ver infrastructure/gmail y infrastructure/backend) y las pruebas las simulan.

/**
 * Lector de correos.
 * @typedef {Object} MailSource
 * @property {(options: {token: string, query: string, since: number|null, isKnown: (id: string) => boolean}) => Promise<string[]>} listNewMailIds
 *           Ids de los correos que coinciden con la búsqueda y que todavía no se han leído.
 * @property {(options: {token: string, id: string}) => Promise<import('../domain/types.js').IncomingMail>} fetchMail
 *           Descarga un correo y lo entrega listo para leer. Lanza un error con `auth: true` si el token venció.
 */

/**
 * Servidor de Movo (API propia).
 * @typedef {Object} BackendApi
 * @property {() => Promise<{rate?: number, source?: string, date?: string}>} getExchangeRate
 * @property {(options: {token: string, since: number, changes: object}) => Promise<{cursor: number, more: boolean, changes: object}>} syncBackup
 * @property {(options: {token: string}) => Promise<void>} deleteMyData
 */

export {};
