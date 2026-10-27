import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GoalStatus,
  firstDayOfMonth,
  goalProblem,
  goalProgress,
  goalSavingsDays,
  isValidDay,
  monthsBetween,
} from '../../web/src/domain/savingsGoals.js';

const colones = (amount) => amount * 100;
const goal = (overrides = {}) => ({
  id: 'g1',
  name: 'Viaje',
  targetCents: colones(300_000),
  targetDay: '2026-12-31',
  startDay: '2026-10-01',
  ...overrides,
});

test('metas: días válidos y primer día del mes', () => {
  assert.ok(isValidDay('2026-02-28'));
  assert.ok(!isValidDay('2026-02-30'), 'ese día no existe');
  assert.ok(!isValidDay('2026-2-3'));
  assert.ok(!isValidDay(null));
  assert.equal(firstDayOfMonth('2026-10-24'), '2026-10-01');
});

test('metas: meses que faltan, contando el actual y el de la fecha límite', () => {
  assert.equal(monthsBetween('2026-10-24', '2026-10-31'), 1);
  assert.equal(monthsBetween('2026-10-24', '2026-12-01'), 3);
  assert.equal(monthsBetween('2026-11-15', '2027-02-10'), 4, 'cruza el año');
  assert.equal(monthsBetween('2026-11-15', '2026-10-10'), 0);
});

test('metas: lo que escribió la persona se revisa', () => {
  const today = '2026-10-24';
  const valid = { name: 'Viaje', targetCents: colones(1000), targetDay: '2026-12-31' };
  assert.equal(goalProblem(valid, today), null);
  assert.equal(goalProblem({ ...valid, targetDay: today }, today), null, 'la fecha límite puede ser hoy');
  assert.match(goalProblem({ ...valid, name: '   ' }, today), /nombre/);
  assert.match(goalProblem({ ...valid, name: 'x'.repeat(61) }, today), /hasta 60/);
  assert.match(goalProblem({ ...valid, targetCents: 0 }, today), /cuánto/);
  assert.match(goalProblem({ ...valid, targetCents: NaN }, today), /cuánto/);
  assert.match(goalProblem({ ...valid, targetDay: '' }, today), /fecha límite/);
  assert.match(goalProblem({ ...valid, targetDay: '2026-10-23' }, today), /no puede haber pasado/);
});

test('metas: lo ahorrado se cuenta desde el inicio de la meta y no pasa de la fecha límite', () => {
  assert.deepEqual(goalSavingsDays(goal(), '2026-11-05'), { fromDay: '2026-10-01', toDay: '2026-11-05' });
  assert.deepEqual(goalSavingsDays(goal(), '2027-01-15'), { fromDay: '2026-10-01', toDay: '2026-12-31' });
});

test('metas en curso: porcentaje y lo que hay que ahorrar cada mes', () => {
  const progress = goalProgress({ goal: goal(), savedCents: colones(100_000), today: '2026-10-24' });
  assert.equal(progress.status, GoalStatus.IN_PROGRESS);
  assert.equal(progress.percent, 33);
  assert.equal(progress.remainingCents, colones(200_000));
  assert.equal(progress.monthsLeft, 3, 'octubre, noviembre y diciembre');
  assert.equal(progress.neededPerMonthCents, 6_666_667, 'se redondea hacia arriba para llegar a tiempo');
});

test('metas: si se gastó más de lo que entró, el avance queda en cero', () => {
  const progress = goalProgress({ goal: goal(), savedCents: -colones(50_000), today: '2026-10-24' });
  assert.equal(progress.percent, 0);
  assert.equal(progress.savedCents, -colones(50_000), 'el neto real se conserva');
  assert.equal(progress.remainingCents, colones(300_000));
});

test('metas: lograda al llegar al monto, aunque se pase', () => {
  const progress = goalProgress({ goal: goal(), savedCents: colones(350_000), today: '2026-11-01' });
  assert.equal(progress.status, GoalStatus.REACHED);
  assert.equal(progress.percent, 100);
  assert.equal(progress.neededPerMonthCents, 0);
});

test('metas: vencida si pasó la fecha sin llegar', () => {
  const progress = goalProgress({ goal: goal(), savedCents: colones(200_000), today: '2027-01-02' });
  assert.equal(progress.status, GoalStatus.OVERDUE);
  assert.equal(progress.monthsLeft, 0);
  assert.equal(progress.remainingCents, colones(100_000));
  assert.equal(progress.neededPerMonthCents, 0);
});
