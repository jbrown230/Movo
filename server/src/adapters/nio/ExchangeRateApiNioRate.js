// Córdobas por dólar, tomados del servicio público de ExchangeRate-API (sin llave, una actualización al día).
// El BCCR no publica el córdoba y el Banco Central de Nicaragua no tiene una API pública estable, así que de
// aquí sale el valor del día. Es una referencia de mercado: ronda un 0,5 % por encima de la tasa oficial.
// Los términos del servicio piden mencionar la fuente: "Rates By Exchange Rate API" (exchangerate-api.com).

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const REQUEST_TIMEOUT_MS = 6000;

// Un valor fuera de este rango es una respuesta rota, no un córdoba: la tasa ronda 36-37 por dólar.
const MIN_PLAUSIBLE_NIO_PER_USD = 20;
const MAX_PLAUSIBLE_NIO_PER_USD = 100;

/**
 * @param {{ httpFetch?: typeof fetch }} [options]  `httpFetch` es solo para pruebas.
 * @returns {() => Promise<number>}  Pide los córdobas por dólar de hoy. Lanza un error si el servicio falla o
 *   responde algo que no sea un valor razonable.
 */
export function createExchangeRateApiNioRate({ httpFetch = fetch } = {}) {
  return async function fetchNioPerUsd() {
    const response = await httpFetch(RATES_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error('ExchangeRate-API ' + response.status);

    const body = await response.json();
    const rate = Number(body?.rates?.NIO);
    const isPlausible = rate > MIN_PLAUSIBLE_NIO_PER_USD && rate < MAX_PLAUSIBLE_NIO_PER_USD;
    if (body?.result !== 'success' || !isPlausible) {
      throw new Error('ExchangeRate-API respondió sin un valor válido del córdoba');
    }
    return rate;
  };
}
