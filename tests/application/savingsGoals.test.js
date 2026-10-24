import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, reopenDatabase } from '../helpers/createTestApp.js';
import { InvalidGoalError } from '../../web/src/application/savingsGoals.js';

const NOW = new Date(2026, 9, 24, 12); // 24 de octubre de 2026, hora del teléfono
const at = (year, month, day) => new Date(year, month - 1, day, 12).toISOString();
const draft = (overrides = {}) => ({ name: 'Viaje', targetCents: 30_000_000, targetDay: '2026-12-31', ...overrides });

const CATEGORY_BY_DIRECTION = { in: 'ingreso', out: 'otros', self: 'propias' };

/** Registra a mano un movimiento en colones. */
function move(services, { amount, direction, date }) {
  services.addManualTransaction({
    amountCents: amount * 100,
    counterparty: 'MOVIMIENTO DE PRUEBA',
    category: CATEGORY_BY_DIRECTION[direction],
    direction,
    date,
  });
}

test('una meta nueva cuenta ingresos menos gastos desde el primer día del mes', () => {
  const { services } = createTestApp();
  move(services, { amount: 200_000, direction: 'in', date: at(2026, 10, 2) });
  move(services, { amount: 80_000, direction: 'out', date: at(2026, 10, 10) });
  move(services, { amount: 50_000, direction: 'in', date: at(2026, 9, 30) }); // antes de la meta
  move(services, { amount: 9_999, direction: 'self', date: at(2026, 10, 5) }); // entre cuentas propias

  const goal = services.savingsGoals.create(draft(), NOW);
  assert.equal(goal.startDay, '2026-10-01');
  assert.equal(goal.savedCents, 12_000_000, '₡200 000 de ingreso menos ₡80 000 de gasto');
  assert.equal(goal.percent, 40);
  assert.equal(goal.monthsLeft, 3);
  assert.equal(goal.neededPerMonthCents, 6_000_000);
});

test('lo que pasa después de la fecha límite no cuenta para la meta', () => {
  const { services } = createTestApp();
  services.savingsGoals.create(draft({ targetDay: '2026-11-30' }), NOW);
  move(services, { amount: 100_000, direction: 'in', date: at(2026, 11, 15) });
  move(services, { amount: 500_000, direction: 'in', date: at(2026, 12, 1) });

  const [goal] = services.savingsGoals.list(new Date(2026, 11, 10));
  assert.equal(goal.savedCents, 10_000_000);
  assert.equal(goal.status, 'vencida');
});

test('cambiar una meta conserva su inicio; eliminarla la quita de la lista', () => {
  const { services } = createTestApp();
  const created = services.savingsGoals.create(draft(), NOW);

  const changes = draft({ name: 'Carro', targetCents: 50_000_000 });
  const updated = services.savingsGoals.update(created.id, changes, new Date(2026, 10, 3));
  assert.equal(updated.name, 'Carro');
  assert.equal(updated.targetCents, 50_000_000);
  assert.equal(updated.startDay, '2026-10-01', 'sigue contando desde octubre');

  services.savingsGoals.remove(created.id);
  assert.deepEqual(services.savingsGoals.list(NOW), []);
  assert.equal(services.savingsGoals.update(created.id, draft(), NOW), null);
});

test('una meta inválida no se guarda y explica por qué', () => {
  const { services } = createTestApp();
  assert.throws(() => services.savingsGoals.create(draft({ name: ' ' }), NOW), InvalidGoalError);
  assert.throws(() => services.savingsGoals.create(draft({ targetDay: '2026-10-01' }), NOW), /no puede haber pasado/);
  assert.deepEqual(services.savingsGoals.list(NOW), []);
});

test('las metas se ordenan por fecha límite, sobreviven a reabrir la app y quedan pendientes de respaldo', () => {
  const { db, services } = createTestApp();
  const before = services.backup.pendingCount();
  services.savingsGoals.create(draft({ name: 'Carro', targetDay: '2027-06-30' }), NOW);
  services.savingsGoals.create(draft({ name: ' Viaje ', targetDay: '2026-12-31' }), NOW);
  assert.equal(services.backup.pendingCount(), before + 2);

  const reopened = createTestApp({ database: reopenDatabase(db) });
  assert.deepEqual(
    reopened.services.savingsGoals.list(NOW).map((goal) => goal.name),
    ['Viaje', 'Carro'],
    'el nombre se guarda sin espacios de más',
  );
});
