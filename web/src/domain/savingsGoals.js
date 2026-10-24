// Metas de ahorro: cuánto se lleva ahorrado y cuánto falta. Módulo puro.
//
// Lo ahorrado es lo que entró menos lo que se gastó (ingresos menos gastos; lo movido entre
// cuentas propias no cuenta), desde el primer día del mes en que se creó la meta hasta su fecha
// límite. Así, el mes en que se crea la meta ya cuenta completo.

export const MAX_GOAL_NAME_LENGTH = 60;

export const GoalStatus = Object.freeze({ IN_PROGRESS: 'en_curso', REACHED: 'lograda', OVERDUE: 'vencida' });

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {Object} SavingsGoal
 * @property {string} id
 * @property {string} name
 * @property {number} targetCents  Monto a ahorrar, en céntimos de colones.
 * @property {string} targetDay    Fecha límite "AAAA-MM-DD" (incluida).
 * @property {string} startDay     Primer día del mes en que se creó, "AAAA-MM-01".
 * @property {number} [updatedAt]
 * @property {boolean} [isDeleted]
 */

const parseDay = (day) => {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return { year, month, dayOfMonth };
};

/** ¿Es un día "AAAA-MM-DD" que existe en el calendario? */
export function isValidDay(day) {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) return false;
  const { year, month, dayOfMonth } = parseDay(day);
  const date = new Date(year, month - 1, dayOfMonth);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === dayOfMonth;
}

/** Primer día del mes de un día "AAAA-MM-DD". */
export const firstDayOfMonth = (day) => `${day.slice(0, 7)}-01`;

/** Cuántos meses van del mes de `fromDay` al de `toDay`, contando los dos (0 si `toDay` es de un mes anterior). */
export function monthsBetween(fromDay, toDay) {
  const from = parseDay(fromDay);
  const to = parseDay(toDay);
  return Math.max(0, (to.year - from.year) * 12 + (to.month - from.month) + 1);
}

/**
 * Revisa lo que escribió la persona. Devuelve el motivo si algo no sirve, o null si está bien.
 *
 * @param {{ name: string, targetCents: number, targetDay: string }} draft
 * @param {string} today  Día "AAAA-MM-DD" de hoy.
 */
export function goalProblem({ name, targetCents, targetDay }, today) {
  if (!name?.trim()) return 'Ponle un nombre a la meta.';
  if (name.trim().length > MAX_GOAL_NAME_LENGTH) return `El nombre puede tener hasta ${MAX_GOAL_NAME_LENGTH} letras.`;
  if (!Number.isInteger(targetCents) || targetCents <= 0) return 'Escribe cuánto quieres ahorrar.';
  if (!isValidDay(targetDay)) return 'Elige la fecha límite.';
  if (targetDay < today) return 'La fecha límite no puede haber pasado.';
  return null;
}

/**
 * Días que cuentan para lo ahorrado: desde el inicio de la meta hasta hoy, sin pasar de la fecha límite.
 *
 * @param {SavingsGoal} goal
 * @param {string} today
 * @returns {{ fromDay: string, toDay: string }}
 */
export const goalSavingsDays = (goal, today) => ({
  fromDay: goal.startDay,
  toDay: today < goal.targetDay ? today : goal.targetDay,
});

/**
 * Cómo va una meta.
 *
 * @param {{ goal: SavingsGoal, savedCents: number, today: string }} input
 *   `savedCents` es ingresos menos gastos en los días de `goalSavingsDays` (puede ser negativo).
 */
export function goalProgress({ goal, savedCents, today }) {
  const counted = Math.max(0, savedCents);
  const remainingCents = Math.max(0, goal.targetCents - counted);
  const percent = Math.min(100, Math.floor((counted * 100) / goal.targetCents));
  const monthsLeft = today > goal.targetDay ? 0 : monthsBetween(today, goal.targetDay);

  let status = GoalStatus.IN_PROGRESS;
  if (remainingCents === 0) status = GoalStatus.REACHED;
  else if (monthsLeft === 0) status = GoalStatus.OVERDUE;

  return {
    savedCents,
    remainingCents,
    percent,
    monthsLeft,
    /** Lo que habría que ahorrar cada mes, este incluido, para llegar a tiempo. */
    neededPerMonthCents: status === GoalStatus.IN_PROGRESS ? Math.ceil(remainingCents / monthsLeft) : 0,
    status,
  };
}
