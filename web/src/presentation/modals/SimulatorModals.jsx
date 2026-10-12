// Simulador de banco (solo modo demo): la persona "hace" un SINPE o una compra, el banco
// "envía" el correo y Movo lo lee solo. Todo es ficticio: nunca se mueve dinero.

import { useState } from 'react';
import { AmountInput, Field, SegmentedControl } from '../components/formControls.jsx';
import { Icon } from '../components/Icon.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { buildBankMail } from '../../demo/mailBuilder.js';
import { MERCHANTS, SIMULATOR_CONTACTS } from '../../demo/sampleData.js';
import { normalizeKey, toTitleCase } from '../../domain/names.js';
import { textToCents } from '../../domain/money.js';
import { Currency } from '../../domain/types.js';
import { formatColonesShort, formatDollars } from '../format/money.js';
import { useModal } from '../state/ModalProvider.jsx';
import { useMailDelivery } from '../state/MailDeliveryProvider.jsx';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';

const SIMULATED_BANKS = ['BAC', 'BN', 'BCR'];
const BANK_OPTIONS = SIMULATED_BANKS.map((bank) => ({ value: bank, label: bank }));
const CURRENCY_OPTIONS = [
  { value: Currency.CRC, label: 'Colones' },
  { value: Currency.USD, label: 'Dólares' },
];

const CLOSE_SUCCESS_AFTER_MS = 1600;
const DELIVER_MAIL_AFTER_MS = 2100;
const PHONE_LENGTH = 8;
const SUGGESTED_MERCHANTS = 6;

/** "88881234" -> "8888 1234" */
const formatPhone = (digits) => (digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits);
const onlyDigits = (text) => text.replace(/\D/g, '');

function BankChooser({ value, onChange }) {
  return (
    <Field label="Banco que te notifica">
      <SegmentedControl label="Banco" options={BANK_OPTIONS} value={value} onChange={onChange} />
    </Field>
  );
}

/** Pantalla de confirmación; después de un momento, llega la notificación del banco. */
function useSimulatorSuccess() {
  const { openModal, closeModal } = useModal();
  const { goTo } = useNavigation();
  const { deliverMail } = useMailDelivery();

  return (title, text, mail, bank) => {
    openModal(<SimulatorSuccess title={title} text={text} />);
    goTo(Views.HOME);
    setTimeout(closeModal, CLOSE_SUCCESS_AFTER_MS);
    setTimeout(() => deliverMail(mail, bank), DELIVER_MAIL_AFTER_MS);
  };
}

function SimulatorSuccess({ title, text }) {
  const { closeModal } = useModal();
  return (
    <div className="success">
      <div className="ok">
        <Icon name="check" />
      </div>
      <h2 id="modalTitle">{title}</h2>
      <p>{text}</p>
      <button type="button" className="cta" onClick={closeModal} data-autofocus>
        Listo
      </button>
    </div>
  );
}

/** Contactos de ejemplo para llenar el formulario con un toque. */
function ContactChips({ selectedIndex, onChoose }) {
  return (
    <div className="chips" role="group" aria-label="Contactos">
      {SIMULATOR_CONTACTS.map((contact, index) => (
        <button
          key={contact.phone}
          type="button"
          className="chip"
          aria-pressed={selectedIndex === index}
          onClick={() => onChoose(index)}
        >
          <span className="av" style={{ background: contact.color }}>
            {contact.shortName[0]}
          </span>
          {contact.shortName}
        </button>
      ))}
    </div>
  );
}

/** Teléfono, nombre y detalle del destinatario del SINPE. */
function RecipientFields({ phone, onPhoneChange, name, onNameChange, description, onDescriptionChange }) {
  return (
    <>
      <Field htmlFor="simulatorPhone" label="Número de teléfono">
        <input
          id="simulatorPhone"
          value={phone}
          inputMode="numeric"
          maxLength={9}
          placeholder="8000 0000"
          autoComplete="off"
          onChange={(event) => onPhoneChange(event.target.value)}
        />
      </Field>
      <Field htmlFor="simulatorName" label="Nombre del destinatario">
        <input
          id="simulatorName"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Como aparece en SINPE"
          autoComplete="off"
        />
      </Field>
      <Field htmlFor="simulatorDescription" label="Detalle (opcional)">
        <input
          id="simulatorDescription"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          maxLength={30}
          placeholder="Almuerzo, alquiler…"
        />
      </Field>
    </>
  );
}

