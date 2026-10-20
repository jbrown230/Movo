// Caso de uso: tipo de cambio del dólar (y del euro, si la fuente lo da).
//
// Se consulta a la fuente (el BCCR) como máximo cada 6 horas y se guarda en la caché. Si la fuente
// no está configurada o falla, se usa el último valor conocido y, si no hay, un valor de referencia.

const FRESH_RATE_SECONDS = 6 * 60 * 60; // cuánto dura un valor recién obtenido
const FALLBACK_RATE_SECONDS = 30 * 60; // cuánto dura el valor de reserva (para reintentar pronto)
const LAST_KNOWN_RATE_SECONDS = 30 * 24 * 60 * 60; // cuánto se recuerda el último valor bueno

const CURRENT_RATE_KEY = 'fx:usd';
const LAST_KNOWN_RATE_KEY = 'fx:usd:last';
const FALLBACK_SOURCE_TEXT = 'valor de referencia del servidor';

/**
 * @param {Object} dependencies
 * @param {import('./ports.js').Cache} dependencies.cache
 * @param {import('./ports.js').ExchangeRateSource|null} dependencies.exchangeRateSource  null si no está configurada.
 * @param {number} dependencies.fallbackRate  Colones por dólar cuando no hay otro dato.
 * @param {{ warn?: (...args: unknown[]) => void }} [dependencies.log]
 */
export function createGetExchangeRate({ cache, exchangeRateSource, fallbackRate, log = {} }) {
  async function tryFetchFromSource() {
    if (!exchangeRateSource) return null;
    try {
      return await exchangeRateSource.fetchLatestRate();
    } catch (error) {
      log.warn?.('[tipo de cambio]', error.message);
      return null;
    }
  }

  async function lastKnownOrFallback() {
    const lastKnown = await cache.get(LAST_KNOWN_RATE_KEY);
    return lastKnown
      ? JSON.parse(lastKnown)
      : { rate: fallbackRate, date: null, source: FALLBACK_SOURCE_TEXT, euro: null, history: [] };
  }

  /** @returns {Promise<import('./ports.js').ExchangeRate>} */
  return async function getExchangeRate() {
    const cached = await cache.get(CURRENT_RATE_KEY);
    if (cached) return JSON.parse(cached);

    const fetched = await tryFetchFromSource();
    if (!fetched) {
      const reserve = await lastKnownOrFallback();
      await cache.set(CURRENT_RATE_KEY, JSON.stringify(reserve), FALLBACK_RATE_SECONDS);
      return reserve;
    }

    await cache.set(CURRENT_RATE_KEY, JSON.stringify(fetched), FRESH_RATE_SECONDS);
    await cache.set(LAST_KNOWN_RATE_KEY, JSON.stringify(fetched), LAST_KNOWN_RATE_SECONDS);
    return fetched;
  };
}
