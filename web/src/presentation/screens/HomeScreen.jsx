import { CategoryIcon, Icon } from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { TransactionList } from '../components/TransactionList.jsx';
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

/** Lo gastado en el mes, con la barra del presupuesto. */
function SpentSummary({ summary, budgetCents }) {
  const animatedSpent = useAnimatedNumber(summary.spentCents);
  const [wholePart, decimalPart] = splitColonesDecimals(animatedSpent);
  const barWidth = Math.min(100, (summary.spentCents / budgetCents) * 100).toFixed(1) + '%';
  const isOverBudget = summary.spentCents > budgetCents;

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
        <div className="bar">
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

/** Cuántas categorías muestra el inicio: las de más gasto del mes. Las demás se filtran en Movimientos. */
const TOP_CATEGORIES_ON_HOME = 2;

/** Los filtros de lo que va del mes, opcionalmente de una sola categoría. */
function monthFiltersFor(category = '') {
  const today = new Date();
  return {
    ...NO_MOVEMENT_FILTERS,
    category,
    fromDay: toDayString(new Date(today.getFullYear(), today.getMonth(), 1)),
    toDay: toDayString(today),
  };
}

function CategoryCards({ summary }) {
  const { showMovements } = useNavigation();
  if (!summary.byCategory.length)
    return (
      <div className="cats">
        <div className="empty">Aún no hay gastos este mes.</div>
      </div>
    );
  return (
    <div className="cats">
      {summary.byCategory.slice(0, TOP_CATEGORIES_ON_HOME).map((row) => {
        const { name, color } = getCategory(row.category);
        const share = summary.spentCents ? ((row.totalCents / summary.spentCents) * 100).toFixed(0) : 0;
        return (
          <button
            type="button"
            className="cat"
            key={row.category}
            aria-label={`${name}: ver sus movimientos del mes`}
            onClick={() => showMovements(monthFiltersFor(row.category))}
          >
            <CategoryIcon category={row.category} />
            <div>
              <div className="amt">{formatColonesShort(row.totalCents)}</div>
              <div className="nm">{name}</div>
            </div>
            <div className="mini">
              <i style={{ width: `${share}%`, background: color }} />
            </div>
          </button>
        );
      })}
      {summary.byCategory.length > TOP_CATEGORIES_ON_HOME && (
        <button
          type="button"
          className="ghost cats-more"
          onClick={() => showMovements(monthFiltersFor(), { openFilters: true })}
        >
          Ver las {summary.byCategory.length} categorías en Movimientos
        </button>
      )}
    </div>
  );
}

/** Cuántos movimientos recientes muestra el inicio; la lista completa está en la vista de movimientos. */
const RECENT_MOVEMENTS_ON_HOME = 5;

/** Pantalla de inicio: gasto del mes, categorías y los últimos movimientos. */
export function HomeScreen() {
  const { profile } = useSession();
  const { scan } = useGmail();
  const showToast = useToast();
  const { summary, budgetCents, transactions } = useAppData();
  const { showMovements } = useNavigation();

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
        <SpentSummary summary={summary} budgetCents={budgetCents} />
        <QuickActions />
      </header>

      <div className="body">
        {profile.demo && <BankSimulatorCard />}
        <div className="sec-h">
          <h2>Por categoría</h2>
          <span>
            {summary.byCategory.length
              ? `${summary.byCategory.length} ${summary.byCategory.length === 1 ? 'categoría' : 'categorías'}`
              : ''}
          </span>
        </div>
        <CategoryCards summary={summary} />
        <div className="sec-h">
          <h2>Últimos movimientos</h2>
          <span>{transactions.length ? `${transactions.length} en total` : ''}</span>
        </div>
        <TransactionList
          transactions={transactions.slice(0, RECENT_MOVEMENTS_ON_HOME)}
          emptyText={
            profile.demo
              ? 'Usa el simulador de arriba para hacer un SINPE.'
              : 'Cuando tu banco te envíe una notificación, aparecerá aquí sola.'
          }
        />
        {transactions.length > RECENT_MOVEMENTS_ON_HOME && (
          <button type="button" className="ghost" onClick={() => showMovements(NO_MOVEMENT_FILTERS)}>
            Ver todos los movimientos
          </button>
        )}
      </div>
    </section>
  );
}
