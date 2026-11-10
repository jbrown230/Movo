// Calificación de un extractor (el lector por reglas o un modelo de lenguaje) contra el conjunto de
// evaluación de tests/fixtures/parserEvalSet.js. Módulo puro: no llama a nada de afuera.
import { parseMail } from '../../web/src/domain/emailParser/parseMail.js';
import { displayName, normalizeKey } from '../../web/src/domain/names.js';

export const FIELDS = ['monto', 'dirección', 'tipo', 'fecha', 'contraparte', 'negada'];

/** Lo que lee el lector por reglas de la app, en la misma forma que las etiquetas. */
export function parserExtract(mail) {
  const result = parseMail(mail);
  if (!result.ok) return [];
  return result.items.map((item) => ({
    type: item.type,
    direction: item.direction,
    currency: item.currency,
    amount: item.amountCents / 100,
    counterparty: item.counterparty,
    date: item.date,
    declined: item.declined,
  }));
}

/** Comercios y personas se comparan como los muestra la app: sin código de país ni números largos. */
const sameName = (expected, actual) => normalizeKey(displayName(expected)) === normalizeKey(displayName(actual));
/** Las fechas se comparan al minuto: algunos correos traen segundos y otros no. */
const sameMinute = (expected, actual) => {
  const time = new Date(actual).getTime();
  return Number.isFinite(time) && Math.floor(time / 60e3) === Math.floor(new Date(expected).getTime() / 60e3);
};

/** Qué campos de un movimiento quedaron bien. Contraparte null en la etiqueta = no se califica. */
export function compareMovement(expected, actual) {
  const checks = {
    monto:
      actual.currency === expected.currency && Math.round(actual.amount * 100) === Math.round(expected.amount * 100),
    dirección: actual.direction === expected.direction,
    tipo: actual.type === expected.type,
    fecha: sameMinute(expected.date, actual.date),
    negada: Boolean(actual.declined) === expected.declined,
  };
  if (expected.counterparty !== null) checks.contraparte = sameName(expected.counterparty, actual.counterparty ?? '');
  return checks;
}

const byTimeAndAmount = (first, second) =>
  new Date(first.date).getTime() - new Date(second.date).getTime() || first.amount - second.amount;

/**
 * Califica un correo. Los movimientos se emparejan en orden de fecha y monto.
 * @returns {{correct: boolean, countOk: boolean, fields: Record<string, boolean>[]}}
 */
export function gradeMail(expected, predicted) {
  const countOk = expected.length === predicted.length;
  const sortedExpected = [...expected].sort(byTimeAndAmount);
  const sortedPredicted = [...predicted].sort(byTimeAndAmount);
  const fields = sortedExpected.map((movement, index) =>
    sortedPredicted[index]
      ? compareMovement(movement, sortedPredicted[index])
      : Object.fromEntries(FIELDS.map((field) => [field, false])),
  );
  const correct = countOk && fields.every((checks) => Object.values(checks).every(Boolean));
  return { correct, countOk, fields };
}

function addFieldTotals(fieldTotals, fields) {
  for (const checks of fields) {
    for (const [field, ok] of Object.entries(checks)) {
      fieldTotals[field].total++;
      if (ok) fieldTotals[field].ok++;
    }
  }
}

/**
 * Resumen de un extractor sobre todo el conjunto.
 * @param {Array<{id: string, group: string, expected: Object[]}>} evalSet
 * @param {Map<string, Object[]|null>} predictions  Por id de caso; null = el extractor falló (error de red, respuesta inválida).
 */
export function summarize(evalSet, predictions) {
  const groups = {};
  const fieldTotals = Object.fromEntries(FIELDS.map((field) => [field, { ok: 0, total: 0 }]));
  const failures = [];
  const counts = {
    correct: 0,
    falseMovements: 0, // movimientos inventados en correos que no traen ninguno
    missedMovements: 0, // correos con movimiento donde el extractor no devolvió nada
    silentErrors: 0, // devolvió movimientos, pero con algo mal: el peor caso, porque nadie se entera
  };

  for (const testCase of evalSet) {
    const predicted = predictions.get(testCase.id) ?? [];
    const grade = gradeMail(testCase.expected, predicted);
    const stats = (groups[testCase.group] ??= { correct: 0, total: 0 });
    stats.total++;
    stats.correct += grade.correct;
    counts.correct += grade.correct;
    if (!grade.correct) failures.push({ id: testCase.id, expected: testCase.expected, predicted });
    counts.falseMovements += !testCase.expected.length && predicted.length > 0;
    counts.missedMovements += testCase.expected.length > 0 && !predicted.length;
    counts.silentErrors += predicted.length > 0 && !grade.correct;
    addFieldTotals(fieldTotals, grade.fields);
  }
  return { ...counts, total: evalSet.length, groups, fieldTotals, failures };
}
