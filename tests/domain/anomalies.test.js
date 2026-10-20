import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnomalyBasis, detectAnomalies, robustScore } from '../../web/src/domain/anomalies.js';

const DAY = 86400e3;
let counter = 0;
const expense = (counterparty, colones, category = 'comida', direction = 'out') => ({
  id: `t${++counter}`,
  date: new Date(Date.UTC(2026, 9, 1) + counter * DAY).toISOString(),
  crcCents: Math.round(colones * 100),
  counterparty,
  category,
  direction,
});
const usual = (counterparty, amounts, category) => amounts.map((colones) => expense(counterparty, colones, category));
const lastResult = (transactions, options) => detectAnomalies(transactions, options).at(-1);

test('anomalías: un cargo muy por encima de lo usual en el comercio se marca', () => {
  const history = usual('SODA DONA ROSA', [4000, 4500, 3800, 4200, 4100]);
  const result = lastResult([...history, expense('SODA DONA ROSA', 25000)]);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.basis, AnomalyBasis.MERCHANT);
  assert.equal(result.typicalCents, 410000, 'la mediana del historial');
});

test('anomalías: un monto dentro de lo usual no se marca', () => {
  const history = usual('SODA DONA ROSA', [4000, 4500, 3800, 4200, 4100, 3900]);
  assert.equal(lastResult([...history, expense('SODA DONA ROSA', 4700)]).isAnomaly, false);
});

test('anomalías: los montos bajos nunca son anomalía (solo se vigilan los cobros de más)', () => {
  const history = usual('SUPER LA AMISTAD', [30000, 28000, 32000, 29000, 31000]);
  assert.equal(lastResult([...history, expense('SUPER LA AMISTAD', 500)]).isAnomaly, false);
});

test('anomalías: sin historial suficiente no hay veredicto', () => {
  const history = usual('PIZZA ROMA ESCAZU', [12000, 13000, 11000]);
  const result = lastResult([...history, expense('PIZZA ROMA ESCAZU', 90000)]);
  assert.equal(result.basis, AnomalyBasis.NONE);
  assert.equal(result.isAnomaly, false);
  assert.equal(result.score, null);
});

test('anomalías: un cobro fijo (MAD 0) no divide entre cero y tolera variaciones pequeñas', () => {
  const history = usual('NETFLIX.COM', [7200, 7200, 7200, 7200, 7200], 'ocio');
  assert.equal(lastResult([...history, expense('NETFLIX.COM', 7900, 'ocio')]).isAnomaly, false, '+10 %');
  assert.equal(lastResult([...history, expense('NETFLIX.COM', 14400, 'ocio')]).isAnomaly, true, 'cobro doble');
});

test('anomalías: un exceso pequeño en colones no es alerta aunque el puntaje sea alto', () => {
  const history = usual('CAFE CORDILLERA', [1500, 1500, 1500, 1500, 1500]);
  assert.equal(lastResult([...history, expense('CAFE CORDILLERA', 3000)]).isAnomaly, false, '+₡1.500');
  assert.equal(lastResult([...history, expense('CAFE CORDILLERA', 3000)], { minExcessCents: 0 }).isAnomaly, true);
});

test('anomalías: el mismo comercio escrito por bancos distintos comparte historial', () => {
  const history = [
    ...usual('UBER *TRIP', [3000, 3200, 3100]),
    ...usual('UBER *TRIP CRI', [3300, 2900, 3000]), // así lo escribe el BN
  ];
  const result = lastResult([...history, expense('Uber *Trip', 30000, 'transporte')]);
  assert.equal(result.basis, AnomalyBasis.MERCHANT);
  assert.equal(result.isAnomaly, true);
});

test('anomalías: la categoría solo se usa si se pide', () => {
  const history = [...usual('SODA DONA ROSA', [4000, 4500, 3800]), ...usual('CAFE CORDILLERA', [2800, 3000, 2600])];
  const newPlace = expense('RESTAURANTE NUEVO', 60000);
  assert.equal(lastResult([...history, newPlace]).basis, AnomalyBasis.NONE);
  const withCategory = lastResult([...history, newPlace], { categoryFallback: true });
  assert.equal(withCategory.basis, AnomalyBasis.CATEGORY);
  assert.equal(withCategory.isAnomaly, true);
});

test('anomalías: solo se juzgan gastos y se compara con el pasado, no con el futuro', () => {
  const transactions = [
    expense('SODA DONA ROSA', 25000), // primero: sin historial, aunque después haya muchos baratos
    ...usual('SODA DONA ROSA', [4000, 4500, 3800, 4200, 4100]),
    expense('MARIA EJEMPLO R', 500000, 'ingreso', 'in'),
    expense('MI OTRA CUENTA', 900000, 'propias', 'self'),
  ].reverse(); // el orden de entrada no importa: se ordena por fecha
  const results = detectAnomalies(transactions);
  assert.equal(results.length, 6, 'el ingreso y el movimiento entre cuentas propias no se juzgan');
  assert.equal(results[0].basis, AnomalyBasis.NONE);
  assert.equal(results[0].isAnomaly, false);
});

test('robustScore: un valor atípico en el historial casi no mueve lo típico', () => {
  const history = [100, 102, 98, 101, 99, 5000].map(Math.log);
  const { typicalLog } = robustScore(Math.log(100), history);
  assert.ok(Math.abs(Math.exp(typicalLog) - 100.5) < 1);
});
