// Crear, cambiar o borrar una meta de ahorro.

import { useState } from 'react';
import { AmountInput, Field } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { textToCents } from '../../domain/money.js';
import { toDayString } from '../../domain/period.js';
import { MAX_GOAL_NAME_LENGTH, goalProblem } from '../../domain/savingsGoals.js';
import { formatColonesShort } from '../format/money.js';
import { goalDayLabel } from '../format/dates.js';
import { useConfirm } from './ConfirmModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const draftOf = (goal) => ({
  name: goal?.name ?? '',
  amountText: goal ? String(Math.round(goal.targetCents / 100)) : '',
  targetDay: goal?.targetDay ?? '',
});

const isBlank = (draft) => !draft.name.trim() && !draft.amountText && !draft.targetDay;

/** Monto, nombre y fecha límite de la meta. */
function GoalFields({ draft, setField, today }) {
  return (
    <>
      <AmountInput
        value={draft.amountText}
        onChange={setField('amountText')}
        hint="Lo ahorrado es lo que entra menos lo que gastas, desde el mes en que creas la meta."
      />
      <Field htmlFor="goalName" label="¿Para qué ahorras?">
        <input
          id="goalName"
          value={draft.name}
          onChange={(event) => setField('name')(event.target.value)}
          maxLength={MAX_GOAL_NAME_LENGTH}
          placeholder="Ej.: Viaje a Guanacaste"
          autoComplete="off"
        />
      </Field>
      <Field htmlFor="goalDay" label="¿Para cuándo?">
        <input
          id="goalDay"
          type="date"
          min={today}
          value={draft.targetDay}
          onChange={(event) => setField('targetDay')(event.target.value)}
        />
      </Field>
    </>
  );
}

/**
 * @param {{ goal?: import('../../domain/savingsGoals.js').SavingsGoal, prefill?: ReturnType<typeof draftOf> }} props
 *   Sin `goal`, crea una meta nueva. `prefill` conserva lo escrito al cancelar una confirmación.
 */
export function SavingsGoalModal({ goal = null, prefill = null }) {
  const { services, refresh } = useSession();
  const { openModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const [draft, setDraft] = useState(prefill ?? draftOf(goal));

  const today = toDayString(new Date());
  const goalDraft = { name: draft.name, targetCents: textToCents(draft.amountText), targetDay: draft.targetDay };
  const problem = goalProblem(goalDraft, today);
  const setField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));
  const reopen = () => openModal(<SavingsGoalModal goal={goal} prefill={draft} />);

  const askToSave = () =>
    confirm({
      title: goal ? 'Cambiar la meta' : 'Crear la meta',
      text: `"${draft.name.trim()}": ahorrar ${formatColonesShort(goalDraft.targetCents)} para el ${goalDayLabel(draft.targetDay)}.`,
      confirmLabel: goal ? 'Guardar cambios' : 'Crear meta',
      danger: false,
      onCancel: reopen,
      onConfirm: () => {
        if (goal) services.savingsGoals.update(goal.id, goalDraft);
        else services.savingsGoals.create(goalDraft);
        refresh();
        showToast(goal ? 'Meta actualizada' : 'Meta creada');
      },
    });

  const askToRemove = () =>
    confirm({
      title: 'Eliminar la meta',
      text: `Se elimina "${goal.name}". Tus movimientos no cambian.`,
      confirmLabel: 'Eliminar meta',
      onCancel: reopen,
      onConfirm: () => {
        services.savingsGoals.remove(goal.id);
        refresh();
        showToast('Meta eliminada');
      },
    });

  return (
    <>
      <ModalHeader title={goal ? 'Meta de ahorro' : 'Nueva meta de ahorro'} />
      <GoalFields draft={draft} setField={setField} today={today} />
      {problem && !isBlank(draft) && <p className="filters-hint warn">{problem}</p>}
      <button type="button" className="cta" disabled={Boolean(problem)} onClick={askToSave}>
        {goal ? 'Guardar cambios' : 'Crear meta'}
      </button>
      {goal && (
        <button type="button" className="ghost danger" onClick={askToRemove}>
          Eliminar meta
        </button>
      )}
    </>
  );
}
