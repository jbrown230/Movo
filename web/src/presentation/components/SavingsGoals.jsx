// Sección del inicio con las metas de ahorro y cómo va cada una.

import { GoalStatus } from '../../domain/savingsGoals.js';
import { useAppData } from '../hooks/useAppData.js';
import { goalDayLabel, monthName } from '../format/dates.js';
import { formatColonesShort } from '../format/money.js';
import { SavingsGoalModal } from '../modals/SavingsGoalModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';

/** "Este mes ahorraste ₡45 000" o "En octubre gastaste ₡12 000 más de lo que entró". */
function monthNetText(summary) {
  const netCents = summary.incomeCents - summary.spentCents;
  if (netCents >= 0) return `En ${monthName()} llevas ${formatColonesShort(netCents)} ahorrados`;
  return `En ${monthName()} gastaste ${formatColonesShort(-netCents)} más de lo que entró`;
}

function goalDetailText(goal) {
  if (goal.status === GoalStatus.REACHED) return '¡Lo lograste!';
  if (goal.status === GoalStatus.OVERDUE) return `La fecha pasó: faltaron ${formatColonesShort(goal.remainingCents)}.`;
  const months = goal.monthsLeft === 1 ? 'este mes' : `al mes durante ${goal.monthsLeft} meses`;
  return `Ahorra ${formatColonesShort(goal.neededPerMonthCents)} ${months} para llegar al ${goalDayLabel(goal.targetDay)}.`;
}

const STATUS_TAG = Object.freeze({
  [GoalStatus.REACHED]: { label: 'Lograda', className: 'tag ok' },
  [GoalStatus.OVERDUE]: { label: 'Vencida', className: 'tag neg' },
});

function GoalCard({ goal }) {
  const { openModal } = useModal();
  const tag = STATUS_TAG[goal.status];
  return (
    <button
      type="button"
      className={`goal ${goal.status}`}
      aria-label={`Meta ${goal.name}: ${goal.percent} %`}
      onClick={() => openModal(<SavingsGoalModal goal={goal} />)}
    >
      <div className="goal-h">
        <b>{goal.name}</b>
        {tag ? <span className={tag.className}>{tag.label}</span> : <span className="goal-pct">{goal.percent} %</span>}
      </div>
      <div className="goal-amt">
        {formatColonesShort(Math.max(0, goal.savedCents))} <span>de {formatColonesShort(goal.targetCents)}</span>
      </div>
      <div className="mini">
        <i style={{ width: `${goal.percent}%` }} />
      </div>
      <p>{goalDetailText(goal)}</p>
    </button>
  );
}

export function SavingsGoals() {
  const { openModal } = useModal();
  const { savingsGoals, summary } = useAppData();
  const createGoal = () => openModal(<SavingsGoalModal />);

  return (
    <section aria-label="Metas de ahorro">
      <div className="sec-h">
        <h2>Metas de ahorro</h2>
        <button type="button" className="link" onClick={createGoal}>
          Nueva meta
        </button>
      </div>
      {savingsGoals.length ? (
        <div className="goals">
          <p className="goals-month">{monthNetText(summary)}</p>
          {savingsGoals.map((goal) => (
            <GoalCard goal={goal} key={goal.id} />
          ))}
        </div>
      ) : (
        <button type="button" className="goal empty" onClick={createGoal}>
          <b>Crea tu primera meta</b>
          <p>Elige cuánto quieres ahorrar y para cuándo. Movo te dice cuánto apartar cada mes.</p>
        </button>
      )}
    </section>
  );
}
