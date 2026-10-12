import { Icon } from '../components/Icon.jsx';
import { bankColor } from '../../domain/banks.js';
import { MailStatus } from '../../domain/types.js';
import { useAppData } from '../hooks/useAppData.js';
import { shortWhen } from '../format/dates.js';
import { MailModal } from '../modals/MailModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';

/** Etiqueta que dice qué pasó con el correo. */
function MailStatusTag({ status }) {
  switch (status) {
    case MailStatus.REGISTERED:
      return <span className="tag ok"><Icon name="check" width="12" height="12" /> Registrado</span>;
    case MailStatus.DECLINED:
      return <span className="tag neg">Negada por el banco</span>;
    case MailStatus.DISCARDED:
      return <span className="tag rev">Eliminado por ti</span>;
    default:
      return <span className="tag rev">Sin movimiento</span>;
  }
}

function MailRow({ mail }) {
  const { openModal } = useModal();
  return (
    <button type="button" className="mail" onClick={() => openModal(<MailModal mailId={mail.id} />)}>
      <span className="av" style={{ background: bankColor(mail.bank) }}>{(mail.bank || '?').slice(0, 3)}</span>
      <span className="mid">
        <div className="row">
          <span className="f">{mail.fromName || 'Remitente desconocido'}</span>
          <span className="tm">{shortWhen(mail.receivedAt)}</span>
        </div>
        <div className="s">{mail.subject || '(sin asunto)'}</div>
        <div className="p">{(mail.preview || '').replace(/\s+/g, ' ')}</div>
        <MailStatusTag status={mail.status} />
      </span>
    </button>
  );
}

/** Bandeja: los correos de bancos que Movo leyó en este teléfono. */
export function InboxScreen() {
  const { profile } = useSession();
  const { mails } = useAppData();

  return (
    <section aria-label="Bandeja">
      <div className="ihead">
        <h1>Bandeja</h1>
        <p>Correos de tus bancos que Movo leyó en este teléfono.</p>
      </div>
      <div className="group" style={{ margin: '12px 16px' }}>
        {mails.length
          ? mails.map((mail) => <MailRow key={mail.id} mail={mail} />)
          : (
            <div className="empty">
              {profile.demo ? 'Aún no hay correos.' : 'Todavía no he leído correos de tus bancos. Toca el botón de actualizar arriba.'}
            </div>
          )}
      </div>
    </section>
  );
}
