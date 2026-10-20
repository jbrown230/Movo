import { CategoryIcon } from '../components/Icon.jsx';
import { CategoryPicker, SegmentedControl } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { getCategory } from '../../domain/categories.js';
import { displayName } from '../../domain/names.js';
import { isForeignCurrency } from '../../domain/money.js';
import { Direction } from '../../domain/types.js';
import { CURRENCY_UNIT_NAME, formatInCurrency, splitColonesDecimals } from '../format/money.js';
import { longWhen } from '../format/dates.js';
import { amountSign, describeTransaction } from '../format/transactionLabels.js';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

/** "US$7,99 a ₡455,60 por dólar", o que todavía falta el tipo de cambio para convertirlo. */
function conversionText(transaction) {
  const original = formatInCurrency(transaction.amountCents, transaction.currency);
  if (!transaction.exchangeRate) return `${original}: todavía sin tipo de cambio, se convierte cuando llegue`;
  return `${original} a ₡${transaction.exchangeRate.toFixed(2)} por ${CURRENCY_UNIT_NAME[transaction.currency]}`;
}
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

/** Ícono, nombre y monto grande del movimiento. */
function TransactionSummary({ transaction }) {
  const [wholePart, decimalPart] = splitColonesDecimals(transaction.crcCents);
  const isIncome = transaction.direction === Direction.INCOME;
  return (
    <div className="detail-top">
      <CategoryIcon category={transaction.category} size={64} />
      <div className="n">{displayName(transaction.counterparty)}</div>
      <div className={`big${isIncome ? ' in' : ''}`}>
        {amountSign(transaction)}
        {wholePart}
        <small>{decimalPart}</small>
      </div>
      {isForeignCurrency(transaction.currency) && (
        <div className="meta" style={{ marginTop: 6 }}>
          {conversionText(transaction)}
        </div>
      )}
    </div>
  );
}

/** Fecha, tipo, categoría y, si hay, el correo del que salió. */
function TransactionFacts({ transaction, mail }) {
  const { openModal } = useModal();
  return (
    <dl className="kv">
      <div>
        <dt>Fecha</dt>
        <dd>{longWhen(transaction.date)}</dd>
      </div>
      <div>
        <dt>Tipo</dt>
        <dd>{describeTransaction(transaction)}</dd>
      </div>
      <div>
        <dt>Categoría</dt>
        <dd>
          {getCategory(transaction.category).name} ({transaction.categoryOrigin || ''})
        </dd>
      </div>
      {transaction.note && (
        <div>
          <dt>Detalle</dt>
          <dd>{transaction.note}</dd>
        </div>
      )}
      {mail && (
        <div>
          <dt>Origen</dt>
          <dd>
            <button type="button" className="link" onClick={() => openModal(<MailModal mailId={mail.id} />)}>
              Ver correo del banco
            </button>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Lo que se puede hacer con un movimiento. Cada acción guarda, cierra la hoja y avisa. */
function useTransactionActions(transaction) {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const showToast = useToast();

  const finish = (message) => {
    refresh();
    closeModal();
    showToast(message);
  };

  return {
    changeDirection(direction) {
      if (direction === transaction.direction) return;
      services.setDirection(transaction.id, direction);
      finish(DIRECTION_CHANGED_MESSAGE[direction]);
    },

    changeCategory(category) {
      if (category === transaction.category) return;
      const changedCount = services.recategorize(transaction.id, category);
      const several = changedCount > 1 ? ` (${changedCount} movimientos)` : '';
      finish(`${displayName(transaction.counterparty)} ahora va a ${getCategory(category).name}${several}`);
    },

    remove() {
      services.deleteTransaction(transaction.id);
      finish('Movimiento eliminado');
    },
  };
}

/** Detalle de un movimiento: permite cambiar cómo se cuenta, su categoría, o eliminarlo. */
export function TransactionModal({ transactionId }) {
  const { services } = useSession();
  const transaction = services.queries.getTransaction(transactionId);
  const actions = useTransactionActions(transaction ?? {});
  if (!transaction) return null;

  const mail = services.queries.getMailOfTransaction(transaction);

  return (
    <>
      <ModalHeader title="Movimiento" />
      <TransactionSummary transaction={transaction} />
      <TransactionFacts transaction={transaction} mail={mail} />

      <div className="subh">¿Cómo contarlo?</div>
      <SegmentedControl
        label="Cómo contarlo"
        options={DIRECTION_OPTIONS}
        value={transaction.direction}
        onChange={actions.changeDirection}
      />
      {transaction.direction === Direction.OWN_TRANSFER && (
        <p className="meta" style={{ margin: '-6px 4px 16px' }}>
          No suma a tus gastos ni a tus ingresos: solo moviste dinero entre tus cuentas.
        </p>
      )}

      {transaction.direction === Direction.EXPENSE && (
        <>
          <div className="subh">Cambiar categoría</div>
          <CategoryPicker selected={transaction.category} onSelect={actions.changeCategory} />
          <p className="meta" style={{ margin: '0 4px 16px' }}>
            Los próximos movimientos de este comercio se categorizan igual.
          </p>
        </>
      )}

      <button type="button" className="ghost danger" onClick={actions.remove}>
        Eliminar movimiento
      </button>
    </>
  );
}
