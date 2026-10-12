import { useState } from 'react';
import { AmountInput, CategoryPicker, Field } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { displayName } from '../../domain/names.js';
import { textToCents } from '../../domain/money.js';
import { Currency, Direction, MailStatus, TransactionType } from '../../domain/types.js';
import { formatColones, formatColonesShort, formatDollars } from '../format/money.js';
import { longWhen, shortWhen } from '../format/dates.js';
import { describeTransaction } from '../format/transactionLabels.js';
import { useModal } from '../state/ModalProvider.jsx';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const emailAddressOf = (fromAddress) => (fromAddress && fromAddress.includes('@') ? fromAddress.replace(/.*</, '').replace('>', '') : '');

function MailTransaction({ transaction }) {
  const isIncome = transaction.direction === Direction.INCOME;
  const isOwnTransfer = transaction.direction === Direction.OWN_TRANSFER;
  const isSinpe = transaction.type === TransactionType.SINPE;
  const counterpartyLabel = isSinpe ? (isIncome ? 'Remitente' : 'Destinatario') : 'Comercio';
  const amountText = transaction.currency === Currency.USD
    ? `${formatDollars(transaction.amountCents)} (${formatColonesShort(transaction.crcCents)})`
    : formatColones(transaction.amountCents);
  const directionPrefix = isIncome ? 'Ingreso, ' : isOwnTransfer ? '' : 'Gasto, ';

  return (
    <dl className="kv">
      <div><dt>Monto</dt><dd>{amountText}</dd></div>
      <div><dt>{counterpartyLabel}</dt><dd>{transaction.counterparty}</dd></div>
      <div><dt>Fecha</dt><dd>{longWhen(transaction.date)}</dd></div>
      <div><dt>Tipo</dt><dd>{directionPrefix}{describeTransaction(transaction)}</dd></div>
      {transaction.note && <div><dt>Detalle</dt><dd>{transaction.note}</dd></div>}
    </dl>
  );
}

/** Formulario para registrar a mano un correo que Movo no entendió. */
function ManualRegistration({ mail }) {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const showToast = useToast();
  const [amountText, setAmountText] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState('otros');

  const canSave = textToCents(amountText) > 0 && counterparty.trim() !== '';

  const save = () => {
    const saved = services.addManualTransaction({
      amountCents: textToCents(amountText),
      counterparty: counterparty.trim().toUpperCase(),
      category,
      type: TransactionType.TRANSFER,
      date: mail.receivedAt,
      mailId: mail.id,
    });
    flashTransaction(saved.id);
    refresh();
    closeModal();
    goTo(Views.HOME);
    showToast('Movimiento guardado');
  };

  return (
    <>
      <div className="subh">Registrar a mano</div>
      <AmountInput value={amountText} onChange={setAmountText} />
      <Field htmlFor="manualCounterparty" label="Comercio o persona">
        <input id="manualCounterparty" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} autoComplete="off" />
      </Field>
      <CategoryPicker selected={category} onSelect={setCategory} />
      <button type="button" className="cta" disabled={!canSave} onClick={save}>Guardar movimiento</button>
    </>
  );
}

/** Un correo del banco: lo que dice, lo que Movo entendió, y cómo corregirlo. */
export function MailModal({ mailId }) {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const showToast = useToast();

  const mail = services.queries.getMail(mailId);
  if (!mail) return null;

  const transactions = services.queries.getTransactionsOfMail(mail);
  const wasDeclined = mail.status === MailStatus.DECLINED;
  const canRegisterByHand = transactions.length === 0 && !wasDeclined;
  const canReadAgain = mail.status !== MailStatus.REGISTERED && mail.status !== MailStatus.DISCARDED;
  const address = emailAddressOf(mail.fromAddress);

  const readAgain = () => {
    const result = services.reparseMail(mail.id);
    refresh();
    if (result.status === MailStatus.REGISTERED) {
      closeModal();
      flashTransaction(result.transaction.id);
      goTo(Views.HOME);
      showToast(`Leído: ${displayName(result.transaction.counterparty)}, ${formatColonesShort(result.transaction.crcCents)}`);
    } else {
      showToast(result.status === MailStatus.DECLINED
        ? 'El banco negó esta transacción; no se registra.'
        : 'Sigo sin encontrar un monto en este correo.');
    }
  };

  return (
    <>
      <ModalHeader title={mail.subject || 'Correo'} />
      <p className="meta">
        {mail.fromName || 'Remitente desconocido'}{address && ` · ${address}`}, {shortWhen(mail.receivedAt)}
      </p>
      <div className="raw">{mail.body}</div>

      <div className="subh">
        Lo que leyó Movo{mail.template && <span className="muted"> · lector {mail.template}</span>}
      </div>
      {transactions.map((transaction) => <MailTransaction key={transaction.id} transaction={transaction} />)}
      {mail.note && <div className={`notebox${wasDeclined ? ' neg' : ''}`}>{mail.note}</div>}

      {canRegisterByHand && <ManualRegistration mail={mail} />}
      {canReadAgain && <button type="button" className="ghost" onClick={readAgain}>Leer de nuevo</button>}
    </>
  );
}
