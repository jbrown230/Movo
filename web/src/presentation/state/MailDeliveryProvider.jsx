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

  /** Muestra la notificación del banco y, paso a paso, registra el correo. */
  const deliverMail = useCallback((mail, bankKey) => {
    const bank = BANKS[bankKey];
    setNotification({ visible: true, bankKey, subject: mail.subject, mailId: mail.id });
    later(() => setNotification((current) => ({ ...current, visible: false })), NOTIFICATION_VISIBLE_MS);

    setPipeline({ visible: true, title: 'Leyendo correo', bankName: bank.name, doneSteps: 1 });

    for (let step = 1; step < READ_STEPS_BEFORE_REGISTERING; step++) {
      later(() => setPipeline((current) => ({ ...current, doneSteps: step + 1 })), STEP_INTERVAL_MS * step);
    }

    later(() => {
      const result = services.readMail(mail);
      if (result.transaction) flashTransaction(result.transaction.id);
      later(() => {
        setPipeline((current) => ({ ...current, doneSteps: STEPS.length, title: describeResult(result) }));
        refresh();
        later(() => setPipeline((current) => ({ ...current, visible: false })), PIPELINE_HIDE_DELAY_MS);
      }, REGISTER_DELAY_MS);
    }, STEP_INTERVAL_MS * (READ_STEPS_BEFORE_REGISTERING - 1));
  }, [later, services, flashTransaction, refresh]);

  const openDeliveredMail = () => {
    setNotification((current) => ({ ...current, visible: false }));
    openModal(<MailModal mailId={notification.mailId} />);
  };

  const bank = BANKS[notification.bankKey];
  const value = useMemo(() => ({ deliverMail }), [deliverMail]);

  return (
    <MailDeliveryContext.Provider value={value}>
      {children}

      <button type="button" className={`notif${notification.visible ? ' on' : ''}`} aria-live="polite" onClick={openDeliveredMail}>
        {bank && (
          <>
            <span className="av" style={{ background: bank.color }}>{notification.bankKey}</span>
            <span className="mid">
              <div className="row"><b>{bank.name}</b><span>ahora</span></div>
              <div className="s">{notification.subject}</div>
            </span>
          </>
        )}
      </button>

      <div className={`pipe${pipeline.visible ? ' on' : ''}`} aria-live="polite">
        <div className="ttl"><b>{pipeline.title}</b><span>{pipeline.bankName}</span></div>
        <div className="steps">
          {STEPS.map((label, index) => (
            <div key={label} className={index < pipeline.doneSteps ? 'done' : ''}><i />{label}</div>
          ))}
        </div>
      </div>
    </MailDeliveryContext.Provider>
  );
}

export const useMailDelivery = () => useContext(MailDeliveryContext);
