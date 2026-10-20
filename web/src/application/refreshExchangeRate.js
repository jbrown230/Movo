// Caso de uso: traer el tipo de cambio del servidor y dejar cada movimiento en dólares o euros
// convertido con el tipo de cambio del día en que se hizo.

import { toColonesCents } from '../domain/money.js';
import { latestRate, rateOfTheDay } from './exchangeRates.js';
import { LocalStateKey } from './localStateKeys.js';

export function createRefreshExchangeRate({ backend, localState, transactions, atomically }) {
  /**
   * El tipo de cambio que le corresponde a un movimiento ya guardado, o null si se queda como está.
   * Si el historial llega hasta su día, el de ese día. Si no, solo se convierte el que no tenía tipo de cambio.
   */
  function rateFor(transaction, info) {
    const ofItsDay = rateOfTheDay(info, transaction.currency, transaction.date);
    if (ofItsDay) return ofItsDay;
    return transaction.exchangeRate ? null : latestRate(info, transaction.currency);
  }

  function applyRatesOfTheirDay(info) {
    const changes = transactions
      .listForeign()
      .map((transaction) => ({ transaction, rate: rateFor(transaction, info) }))
      .filter(({ transaction, rate }) => rate && rate !== transaction.exchangeRate);
    if (!changes.length) return;

    atomically(() => {
      for (const { transaction, rate } of changes) {
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
    applyRatesOfTheirDay(info);
    return true;
  };
}
