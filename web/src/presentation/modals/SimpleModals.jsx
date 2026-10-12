// Modales cortos: pegar un aviso, gasto en efectivo, presupuesto y búsqueda de Gmail.

import { useState } from 'react';
import { AmountInput, CategoryPicker, Field } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { displayName } from '../../domain/names.js';
import { textToCents } from '../../domain/money.js';
import { MailStatus } from '../../domain/types.js';
import { DEFAULT_GMAIL_QUERY } from '../../application/preferences.js';
import { formatColonesShort } from '../format/money.js';
import { useModal } from '../state/ModalProvider.jsx';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const MIN_PASTED_TEXT_LENGTH = 8;

/** Pegar el texto de un correo o SMS del banco para que Movo lo lea. */
export function PasteModal({ prefill = '' }) {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const showToast = useToast();
  const [text, setText] = useState(prefill);

  const read = () => {
    const result = services.readMail({
      id: 'pegado-' + Date.now(),
      messageId: null,
      from: '',
      fromName: 'Texto pegado',
      subject: 'Notificación pegada',
      body: text.trim(),
      date: new Date().toISOString(),
    });
    closeModal();
    refresh();

    if (result.transaction) {
      flashTransaction(result.transaction.id);
      goTo(Views.HOME);
      const many = result.transactions.length > 1;
      showToast(
        many
          ? `Leí ${result.transactions.length} movimientos de ese aviso.`
          : `Leído: ${displayName(result.transaction.counterparty)}, ${formatColonesShort(result.transaction.crcCents)}`,
      );
    } else if (result.status === MailStatus.DECLINED) {
      goTo(Views.INBOX);
      showToast('Esa transacción aparece como negada por el banco: no se registra como gasto.');
    } else {
      goTo(Views.INBOX);
      showToast('No encontré un monto. Ábrelo en la bandeja para registrarlo a mano.');
    }
  };

  return (
    <>
      <ModalHeader title="Leer una notificación" />
      <p className="meta">
        Pega el texto de un correo o SMS de tu banco (por ejemplo, el aviso de SINPE Móvil). Se procesa en este
        teléfono.
      </p>
      <Field htmlFor="pastedText" label="Texto">
        <textarea
          id="pastedText"
          value={text}
          onChange={(event) => setText(event.target.value)}
          data-autofocus
          placeholder={'Monto: CRC 12,500.00\nComercio: …\nFecha: 15/01/2026 13:22'}
        />
      </Field>
      <button type="button" className="cta" disabled={text.trim().length < MIN_PASTED_TEXT_LENGTH} onClick={read}>
        Leer
      </button>
    </>
  );
}

/** Registrar un gasto en efectivo. */
export function CashModal() {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const showToast = useToast();
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('comida');

  const canSave = textToCents(amountText) > 0 && description.trim() !== '';

  const save = () => {
    const saved = services.addManualTransaction({
      amountCents: textToCents(amountText),
      counterparty: description.trim().toUpperCase(),
      category,
    });
    flashTransaction(saved.id);
    closeModal();
    goTo(Views.HOME);
    refresh();
    showToast(navigator.onLine ? 'Gasto guardado' : 'Guardado sin conexión');
  };

  return (
    <>
      <ModalHeader title="Gasto en efectivo" />
      <AmountInput value={amountText} onChange={setAmountText} />
      <Field htmlFor="cashDescription" label="¿En qué fue?">
        <input
          id="cashDescription"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Pan, parqueo, propina…"
          autoComplete="off"
        />
      </Field>
      <div className="subh">Categoría</div>
      <CategoryPicker selected={category} onSelect={setCategory} hidden={['transfer']} />
      <button type="button" className="cta" disabled={!canSave} onClick={save}>
        Guardar gasto
      </button>
    </>
  );
}

/** Cambiar el presupuesto mensual. */
export function BudgetModal() {
  const { services, refresh } = useSession();
  const { closeModal } = useModal();
  const [amountText, setAmountText] = useState(String(Math.round(services.preferences.budgetCents() / 100)));

  const save = () => {
    const cents = textToCents(amountText);
    if (cents > 0) {
      services.preferences.setBudgetCents(cents);
      refresh();
    }
    closeModal();
  };

  return (
    <>
      <ModalHeader title="Presupuesto mensual" />
      <AmountInput value={amountText} onChange={setAmountText} />
      <button type="button" className="cta" onClick={save}>
        Guardar
      </button>
    </>
  );
}

/** Cambiar la búsqueda de Gmail que define qué bancos se leen. */
export function GmailQueryModal() {
  const { services } = useSession();
  const { closeModal } = useModal();
  const showToast = useToast();
  const [query, setQuery] = useState(services.preferences.gmailQuery());

  const save = () => {
    services.preferences.setGmailQuery(query);
    closeModal();
    showToast('Guardado. La próxima búsqueda revisa los últimos 45 días.');
  };

  return (
    <>
      <ModalHeader title="Bancos que se leen" />
      <p className="meta">
        Búsqueda de Gmail que usa Movo. Agrega el remitente de tu banco si no aparece, con <b>from:</b>dominio.
      </p>
      <Field htmlFor="gmailQuery" label="Búsqueda">
        <textarea
          id="gmailQuery"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ minHeight: 120 }}
        />
      </Field>
      <button type="button" className="cta" onClick={save}>
        Guardar
      </button>
      <button type="button" className="ghost" onClick={() => setQuery(DEFAULT_GMAIL_QUERY)}>
        Restaurar la predeterminada
      </button>
    </>
  );
}
