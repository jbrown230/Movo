// Pruebas del conjunto de evaluación y de la calificación del issue 30. No llaman a ningún modelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARSER_EVAL_SET } from '../fixtures/parserEvalSet.js';
import { gradeMail, parserExtract, summarize } from '../../scripts/parser-vs-llm/grade.mjs';
import { toUtcIso } from '../../scripts/parser-vs-llm/llmExtractor.mjs';
import { costaRicaIso } from '../helpers/costaRica.js';

const TYPES = ['sinpe', 'tarjeta', 'transferencia'];
const DIRECTIONS = ['out', 'in', 'self'];
const CURRENCIES = ['CRC', 'USD', 'EUR'];

test('conjunto de evaluación: ids únicos y etiquetas bien formadas', () => {
  const ids = PARSER_EVAL_SET.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const { id, mail, expected } of PARSER_EVAL_SET) {
    assert.ok(mail.from && mail.subject && mail.body, id);
    for (const movement of expected) {
      assert.ok(TYPES.includes(movement.type), id);
      assert.ok(DIRECTIONS.includes(movement.direction), id);
      assert.ok(CURRENCIES.includes(movement.currency), id);
      assert.ok(movement.amount > 0, id);
      assert.ok(movement.counterparty === null || movement.counterparty.length > 0, id);
      assert.equal(new Date(movement.date).toISOString(), movement.date, id);
      assert.equal(typeof movement.declined, 'boolean', id);
    }
  }
});

test('conjunto de evaluación: el lector acierta todos los correos reales y de la demo', () => {
  // Si esto falla, cambió el lector o una etiqueta está mal: revisar antes de actualizar docs/PARSER_VS_LLM.md.
  const covered = PARSER_EVAL_SET.filter((testCase) => ['real', 'demo'].includes(testCase.group));
  const predictions = new Map(covered.map((testCase) => [testCase.id, parserExtract(testCase.mail)]));
  const summary = summarize(covered, predictions);
  assert.deepEqual(
    summary.failures.map((failure) => failure.id),
    [],
  );
});

const SUPER = {
  type: 'tarjeta',
  direction: 'out',
  currency: 'CRC',
  amount: 3500,
  counterparty: 'SUPERMERCADO DE PRUEBA SAN JOSE',
  date: costaRicaIso(2026, 10, 20, 14, 15),
  declined: false,
};

test('calificación: el comercio se compara como lo muestra la app y la fecha al minuto', () => {
  const predicted = {
    ...SUPER,
    counterparty: 'Supermercado de Prueba San Jose CRI',
    date: costaRicaIso(2026, 10, 20, 14, 15, 40),
  };
  assert.equal(gradeMail([SUPER], [predicted]).correct, true);
  assert.equal(gradeMail([SUPER], [{ ...predicted, counterparty: 'SUPERMERCADO DE PRUEBA' }]).correct, false);
  assert.equal(gradeMail([SUPER], [{ ...predicted, amount: 35 }]).correct, false);
});

test('calificación: contraparte null no se califica; un movimiento de más o de menos es error', () => {
  assert.equal(gradeMail([{ ...SUPER, counterparty: null }], [{ ...SUPER, counterparty: '' }]).correct, true);
  assert.equal(gradeMail([], [SUPER]).correct, false);
  assert.equal(gradeMail([SUPER], []).correct, false);
  assert.equal(gradeMail([], []).correct, true);
});

test('calificación: errores silenciosos, movimientos inventados y correos sin leer', () => {
  const evalSet = [
    { id: 'bien', group: 'g', expected: [SUPER] },
    { id: 'monto-mal', group: 'g', expected: [SUPER] },
    { id: 'publicidad', group: 'g', expected: [] },
    { id: 'sin-leer', group: 'g', expected: [SUPER] },
  ];
  const predictions = new Map([
    ['bien', [SUPER]],
    ['monto-mal', [{ ...SUPER, amount: 5 }]],
    ['publicidad', [SUPER]],
    ['sin-leer', null],
  ]);
  const summary = summarize(evalSet, predictions);
  assert.equal(summary.correct, 1);
  assert.equal(summary.silentErrors, 2, 'el monto mal y la publicidad leída como compra');
  assert.equal(summary.falseMovements, 1);
  assert.equal(summary.missedMovements, 1);
});

test('toUtcIso: la hora local de Costa Rica pasa a UTC; si trae zona, se respeta', () => {
  assert.equal(toUtcIso('2026-10-20T14:15:00'), costaRicaIso(2026, 10, 20, 14, 15));
  assert.equal(toUtcIso('2026-10-20T20:15:00Z'), costaRicaIso(2026, 10, 20, 14, 15));
  assert.equal(toUtcIso('no es fecha'), 'no es fecha');
});
