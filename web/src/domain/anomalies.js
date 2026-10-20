// Detección de cargos anómalos (prototipo, issue 31). Módulo puro: no toca la base ni la interfaz.
//
// Qué es una anomalía: un GASTO cuyo monto en colones queda muy por ENCIMA de lo que la persona
// suele pagar en ese comercio. Opcionalmente, si el comercio todavía no tiene historial suficiente,
// se compara con su categoría (apagado por defecto: en la medición da más falsos positivos que
// aciertos). Detalle, resultados y límites en docs/ANOMALIAS.md.
//
// Cómo se mide "muy por encima":
//   - Los montos se comparan en escala logarítmica: ₡3.000 → ₡9.000 pesa lo mismo que ₡30.000 → ₡90.000.
//   - Lo "normal" es la mediana del historial y la dispersión es la desviación absoluta mediana (MAD).
//     Las dos son robustas: un cargo raro en el historial casi no las mueve (una media y una desviación
//     estándar sí se moverían).
//   - Puntaje z robusto (Iglewicz y Hoaglin): 0,6745 · (log(monto) − mediana) / MAD.
//     Se marca si supera el umbral y además el exceso sobre lo típico es de al menos MIN_EXCESS_CENTS.
//   - Solo se mira el pasado: cada movimiento se compara con los anteriores, como pasaría en el teléfono.

import { Direction } from './types.js';
import { displayName, normalizeKey } from './names.js';

export const ANOMALY_DEFAULTS = Object.freeze({
  /** Puntaje z robusto a partir del cual un cargo es anómalo (3,5 es el valor que recomiendan Iglewicz y Hoaglin). */
  threshold: 3.5,
  /** Movimientos previos que necesita un comercio (o una categoría) para opinar. */
  minHistory: 5,
  /** Dispersión mínima en escala log (≈ 8 %): los cobros fijos, como una suscripción, tienen MAD 0. */
  minSpread: 0.08,
  /** Exceso mínimo sobre el monto típico, en céntimos (₡2.000): un café de ₡1.500 a ₡4.000 no es una alerta. */
  minExcessCents: 200_000,
  /** Comparar con la categoría cuando el comercio no tiene historial. Ver docs/ANOMALIAS.md. */
  categoryFallback: false,
});

/** Por qué se juzgó un movimiento. */
export const AnomalyBasis = Object.freeze({
  MERCHANT: 'comercio',
  CATEGORY: 'categoría',
  NONE: 'sin historial',
});

const MAD_TO_SIGMA = 0.6745;

/** Cada banco escribe el comercio a su modo (el BN le agrega "CRI"): se agrupa por el nombre limpio. */
const merchantKey = (counterparty) => normalizeKey(displayName(counterparty));

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 ? sortedValues[middle] : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

/**
 * Puntaje de un monto contra un historial de logaritmos de montos.
 *
 * @param {number} logAmount
 * @param {number[]} history     Logaritmos de los montos previos (cualquier orden).
 * @param {number} minSpread
 * @returns {{score: number, typicalLog: number}}
 */
export function robustScore(logAmount, history, minSpread = ANOMALY_DEFAULTS.minSpread) {
  const sorted = [...history].sort((first, second) => first - second);
  const typicalLog = median(sorted);
  const mad = median(sorted.map((value) => Math.abs(value - typicalLog)).sort((first, second) => first - second));
  const score = (MAD_TO_SIGMA * (logAmount - typicalLog)) / Math.max(mad, minSpread);
  return { score, typicalLog };
}

/**
 * Revisa los gastos en orden cronológico y marca los anómalos.
 * Los ingresos y los movimientos entre cuentas propias no se juzgan ni cuentan como historial.
 *
 * @param {Array<{id: string, date: string, crcCents: number, counterparty: string, category: string, direction: string}>} transactions
 * @param {Partial<typeof ANOMALY_DEFAULTS>} [options]
 * @returns {Array<{id: string, isAnomaly: boolean, basis: string, score: number|null, typicalCents: number|null, historySize: number}>}
 *          Un resultado por gasto, en orden cronológico.
 */
export function detectAnomalies(transactions, options = {}) {
  const { threshold, minHistory, minSpread, minExcessCents, categoryFallback } = { ...ANOMALY_DEFAULTS, ...options };
  const byMerchant = new Map();
  const byCategory = new Map();
  const historyOf = (map, key) => map.get(key) ?? map.set(key, []).get(key);

  const expenses = transactions
    .filter((transaction) => transaction.direction === Direction.EXPENSE && transaction.crcCents > 0)
    .sort((first, second) => first.date.localeCompare(second.date));

  return expenses.map((transaction) => {
    const merchantHistory = historyOf(byMerchant, merchantKey(transaction.counterparty));
    const categoryHistory = historyOf(byCategory, transaction.category);
    const logAmount = Math.log(transaction.crcCents);

    let basis = AnomalyBasis.NONE;
    let history = [];
    if (merchantHistory.length >= minHistory) [basis, history] = [AnomalyBasis.MERCHANT, merchantHistory];
    else if (categoryFallback && categoryHistory.length >= minHistory)
      [basis, history] = [AnomalyBasis.CATEGORY, categoryHistory];

    let result = { id: transaction.id, isAnomaly: false, basis, score: null, typicalCents: null, historySize: 0 };
    if (basis !== AnomalyBasis.NONE) {
      const { score, typicalLog } = robustScore(logAmount, history, minSpread);
      const typicalCents = Math.round(Math.exp(typicalLog));
      const isAnomaly = score > threshold && transaction.crcCents - typicalCents >= minExcessCents;
      result = { ...result, isAnomaly, score, typicalCents, historySize: history.length };
    }

    merchantHistory.push(logAmount);
    categoryHistory.push(logAmount);
    return result;
  });
}
