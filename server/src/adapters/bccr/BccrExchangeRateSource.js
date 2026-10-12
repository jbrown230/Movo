// Tipo de cambio de venta del dólar, tomado del servicio web del Banco Central de Costa Rica (BCCR).

import { parseLatestRate } from './parseBccrResponse.js';

const BCCR_URL =
  'https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML';
const SELLING_RATE_INDICATOR = '318';
const REQUEST_TIMEOUT_MS = 6000;
const DAYS_OF_HISTORY = 7; // se piden varios días para encontrar el último valor publicado
const MS_PER_DAY = 86_400_000;

const twoDigits = (number) => String(number).padStart(2, '0');
const formatDayMonthYear = (date) =>
  `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;

/**
 * @param {{ email: string, token: string }} credentials  Datos de la suscripción al servicio del BCCR.
 * @returns {import('../../application/ports.js').ExchangeRateSource}
 */
export function createBccrExchangeRateSource({ email, token }) {
  return {
    async fetchLatestRate() {
      const today = new Date();
      const startDate = new Date(Date.now() - DAYS_OF_HISTORY * MS_PER_DAY);

      const url = new URL(BCCR_URL);
      url.search = new URLSearchParams({
        Indicador: SELLING_RATE_INDICATOR,
        FechaInicio: formatDayMonthYear(startDate),
        FechaFinal: formatDayMonthYear(today),
        Nombre: 'Movo',
        SubNiveles: 'N',
        CorreoElectronico: email,
        Token: token,
      });

      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error('BCCR ' + response.status);
      return parseLatestRate(await response.text());
    },
  };
}
