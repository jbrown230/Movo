// Tipo de cambio del dólar y del euro, tomado de la API del Sistema de Divulgación de Datos
// Económicos (SDDE) del Banco Central de Costa Rica (BCCR).
//
// El BCCR publica el dólar en colones (venta, indicador 318) y el euro en dólares (indicador 333).
// Los colones por euro salen de multiplicar los dos. Además del valor de hoy se devuelve el de cada
// día reciente, para convertir cada compra con el tipo de cambio del día en que se hizo.

import { parseSeries } from './parseBccrResponse.js';

const BCCR_URL = 'https://apim.bccr.fi.cr/SDDE/api/Bccr.GE.SDDE.Publico.Indicadores.API/indicadoresEconomicos';
const DOLLAR_SELLING_INDICATOR = '318'; // colones por dólar, venta (se publica todos los días)
const EURO_IN_DOLLARS_INDICATOR = '333'; // dólares por euro (no se publica los fines de semana)
const SOURCE_TEXT = 'BCCR, tipo de cambio de venta';
const REQUEST_TIMEOUT_MS = 6000;
const DAYS_OF_HISTORY = 60; // cubre los 45 días que revisa la primera lectura de Gmail
const EXTRA_DAYS = 7; // para tener un euro anterior al primer día aunque caiga en fin de semana
const MS_PER_DAY = 86_400_000;

const twoDigits = (number) => String(number).padStart(2, '0');
const formatYearMonthDay = (date) =>
  `${date.getFullYear()}/${twoDigits(date.getMonth() + 1)}/${twoDigits(date.getDate())}`;
const roundToCents = (value) => Math.round(value * 100) / 100;

/** Último valor de la serie publicado ese día o antes (las series vienen ordenadas por fecha). */
function valueOnOrBefore(series, date) {
  let found = null;
  for (const entry of series) {
    if (entry.date > date) break;
    found = entry.value;
  }
  return found;
}

/** Colones por dólar y por euro de cada día reciente con dólar publicado. */
function buildHistory(dollarSeries, euroInDollarsSeries) {
  return dollarSeries.slice(-DAYS_OF_HISTORY).map(({ date, value: dollar }) => {
    const euroInDollars = valueOnOrBefore(euroInDollarsSeries, date);
    return { date, usd: roundToCents(dollar), eur: euroInDollars ? roundToCents(dollar * euroInDollars) : null };
  });
}

/**
 * @param {Object} options
 * @param {string} options.token  Token generado en el sitio de Indicadores Económicos del BCCR (Mi Perfil).
 * @param {typeof fetch} [options.httpFetch]  Solo para pruebas.
 * @returns {import('../../application/ports.js').ExchangeRateSource}
 */
export function createBccrExchangeRateSource({ token, httpFetch = fetch }) {
  /** Valores publicados de un indicador en los últimos días. */
  async function fetchSeries(indicator) {
    const today = new Date();
    const startDate = new Date(today.getTime() - (DAYS_OF_HISTORY + EXTRA_DAYS) * MS_PER_DAY);

    const url = new URL(`${BCCR_URL}/${indicator}/series`);
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
    return parseSeries(await response.json());
  }

  return {
    async fetchLatestRate() {
      // Sin dólar no hay respuesta; sin euro, se responde solo el dólar.
      const [dollarSeries, euroInDollarsSeries] = await Promise.all([
        fetchSeries(DOLLAR_SELLING_INDICATOR),
        fetchSeries(EURO_IN_DOLLARS_INDICATOR).catch(() => []),
      ]);
      const history = buildHistory(dollarSeries, euroInDollarsSeries);
      const today = history.at(-1);
      return {
        rate: today.usd,
        date: today.date,
        source: SOURCE_TEXT,
        euro: today.eur ? { rate: today.eur, date: today.date } : null,
        history,
      };
    },
  };
}
