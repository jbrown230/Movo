// Qué tipo de cambio le toca a cada movimiento: el del día en que se hizo la compra, tomado del
// historial que manda el servidor (`history` de /api/fx). Si ese día no está, el más reciente.

import { Currency } from '../domain/types.js';

const COSTA_RICA_OFFSET_MS = 6 * 60 * 60 * 1000; // los bancos y el BCCR usan hora de Costa Rica (UTC−6)
const HISTORY_FIELD = Object.freeze({ [Currency.USD]: 'usd', [Currency.EUR]: 'eur', [Currency.NIO]: 'nio' });

/** Día en Costa Rica ("2026-01-15") de un instante ISO, o null si la fecha no es válida. */
function costaRicaDay(dateIso) {
  const millis = Date.parse(dateIso);
  return Number.isNaN(millis) ? null : new Date(millis - COSTA_RICA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Colones por unidad de esa moneda el día del movimiento, o null si el historial no llega hasta ese día.
 * Un día posterior al último publicado usa el último: se corrige cuando llegue el de ese día.
 *
 * @param {{ history?: Array<{ date: string, usd: number, eur: number|null, nio?: number }> }|null} info  Lo que respondió /api/fx.
 */
export function rateOfTheDay(info, currency, dateIso) {
  const history = info?.history ?? [];
  const day = costaRicaDay(dateIso);
  if (!history.length || !day || day < history[0].date) return null;

  let entry = null;
  for (const candidate of history) {
    if (candidate.date > day) break;
    entry = candidate;
  }
  return entry?.[HISTORY_FIELD[currency]] || null;
}

/** Colones por unidad de esa moneda según el tipo de cambio más reciente, o null. */
export function latestRate(info, currency) {
  if (currency === Currency.EUR) return info?.euro?.rate || null;
  if (currency === Currency.NIO) return info?.nio?.rate || null;
  return info?.rate || null;
}

/** Colones por dólar, euro y córdoba para un movimiento de esa fecha: los de su día o, si no se conocen, los más recientes. */
export function exchangeRatesOn(info, dateIso) {
  const rateFor = (currency) => rateOfTheDay(info, currency, dateIso) ?? latestRate(info, currency);
  return {
    [Currency.USD]: rateFor(Currency.USD),
    [Currency.EUR]: rateFor(Currency.EUR),
    [Currency.NIO]: rateFor(Currency.NIO),
  };
}
