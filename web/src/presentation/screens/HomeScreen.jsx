import { CategoryIcon, Icon } from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { TransactionList } from '../components/TransactionList.jsx';
import { BudgetLevel, TOTAL_BUDGET_SCOPE, budgetStatus } from '../../domain/budget.js';
import { getCategory } from '../../domain/categories.js';
import { toDayString } from '../../domain/period.js';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import { useAppData } from '../hooks/useAppData.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { monthName } from '../format/dates.js';
import { formatColonesShort, splitColonesDecimals } from '../format/money.js';
import { CashModal, PasteModal } from '../modals/SimpleModals.jsx';
import { PurchaseSimulatorModal, SinpeSimulatorModal } from '../modals/SimulatorModals.jsx';
import { useGmail } from '../state/GmailProvider.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { NO_MOVEMENT_FILTERS } from '../state/movementFilters.js';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

/** Etiqueta de arriba que dice si Gmail está conectado, sin conexión, o leyendo. */
function LiveStatusChip() {
  const { profile } = useSession();
  const { progressText, isConnected, reconnect } = useGmail();
  const isOnline = useOnlineStatus();

  let text = 'Reconectar Gmail';
  let stateClass = 'off';
  if (progressText) {
    text = progressText;
    stateClass = 'busy';
  } else if (!isOnline) {
    text = 'Sin conexión';
    stateClass = 'off';
  } else if (profile.demo) {
    text = 'Modo demo';
    stateClass = 'demo';
  } else if (isConnected) {
    text = 'Gmail conectado';
    stateClass = '';
  }

  const reconnectIfNeeded = () => {
    if (!profile.demo && !isConnected && isOnline) reconnect();
  };

  return (
    <button type="button" className={`live ${stateClass}`.trim()} onClick={reconnectIfNeeded}>
      <span className="dot" />
      <span>{text}</span>
    </button>
  );
}

/** Clase de la barra según cómo va el presupuesto: normal, cerca del límite o agotado. */
const BAR_CLASS_BY_LEVEL = Object.freeze({
  [BudgetLevel.OK]: 'bar',
  [BudgetLevel.WARNING]: 'bar warn',
  [BudgetLevel.EXCEEDED]: 'bar over',
});

/** Lo gastado en el mes, con la barra del presupuesto. */
function SpentSummary({ summary, budgetCents, alertPercent }) {
  const animatedSpent = useAnimatedNumber(summary.spentCents);
  const [wholePart, decimalPart] = splitColonesDecimals(animatedSpent);
  const barWidth = Math.min(100, (summary.spentCents / budgetCents) * 100).toFixed(1) + '%';
  const isOverBudget = summary.spentCents > budgetCents;
  const { level } = budgetStatus({ spentCents: summary.spentCents, budgetCents, alertPercent });

  const budgetText = isOverBudget
    ? `Te pasaste ${formatColonesShort(summary.spentCents - budgetCents)} del presupuesto`
    : `${formatColonesShort(budgetCents - summary.spentCents)} disponibles de ${formatColonesShort(budgetCents)}`;
  const incomeText = [
    summary.incomeCents && `Ingresos: ${formatColonesShort(summary.incomeCents)}`,
    summary.movedBetweenOwnAccountsCents &&
      `Entre tus cuentas: ${formatColonesShort(summary.movedBetweenOwnAccountsCents)}`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div className="spent">
      <div className="lbl">Gastado en {monthName()}</div>
      <div className="big">
        {wholePart}
        <small>{decimalPart}</small>
      </div>
      <div className="budget">
        <div className={BAR_CLASS_BY_LEVEL[level]}>
          <i style={{ width: barWidth }} />
        </div>
        <p>{budgetText}</p>
        <p className="inc">{incomeText}</p>
      </div>
    </div>
  );
}

