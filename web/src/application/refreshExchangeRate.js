// Caso de uso: traer el tipo de cambio del servidor y corregir movimientos en dólares sin convertir.

import { toColonesCents } from '../domain/money.js';
import { LocalStateKey } from './localStateKeys.js';

export function createRefreshExchangeRate({ backend, localState, transactions, atomically }) {
  /** Corrige movimientos en USD que se guardaron cuando todavía no había tipo de cambio. */
  function backfillMissingRates(rate) {
    const pending = transactions.listUsdWithoutRate();
    if (!pending.length) return;
    atomically(() => {
      for (const transaction of pending) {
        transactions.update(transaction.id, {
          exchangeRate: rate,
          crcCents: toColonesCents(transaction.amountCents, transaction.currency, rate),
        });
      }
    });
  }

  /**
   * @returns {Promise<boolean>} true si se obtuvo un tipo de cambio nuevo.
   * Lanza un error si el servidor no responde (la app sigue con el último conocido).
   */
  return async function refreshExchangeRate() {
    const info = await backend.getExchangeRate();
    if (!info.rate) return false;
    localState.set(LocalStateKey.EXCHANGE_RATE_INFO, info);
    backfillMissingRates(info.rate);
    return true;
  };
}
