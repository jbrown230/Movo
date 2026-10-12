import { CategoryIcon } from '../components/Icon.jsx';
import { CategoryPicker, SegmentedControl } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { getCategory } from '../../domain/categories.js';
import { displayName } from '../../domain/names.js';
import { Currency, Direction } from '../../domain/types.js';
import { formatDollars, splitColonesDecimals } from '../format/money.js';
import { longWhen } from '../format/dates.js';
import { amountSign, describeTransaction } from '../format/transactionLabels.js';
import { useModal } from '../state/ModalProvider.jsx';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';
import { MailModal } from './MailModal.jsx';

const DIRECTION_OPTIONS = [
  { value: Direction.EXPENSE, label: 'Gasto' },
  { value: Direction.INCOME, label: 'Ingreso' },
  { value: Direction.OWN_TRANSFER, label: 'Entre mis cuentas' },
];

const DIRECTION_CHANGED_MESSAGE = {
  [Direction.OWN_TRANSFER]: 'Listo: no cuenta como gasto ni ingreso.',
  [Direction.INCOME]: 'Ahora cuenta como ingreso.',
  [Direction.EXPENSE]: 'Ahora cuenta como gasto.',
};

/** Detalle de un movimiento: permite cambiar cómo se cuenta, su categoría, o eliminarlo. */
export function TransactionModal({ transactionId }) {
  const { services, refresh } = useSession();
  const { openModal, closeModal } = useModal();
  const showToast = useToast();

  const transaction = services.queries.getTransaction(transactionId);
  if (!transaction) return null;

  const mail = services.queries.getMailOfTransaction(transaction);
  const [wholePart, decimalPart] = splitColonesDecimals(transaction.crcCents);
  const isExpense = transaction.direction === Direction.EXPENSE;

  const changeDirection = (direction) => {
    if (direction === transaction.direction) return;
    services.setDirection(transaction.id, direction);
    refresh();
    closeModal();
    showToast(DIRECTION_CHANGED_MESSAGE[direction]);
  };

  const changeCategory = (category) => {
    if (category === transaction.category) return;
    const changedCount = services.recategorize(transaction.id, category);
    refresh();
    closeModal();
    const several = changedCount > 1 ? ` (${changedCount} movimientos)` : '';
    showToast(`${displayName(transaction.counterparty)} ahora va a ${getCategory(category).name}${several}`);
  };

  const remove = () => {
    services.deleteTransaction(transaction.id);
    refresh();
    closeModal();
    showToast('Movimiento eliminado');
  };

  return (
    <>
      <ModalHeader title="Movimiento" />
      <div className="detail-top">
        <CategoryIcon category={transaction.category} size={64} />
        <div className="n">{displayName(transaction.counterparty)}</div>
        <div className={`big${transaction.direction === Direction.INCOME ? ' in' : ''}`}>
          {amountSign(transaction)}{wholePart}<small>{decimalPart}</small>
        </div>
        {transaction.currency === Currency.USD && (
          <div className="meta" style={{ marginTop: 6 }}>
            {formatDollars(transaction.amountCents)} a ₡{(transaction.exchangeRate || 0).toFixed(2)} por dólar
          </div>
        )}
      </div>

      <dl className="kv">
        <div><dt>Fecha</dt><dd>{longWhen(transaction.date)}</dd></div>
        <div><dt>Tipo</dt><dd>{describeTransaction(transaction)}</dd></div>
        <div><dt>Categoría</dt><dd>{getCategory(transaction.category).name} ({transaction.categoryOrigin || ''})</dd></div>
        {transaction.note && <div><dt>Detalle</dt><dd>{transaction.note}</dd></div>}
        {mail && (
          <div>
            <dt>Origen</dt>
            <dd><button type="button" className="link" onClick={() => openModal(<MailModal mailId={mail.id} />)}>Ver correo del banco</button></dd>
          </div>
        )}
      </dl>

      <div className="subh">¿Cómo contarlo?</div>
      <SegmentedControl label="Cómo contarlo" options={DIRECTION_OPTIONS} value={transaction.direction} onChange={changeDirection} />
      {transaction.direction === Direction.OWN_TRANSFER && (
        <p className="meta" style={{ margin: '-6px 4px 16px' }}>
          No suma a tus gastos ni a tus ingresos: solo moviste dinero entre tus cuentas.
        </p>
      )}

      {isExpense && (
        <>
          <div className="subh">Cambiar categoría</div>
          <CategoryPicker selected={transaction.category} onSelect={changeCategory} />
          <p className="meta" style={{ margin: '0 4px 16px' }}>Los próximos movimientos de este comercio se categorizan igual.</p>
        </>
      )}

      <button type="button" className="ghost danger" onClick={remove}>Eliminar movimiento</button>
    </>
  );
}