function QuickActions() {
  const { openModal } = useModal();
  const { goTo } = useNavigation();
  return (
    <div className="actions">
      <button type="button" className="act primary" onClick={() => openModal(<CashModal />)}>
        <span className="c">
          <Icon name="cash" />
        </span>
        Efectivo
      </button>
      <button type="button" className="act" onClick={() => openModal(<PasteModal />)}>
        <span className="c">
          <Icon name="clipboard" />
        </span>
        Pegar aviso
      </button>
      <button type="button" className="act" onClick={() => goTo(Views.INBOX)}>
        <span className="c">
          <Icon name="mail" />
        </span>
        Bandeja
      </button>
    </div>
  );
}

/** Solo en el modo demo: botones para simular que el banco te avisa. */
function BankSimulatorCard() {
  const { openModal } = useModal();
  return (
    <div className="sim">
      <div className="sim-t">
        <b style={{ display: 'none' }}>Modo demo: simula a tu banco</b>
        <span>
          En la vida real esto lo haces en la app de tu banco, no aquí. Movo nunca mueve dinero: solo lee el correo que
          el banco te envía después.
        </span>
      </div>
      <div className="sim-b">
        <button type="button" onClick={() => openModal(<SinpeSimulatorModal />)}>
          Hacer un SINPE
        </button>
        <button type="button" onClick={() => openModal(<PurchaseSimulatorModal />)}>
          Pagar con tarjeta
        </button>
      </div>
    </div>
  );
}

/** Los filtros que abre una tarjeta de categoría: esa categoría, en lo que va del mes. */
function monthFiltersFor(category) {
  const today = new Date();
  return {
    ...NO_MOVEMENT_FILTERS,
    category,
    fromDay: toDayString(new Date(today.getFullYear(), today.getMonth(), 1)),
    toDay: toDayString(today),
  };
}

const ALERT_TITLE_BY_LEVEL = Object.freeze({
  [BudgetLevel.WARNING]: 'Cerca del límite',
  [BudgetLevel.EXCEEDED]: 'Presupuesto agotado',
});

/** "Presupuesto del mes: llevas el 82 % (₡287 000 de ₡350 000)." */
function budgetAlertText({ scope, percent, spentCents, budgetCents }) {
  const subject =
    scope === TOTAL_BUDGET_SCOPE ? `Presupuesto de ${monthName()}` : `Presupuesto de ${getCategory(scope).name}`;
  return `${subject}: llevas el ${percent} % (${formatColonesShort(spentCents)} de ${formatColonesShort(budgetCents)}).`;
}

