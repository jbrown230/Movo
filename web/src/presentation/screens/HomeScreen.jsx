import { CategoryIcon, Icon } from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { getCategory } from '../../domain/categories.js';
import { displayName } from '../../domain/names.js';
import { isForeignCurrency } from '../../domain/money.js';

import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import { useAppData } from '../hooks/useAppData.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { dayLabel, monthName, timeLabel } from '../format/dates.js';
import { formatColones, formatColonesShort, formatInCurrency, splitColonesDecimals } from '../format/money.js';
import { amountClass, amountSign, describeTransaction } from '../format/transactionLabels.js';
import { CashModal, PasteModal } from '../modals/SimpleModals.jsx';
import { PurchaseSimulatorModal, SinpeSimulatorModal } from '../modals/SimulatorModals.jsx';
import { TransactionModal } from '../modals/TransactionModal.jsx';
import { useGmail } from '../state/GmailProvider.jsx';
import { useModal } from '../state/ModalProvider.jsx';
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

function CategoryCards({ summary }) {
  if (!summary.byCategory.length)
    return (
      <div className="cats">
        <div className="empty">Aún no hay gastos este mes.</div>
      </div>
    );
  return (
    <div className="cats">
      {summary.byCategory.map((row) => {
        const { name, color } = getCategory(row.category);
        const share = summary.spentCents ? ((row.totalCents / summary.spentCents) * 100).toFixed(0) : 0;
        return (
          <div className="cat" key={row.category}>
            <CategoryIcon category={row.category} />
            <div>
              <div className="amt">{formatColonesShort(row.totalCents)}</div>
              <div className="nm">{name}</div>
            </div>
            <div className="mini">
              <i style={{ width: `${share}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Agrupa los movimientos por día ("Hoy", "Ayer", ...), conservando el orden. */
function groupByDay(transactions) {
  const groups = [];
  for (const transaction of transactions) {
    const label = dayLabel(transaction.date);
    if (!groups.length || groups.at(-1).label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(transaction);
  }
  return groups;
}

function TransactionRow({ transaction, isHighlighted }) {
  const { openModal } = useModal();
  const isForeign = isForeignCurrency(transaction.currency);
  // Un monto convertido desde dólares o euros casi nunca es redondo: se muestra con sus céntimos.
  const formatAmount = isForeign ? formatColones : formatColonesShort;
  return (
    <button
      type="button"
      className={`tx${isHighlighted ? ' flash' : ''}`}
      onClick={() => openModal(<TransactionModal transactionId={transaction.id} />)}
    >
      <CategoryIcon category={transaction.category} />
      <span className="mid">
        <div className="t1">{displayName(transaction.counterparty)}</div>
        <div className="t2">{describeTransaction(transaction)}</div>
      </span>
      <span className="r">
        <div className={amountClass(transaction)}>
          {amountSign(transaction)}
          {formatAmount(transaction.crcCents)}
        </div>
        <div className="a2">
          {isForeign ? formatInCurrency(transaction.amountCents, transaction.currency) : timeLabel(transaction.date)}
        </div>
      </span>
    </button>
  );
}

function TransactionList({ transactions }) {
  const { profile } = useSession();
  const { flashTransactionId } = useNavigation();

  if (!transactions.length) {
    return (
      <div className="empty">
        {profile.demo
          ? 'Usa el simulador de arriba para hacer un SINPE.'
          : 'Cuando tu banco te envíe una notificación, aparecerá aquí sola.'}
      </div>
    );
  }
  return groupByDay(transactions).map((group) => (
    <div className="group" key={group.label}>
      <h3>{group.label}</h3>
      {group.items.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          isHighlighted={transaction.id === flashTransactionId}
        />
      ))}
    </div>
  ));
}

/** Pantalla de inicio: gasto del mes, categorías y lista de movimientos. */
export function HomeScreen() {
  const { profile } = useSession();
  const { scan } = useGmail();
  const showToast = useToast();
  const { summary, budgetCents, transactions } = useAppData();

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
          <h2>Movimientos</h2>
          <span>{transactions.length ? `${transactions.length} en total` : ''}</span>
        </div>
        <TransactionList transactions={transactions} />
      </div>
    </section>
  );
}
