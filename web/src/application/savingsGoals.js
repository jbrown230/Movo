// Casos de uso: metas de ahorro. Crear, cambiar y borrar metas, y ver cómo va cada una.

import { newId } from '../domain/ids.js';
import { dayRange, toDayString } from '../domain/period.js';
import { firstDayOfMonth, goalProblem, goalProgress, goalSavingsDays } from '../domain/savingsGoals.js';

/** Se lanza cuando lo que escribió la persona no sirve para una meta. El mensaje se puede mostrar tal cual. */
export class InvalidGoalError extends Error {}

export function createSavingsGoals({ savingsGoals, transactions }) {
  /** Ingresos menos gastos en los días que cuentan para la meta. */
  function savedFor(goal, today) {
    const { fromDay, toDay } = goalSavingsDays(goal, today);
    return transactions.netSavings(dayRange(fromDay, toDay));
  }

  const withProgress = (goal, today) => ({
    ...goal,
    ...goalProgress({ goal, savedCents: savedFor(goal, today), today }),
  });

  function cleanDraft(draft, today) {
    const problem = goalProblem(draft, today);
    if (problem) throw new InvalidGoalError(problem);
    return { name: draft.name.trim(), targetCents: draft.targetCents, targetDay: draft.targetDay };
  }

  return {
    /** Las metas activas, cada una con su avance (ver goalProgress en domain/savingsGoals.js). */
    list(now = new Date()) {
      const today = toDayString(now);
      return savingsGoals.list().map((goal) => withProgress(goal, today));
    },

    /**
     * Crea una meta. Cuenta lo ahorrado desde el primer día de este mes.
     * @param {{ name: string, targetCents: number, targetDay: string }} draft
     * @throws {InvalidGoalError}
     */
    create(draft, now = new Date()) {
      const today = toDayString(now);
      const goal = { id: 'g' + newId(), ...cleanDraft(draft, today), startDay: firstDayOfMonth(today) };
      savingsGoals.save(goal);
      return withProgress(savingsGoals.get(goal.id), today);
    },

    /**
     * Cambia el nombre, el monto o la fecha de una meta. Lo ahorrado se sigue contando desde su inicio.
     * @throws {InvalidGoalError}
     */
    update(id, draft, now = new Date()) {
      const current = savingsGoals.get(id);
      if (!current) return null;
      const today = toDayString(now);
      savingsGoals.save({ ...current, ...cleanDraft(draft, today) });
      return withProgress(savingsGoals.get(id), today);
    },

    remove: (id) => savingsGoals.remove(id),
  };
}
