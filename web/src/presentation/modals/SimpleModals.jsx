// Modales cortos: pegar un aviso, gasto en efectivo y búsqueda de Gmail. Los del presupuesto están en BudgetModals.jsx.

import { useState } from 'react';
import { AmountInput, CategoryPicker, Field } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { getCategory } from '../../domain/categories.js';
import { displayName } from '../../domain/names.js';
import { textToCents } from '../../domain/money.js';
import { MailStatus } from '../../domain/types.js';
import { DEFAULT_GMAIL_QUERY } from '../../application/preferences.js';
import { formatColonesShort } from '../format/money.js';
import { useConfirm } from './ConfirmModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const MIN_PASTED_TEXT_LENGTH = 8;

/** Pegar el texto de un correo o SMS del banco para que Movo lo lea. */
export function PasteModal({ prefill = '' }) {
  const { services, refresh } = useSession();
  const { closeModal, openModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const confirm = useConfirm();
  const showToast = useToast();
  const [text, setText] = useState(prefill);

  const askToRead = () =>
    confirm({
      title: 'Leer la notificación',
      text: 'Movo lee el texto pegado y, si encuentra un monto, lo registra como movimiento.',
      confirmLabel: 'Leer',
      danger: false,
      onCancel: () => openModal(<PasteModal prefill={text} />),
      onConfirm: read,
    });

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
      <button type="button" className="cta" disabled={text.trim().length < MIN_PASTED_TEXT_LENGTH} onClick={askToRead}>
        Leer
      </button>
    </>
  );
}

/** Registrar un gasto en efectivo. `draft` vuelve a llenar el formulario si se canceló la confirmación. */
export function CashModal({ draft = {} }) {
  const { services, refresh } = useSession();
  const { closeModal, openModal } = useModal();
  const { goTo, flashTransaction } = useNavigation();
  const confirm = useConfirm();
  const showToast = useToast();
  const [amountText, setAmountText] = useState(draft.amountText ?? '');
  const [description, setDescription] = useState(draft.description ?? '');
  const [category, setCategory] = useState(draft.category ?? 'comida');

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

  const askToSave = () =>
    confirm({
      title: 'Guardar gasto',
      text: `Se registra un gasto en efectivo de ${formatColonesShort(textToCents(amountText))} en "${description.trim()}" (${getCategory(category).name}).`,
      confirmLabel: 'Guardar gasto',
      danger: false,
      onCancel: () => openModal(<CashModal draft={{ amountText, description, category }} />),
      onConfirm: save,
    });

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
      <button type="button" className="cta" disabled={!canSave} onClick={askToSave}>
        Guardar gasto
      </button>
    </>
  );
}

/** Cambiar la búsqueda de Gmail que define qué bancos se leen. */
export function GmailQueryModal() {
  const { services } = useSession();
  const { closeModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const currentQuery = services.preferences.gmailQuery();
  const [query, setQuery] = useState(currentQuery);

  const save = () => {
    if (query.trim() === currentQuery) {
      closeModal();
      return;
    }
    confirm({
      title: 'Cambiar los bancos que se leen',
      text: 'La próxima búsqueda usa la búsqueda nueva y vuelve a revisar los últimos 45 días.',
      confirmLabel: 'Guardar búsqueda',
      danger: false,
      onConfirm: () => {
        services.preferences.setGmailQuery(query);
        showToast('Guardado. La próxima búsqueda revisa los últimos 45 días.');
      },
    });
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
