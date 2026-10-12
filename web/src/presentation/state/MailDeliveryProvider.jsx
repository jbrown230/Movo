import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BANKS } from '../../domain/banks.js';
import { getCategory } from '../../domain/categories.js';
import { MailStatus } from '../../domain/types.js';
import { formatColonesShort } from '../format/money.js';
import { MailModal } from '../modals/MailModal.jsx';
import { useModal } from './ModalProvider.jsx';
import { useNavigation } from './NavigationProvider.jsx';
import { useSession } from './SessionProvider.jsx';

/**
 * Animación del modo demo: llega la notificación del banco y Movo "lee" el correo.
 * Muestra el aviso arriba y una barra de 4 pasos abajo (Recibido, Leído, Extraído, Registrado).
 */
const MailDeliveryContext = createContext({ deliverMail: () => {} });

const STEPS = ['Recibido', 'Leído', 'Extraído', 'Registrado'];
const NOTIFICATION_VISIBLE_MS = 4200;
const STEP_INTERVAL_MS = 620;
const REGISTER_DELAY_MS = 520;
const PIPELINE_HIDE_DELAY_MS = 2200;
const READ_STEPS_BEFORE_REGISTERING = 3;

function describeResult(result) {
  if (result.transaction) {
    const categoryName = getCategory(result.transaction.category).name;
    return `Registrado: ${formatColonesShort(result.transaction.crcCents)} en ${categoryName}`;
  }
  return result.status === MailStatus.DECLINED ? 'Transacción negada: no se registra' : 'Correo guardado para revisión';
}

/** El aviso que "llega" arriba, como una notificación del teléfono. */
function BankNotification({ notification, onOpen }) {
  const bank = BANKS[notification.bankKey];
  return (
    <button type="button" className={`notif${notification.visible ? ' on' : ''}`} aria-live="polite" onClick={onOpen}>
      {bank && (
        <>
          <span className="av" style={{ background: bank.color }}>
            {notification.bankKey}
          </span>
          <span className="mid">
            <div className="row">
              <b>{bank.name}</b>
              <span>ahora</span>
            </div>
            <div className="s">{notification.subject}</div>
          </span>
        </>
      )}
    </button>
  );
}

/** La barra de abajo con los 4 pasos: Recibido, Leído, Extraído, Registrado. */
function ReadingProgress({ pipeline }) {
  return (
    <div className={`pipe${pipeline.visible ? ' on' : ''}`} aria-live="polite">
      <div className="ttl">
        <b>{pipeline.title}</b>
        <span>{pipeline.bankName}</span>
      </div>
      <div className="steps">
        {STEPS.map((label, index) => (
          <div key={label} className={index < pipeline.doneSteps ? 'done' : ''}>
            <i />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MailDeliveryProvider({ children }) {
  const { services, refresh } = useSession();
  const { openModal } = useModal();
  const { flashTransaction } = useNavigation();
  const [notification, setNotification] = useState({ visible: false, bankKey: null, subject: '', mailId: null });
  const [pipeline, setPipeline] = useState({ visible: false, title: 'Leyendo correo', bankName: '', doneSteps: 0 });
  const timers = useRef([]);

  const later = useCallback((callback, delay) => {
    timers.current.push(setTimeout(callback, delay));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Muestra la notificación del banco y, paso a paso, registra el correo.
   * Línea de tiempo (en milisegundos): 0 aviso y paso 1 · 620 paso 2 · 1240 paso 3 y lectura ·
   * 1760 paso 4 y resultado · 3960 se oculta la barra.
   */
  const deliverMail = useCallback(
    (mail, bankKey) => {
      const showSteps = (doneSteps) => setPipeline((current) => ({ ...current, doneSteps }));
      const readAt = STEP_INTERVAL_MS * (READ_STEPS_BEFORE_REGISTERING - 1);
      const finishAt = readAt + REGISTER_DELAY_MS;
      let result = null;

      setNotification({ visible: true, bankKey, subject: mail.subject, mailId: mail.id });
      setPipeline({ visible: true, title: 'Leyendo correo', bankName: BANKS[bankKey].name, doneSteps: 1 });

      later(() => setNotification((current) => ({ ...current, visible: false })), NOTIFICATION_VISIBLE_MS);
      later(() => showSteps(2), STEP_INTERVAL_MS);
      later(() => {
        showSteps(READ_STEPS_BEFORE_REGISTERING);
        result = services.readMail(mail);
        if (result.transaction) flashTransaction(result.transaction.id);
      }, readAt);
      later(() => {
        setPipeline((current) => ({ ...current, doneSteps: STEPS.length, title: describeResult(result) }));
        refresh();
      }, finishAt);
      later(() => setPipeline((current) => ({ ...current, visible: false })), finishAt + PIPELINE_HIDE_DELAY_MS);
    },
    [later, services, flashTransaction, refresh],
  );

  const openDeliveredMail = () => {
    setNotification((current) => ({ ...current, visible: false }));
    openModal(<MailModal mailId={notification.mailId} />);
  };

  const value = useMemo(() => ({ deliverMail }), [deliverMail]);

  return (
    <MailDeliveryContext.Provider value={value}>
      {children}
      <BankNotification notification={notification} onOpen={openDeliveredMail} />
      <ReadingProgress pipeline={pipeline} />
    </MailDeliveryContext.Provider>
  );
}

export const useMailDelivery = () => useContext(MailDeliveryContext);
