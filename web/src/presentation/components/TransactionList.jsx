// Lista de movimientos agrupada por día. La usan el inicio (resumida) y la vista de movimientos.

import { CategoryIcon } from './Icon.jsx';
import { displayName } from '../../domain/names.js';
import { isForeignCurrency } from '../../domain/money.js';
import { dayLabel, timeLabel } from '../format/dates.js';
import { formatColones, formatColonesShort, formatInCurrency } from '../format/money.js';
import { amountClass, amountSign, describeTransaction } from '../format/transactionLabels.js';
import { TransactionModal } from '../modals/TransactionModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { useNavigation } from '../state/NavigationProvider.jsx';

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

/** Movimientos agrupados por día, o `emptyText` si no hay ninguno. */
export function TransactionList({ transactions, emptyText }) {
  const { flashTransactionId } = useNavigation();

  if (!transactions.length) return <div className="empty">{emptyText}</div>;
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