/** Simula un SINPE Móvil enviado desde la app del banco. */
export function SinpeSimulatorModal() {
  const showSuccess = useSimulatorSuccess();
  const [bank, setBank] = useState('BAC');
  const [selectedContact, setSelectedContact] = useState(null);
  const [amountText, setAmountText] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const amountCents = textToCents(amountText);
  const canSend = amountCents > 0 && onlyDigits(phone).length === PHONE_LENGTH && name.trim().length > 1;

  const chooseContact = (index) => {
    const contact = SIMULATOR_CONTACTS[index];
    setSelectedContact(index);
    setPhone(formatPhone(contact.phone));
    setName(contact.fullName);
  };

  const send = () => {
    const counterparty = normalizeKey(name);
    const mail = buildBankMail({
      bank,
      type: 'sinpe',
      counterparty,
      amount: amountCents / 100,
      phone: onlyDigits(phone),
      description: normalizeKey(description) || null,
    });
    showSuccess(
      'Tu banco envió el SINPE',
      `Mandaste ${formatColonesShort(amountCents)} a ${toTitleCase(counterparty)}. Fíjate arriba: llega el correo del banco y Movo lo registra sin que hagas nada.`,
      mail,
      bank,
    );
  };

  return (
    <>
      <ModalHeader title="Simulador: SINPE desde tu banco" />
      <p className="meta">
        Esto representa lo que harías en la app de tu banco. Al enviar, el banco te manda un correo y Movo lo lee solo.
      </p>

      <ContactChips selectedIndex={selectedContact} onChoose={chooseContact} />
      <AmountInput value={amountText} onChange={setAmountText} />
      <RecipientFields
        phone={phone}
        onPhoneChange={(text) => setPhone(formatPhone(onlyDigits(text).slice(0, PHONE_LENGTH)))}
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
      />
      <BankChooser value={bank} onChange={setBank} />
      <button type="button" className="cta" disabled={!canSend} onClick={send}>
        {canSend ? `Enviar ${formatColonesShort(amountCents)}` : 'Enviar'}
      </button>
    </>
  );
}

/** Simula una compra con tarjeta en un comercio. */
export function PurchaseSimulatorModal() {
  const { services } = useSession();
  const showSuccess = useSimulatorSuccess();
  const [bank, setBank] = useState('BAC');
  const [currency, setCurrency] = useState(Currency.CRC);
  const [amountText, setAmountText] = useState('');
  const [merchant, setMerchant] = useState('');

  const amountCents = textToCents(amountText);
  const isDollars = currency === Currency.USD;
  const canPay = amountCents > 0 && merchant.trim().length > 1;
  const formatAmount = (cents) => (isDollars ? formatDollars(cents) : formatColonesShort(cents));
  const hint =
    isDollars && amountCents > 0
      ? `≈ ${formatColonesShort(amountCents * services.preferences.exchangeRate())} al tipo de cambio actual`
      : '';

  const pay = () => {
    const counterparty = normalizeKey(merchant);
    const mail = buildBankMail({ bank, type: 'tarjeta', counterparty, amount: amountCents / 100, currency });
    showSuccess(
      'Compra aprobada',
      `Pagaste ${formatAmount(amountCents)} en ${toTitleCase(counterparty)}. Ahora mira cómo llega la notificación del banco.`,
      mail,
      bank,
    );
  };

  return (
    <>
      <ModalHeader title="Simulador: compra con tarjeta" />
      <p className="meta">Imagina que pagas en un comercio. Tu banco te notifica por correo y Movo lo registra.</p>
      <AmountInput value={amountText} onChange={setAmountText} currencySymbol={isDollars ? '$' : '₡'} hint={hint} />
      <SegmentedControl label="Moneda" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
      <Field htmlFor="simulatorMerchant" label="Comercio">
        <input
          id="simulatorMerchant"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Nombre del comercio"
          autoComplete="off"
        />
      </Field>
      <div className="chips" role="group" aria-label="Comercios sugeridos">
        {MERCHANTS.slice(0, SUGGESTED_MERCHANTS).map((name) => (
          <button key={name} type="button" className="chip plain" onClick={() => setMerchant(name)}>
            {toTitleCase(name)}
          </button>
        ))}
      </div>
      <BankChooser value={bank} onChange={setBank} />
      <button type="button" className="cta" disabled={!canPay} onClick={pay}>
        {canPay ? `Pagar ${formatAmount(amountCents)}` : 'Pagar'}
      </button>
    </>
  );
}