/** Avisos del presupuesto: al llegar al umbral elegido en Ajustes y al llegar al 100 %. */
function BudgetAlerts({ alerts }) {
  if (!alerts.length) return null;
  return (
    <div className="budget-alerts" role="status" aria-label="Avisos del presupuesto">
      {alerts.map((alert) => (
        <div className={`budget-alert ${alert.level}`} key={alert.scope}>
          <Icon name={alert.level === BudgetLevel.EXCEEDED ? 'alert' : 'bell'} />
          <div>
            <b>{ALERT_TITLE_BY_LEVEL[alert.level]}</b>
            <span>{budgetAlertText(alert)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const MINI_BAR_COLOR_BY_LEVEL = Object.freeze({
  [BudgetLevel.WARNING]: 'var(--warn)',
  [BudgetLevel.EXCEEDED]: 'var(--danger)',
});

/**
 * La barrita de una tarjeta de categoría. Con presupuesto propio muestra cuánto lleva de él;
 * sin presupuesto, qué parte del gasto del mes es de esa categoría.
 */
function categoryBar({ row, summary, categoryBudgets, alertPercent }) {
  const { color } = getCategory(row.category);
  const budgetCents = categoryBudgets[row.category];
  if (!budgetCents) {
    const share = summary.spentCents ? ((row.totalCents / summary.spentCents) * 100).toFixed(0) : 0;
    return { width: `${share}%`, color, budgetText: '' };
  }
  const { percent, level } = budgetStatus({ spentCents: row.totalCents, budgetCents, alertPercent });
  return {
    width: `${Math.min(100, percent)}%`,
    color: MINI_BAR_COLOR_BY_LEVEL[level] ?? color,
    budgetText: `${percent} % de ${formatColonesShort(budgetCents)}`,
  };
}

function CategoryCards({ summary, categoryBudgets, alertPercent }) {
  const { filterMovements } = useNavigation();
  if (!summary.byCategory.length)
    return (
      <div className="cats">
        <div className="empty">Aún no hay gastos este mes.</div>
      </div>
    );
  return (
    <div className="cats">
      {summary.byCategory.map((row) => {
        const { name } = getCategory(row.category);
        const bar = categoryBar({ row, summary, categoryBudgets, alertPercent });
        return (
          <button
            type="button"
            className="cat"
            key={row.category}
            aria-label={`${name}: ver sus movimientos del mes`}
            onClick={() => filterMovements(monthFiltersFor(row.category))}
          >
            <CategoryIcon category={row.category} />
            <div>
              <div className="amt">{formatColonesShort(row.totalCents)}</div>
              <div className="nm">{name}</div>
            </div>
            <div className="mini">
              <i style={{ width: bar.width, background: bar.color }} />
            </div>
            {bar.budgetText && <div className="lim">{bar.budgetText}</div>}
          </button>
        );
      })}
    </div>
  );
}

const RECENT_MOVEMENTS_COUNT = 5;

/** Los últimos movimientos; la lista completa, con búsqueda y filtros, está en la pestaña Movimientos. */
function RecentMovements() {
  const { profile } = useSession();
  const { goTo } = useNavigation();
  const { transactions } = useAppData();

  let emptyText = 'Cuando tu banco te envíe una notificación, aparecerá aquí sola.';
  if (profile.demo) emptyText = 'Usa el simulador de arriba para hacer un SINPE.';

  return (
    <>
      <div className="sec-h">
        <h2>Últimos movimientos</h2>
        {transactions.length > RECENT_MOVEMENTS_COUNT && (
          <button type="button" className="link" onClick={() => goTo(Views.MOVEMENTS)}>
            Ver todos ({transactions.length})
          </button>
        )}
      </div>
      <TransactionList transactions={transactions.slice(0, RECENT_MOVEMENTS_COUNT)} emptyText={emptyText} />
    </>
  );
}

/** Pantalla de inicio: gasto del mes, categorías y últimos movimientos. */
export function HomeScreen() {
  const { profile } = useSession();
  const { scan } = useGmail();
  const showToast = useToast();
  const { summary, budgetCents, categoryBudgets, budgetAlertPercent, budgetAlerts } = useAppData();

  const refreshInbox = () => {
    if (profile.demo) showToast('En el modo demo, usa el simulador para generar correos.');
    else scan();
  };

  return (
    <section aria-label="Inicio">
      <header className="hero">
        <div className="topbar">
          <div className="mark">
            <Logo />
          </div>
          <LiveStatusChip />
          <button type="button" className="iconbtn" aria-label="Buscar correos nuevos" onClick={refreshInbox}>
            <Icon name="refresh" />
          </button>
        </div>
        <SpentSummary summary={summary} budgetCents={budgetCents} alertPercent={budgetAlertPercent} />
        <QuickActions />
      </header>

      <div className="body">
        <BudgetAlerts alerts={budgetAlerts} />
        {profile.demo && <BankSimulatorCard />}
        <div className="sec-h">
          <h2>Por categoría</h2>
          <span>
            {summary.byCategory.length
              ? `${summary.byCategory.length} ${summary.byCategory.length === 1 ? 'categoría' : 'categorías'}`
              : ''}
          </span>
        </div>
        <CategoryCards summary={summary} categoryBudgets={categoryBudgets} alertPercent={budgetAlertPercent} />
        <RecentMovements />
      </div>
    </section>
  );
}
