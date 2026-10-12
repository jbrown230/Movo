// Lista de plantillas, una por formato de banco.
// Para agregar un banco: crea su archivo de plantilla, agrégalo aquí y escribe su prueba.

import { parseBcrSinpe } from './bcrSinpe.js';
import { parseBcrCard } from './bcrCard.js';
import { parseBacSynthetic, parseBnSynthetic } from './syntheticBanks.js';

/**
 * @typedef {Object} Template
 * @property {string} bank   Clave del banco (ver domain/banks.js).
 * @property {string} name   Nombre que se muestra como "lector" en la bandeja.
 * @property {(text: string) => Array|null} parse  Devuelve las transacciones o null si el texto no es de esta plantilla.
 */

/** @type {Template[]} */
export const TEMPLATES = [
  { bank: 'BCR', name: 'BCR SINPE', parse: parseBcrSinpe },
  { bank: 'BCR', name: 'BCR tarjeta', parse: parseBcrCard },
  { bank: 'BAC', name: 'BAC (demo)', parse: parseBacSynthetic },
  { bank: 'BN', name: 'BN (demo)', parse: parseBnSynthetic },
];
