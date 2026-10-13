// Tipo de cambio de venta del dólar, tomado de la API del Sistema de Divulgación de Datos
// Económicos (SDDE) del Banco Central de Costa Rica (BCCR).

import { parseLatestRate } from './parseBccrResponse.js';

const BCCR_URL = 'https://apim.bccr.fi.cr/SDDE/api/Bccr.GE.SDDE.Publico.Indicadores.API/indicadoresEconomicos';
const SELLING_RATE_INDICATOR = '318';
const REQUEST_TIMEOUT_MS = 6000;
const DAYS_OF_HISTORY = 7; // se piden varios días para encontrar el último valor publicado
const MS_PER_DAY = 86_400_000;

const twoDigits = (number) => String(number).padStart(2, '0');
const formatYearMonthDay = (date) =>
  `${date.getFullYear()}/${twoDigits(date.getMonth() + 1)}/${twoDigits(date.getDate())}`;

/**
 * @param {Object} options
 * @param {string} options.token  Token generado en el sitio de Indicadores Económicos del BCCR (Mi Perfil).
 * @param {typeof fetch} [options.httpFetch]  Solo para pruebas.
 * @returns {import('../../application/ports.js').ExchangeRateSource}
 */
export function createBccrExchangeRateSource({ token, httpFetch = fetch }) {
  return {
    async fetchLatestRate() {
      const today = new Date();
      const startDate = new Date(today.getTime() - DAYS_OF_HISTORY * MS_PER_DAY);

      const url = new URL(`${BCCR_URL}/${SELLING_RATE_INDICATOR}/series`);
      url.search = new URLSearchParams({
        fechaInicio: formatYearMonthDay(startDate),
        fechaFin: formatYearMonthDay(today),
        idioma: 'ES',
      });

      const response = await httpFetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error('BCCR ' + response.status);
      }
      return parseLatestRate(await response.json());
    },
  };
}
