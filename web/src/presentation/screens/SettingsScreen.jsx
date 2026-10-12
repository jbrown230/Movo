import { getSavedToken } from '../../composition/platform.js';
import { useAppData } from '../hooks/useAppData.js';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { shortWhen } from '../format/dates.js';
import { formatColonesShort } from '../format/money.js';
import { useConfirm } from '../modals/ConfirmModal.jsx';
import { BudgetModal, GmailQueryModal } from '../modals/SimpleModals.jsx';
import { useGmail } from '../state/GmailProvider.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

/** Una fila de una lista de ajustes: botón si tiene `onClick`, texto si no. */
function Row({ label, value, onClick, danger = false }) {
  const className = `row${danger ? ' danger' : ''}`;
  const content = (<><span>{label}</span>{value !== undefined && <b>{value}</b>}</>);
  return onClick
    ? <button type="button" className={className} onClick={onClick}>{content}</button>
    : <div className={className}>{content}</div>;
}

function ProfileHeader({ profile }) {
  const picture = profile.picture
    ? <img src={profile.picture} alt="" referrerPolicy="no-referrer" />
    : (profile.name || '?').slice(0, 1).toUpperCase();
  return (
    <div className="profile">
      <span className="pav">{picture}</span>
      <div>
        <b>{profile.name || ''}</b>
        <span>{profile.demo ? 'Datos de ejemplo, solo en este teléfono' : profile.email || ''}</span>
      </div>
    </div>
  );
}

function DemoSettings() {
  const { resetDemo, exitDemo } = useSession();
  const confirm = useConfirm();
  const showToast = useToast();
  return (
    <div className="group list">
      <Row
        label="Reiniciar datos de ejemplo"
        onClick={() => confirm({
          title: 'Reiniciar demo',
          text: 'Se borran los datos de ejemplo y se cargan de nuevo.',
          confirmLabel: 'Reiniciar',
          onConfirm: async () => { await resetDemo(); showToast('Demo reiniciada'); },
        })}
      />
      <Row label="Salir del modo demo" danger onClick={exitDemo} />
    </div>
  );
}

function GmailSettings() {
  const { openModal } = useModal();
  const { scan, reconnect, isConnected } = useGmail();
  return (
    <>
      <h2 className="sh">Gmail</h2>
      <div className="group list">
        <Row label="Estado" value={isConnected ? 'Conectado' : 'Desconectado'} />
        <Row label="Buscar correos ahora" onClick={() => scan()} />
        {!isConnected && <Row label="Reconectar Gmail" onClick={reconnect} />}
        <Row label="Bancos que se leen" value="Editar" onClick={() => openModal(<GmailQueryModal />)} />
        <p className="hint">Movo lee tu correo desde este teléfono, con permiso de solo lectura. Los correos no se envían al servidor.</p>
      </div>
    </>
  );
}

function CloudBackupSettings() {
  const { services, config, refresh } = useSession();
  const { syncBackup } = useGmail();
  const { isCloudBackupEnabled, lastSyncAt, pendingBackupCount } = useAppData();
  const confirm = useConfirm();
  const showToast = useToast();
  const isAvailable = Boolean(config?.cloudSync);

  const toggle = (event) => {
    services.preferences.setCloudBackupEnabled(event.target.checked);
    refresh();
    if (event.target.checked) syncBackup();
  };

  const deleteBackup = () => confirm({
    title: 'Borrar respaldo',
    text: 'Se eliminan del servidor todos tus movimientos, reglas y ajustes. Lo que hay en este teléfono no se toca.',
    confirmLabel: 'Borrar respaldo',
    onConfirm: async () => {
      const token = getSavedToken();
      if (!token) { showToast('Reconecta Gmail para borrar el respaldo.'); return; }
      try {
        await services.backup.deleteCloudBackup(token);
        refresh();
        showToast('Respaldo borrado del servidor.');
      } catch (error) {
        showToast('No se pudo borrar: ' + error.message);
      }
    },
  });

  return (
    <>
      <h2 className="sh">Respaldo en la nube</h2>
      <div className="group list">
        <label className="row">
          <span>Respaldar mis movimientos</span>
          <input type="checkbox" className="switch" checked={isCloudBackupEnabled} disabled={!isAvailable} onChange={toggle} />
        </label>
        {isCloudBackupEnabled && (
          <>
            <Row label="Sincronizar ahora" value={lastSyncAt ? shortWhen(new Date(lastSyncAt).toISOString()) : 'Nunca'} onClick={() => syncBackup()} />
            <Row label="Cambios pendientes" value={pendingBackupCount} />
          </>
        )}
        <p className="hint">
          {isAvailable
            ? 'Opcional. Sirve para usar varios teléfonos o no perder datos. Solo se guardan movimientos, reglas y presupuesto; nunca tus correos.'
            : 'Este servidor no tiene respaldo habilitado.'}
        </p>
        {isCloudBackupEnabled && <Row label="Borrar mi respaldo del servidor" danger onClick={deleteBackup} />}
      </div>
    </>
  );
}

function AccountSettings() {
  const { signOut, wipeLocalDataAndSignOut } = useSession();
  const confirm = useConfirm();
  return (
    <>
      <h2 className="sh">Cuenta</h2>
      <div className="group list">
        <Row
          label="Cerrar sesión"
          onClick={() => confirm({
            title: 'Cerrar sesión',
            text: 'Tus datos quedan guardados en este teléfono y vuelven al iniciar sesión de nuevo.',
            confirmLabel: 'Cerrar sesión',
            onConfirm: signOut,
          })}
        />
        <Row
          label="Borrar mis datos de este teléfono" danger
          onClick={() => confirm({
            title: 'Borrar datos del teléfono',
            text: 'Se borran tus movimientos y correos leídos de este teléfono. Si tienes respaldo, puedes recuperarlos al volver a entrar.',
            confirmLabel: 'Borrar y salir',
            onConfirm: wipeLocalDataAndSignOut,
          })}
        />
      </div>
    </>
  );
}

function InstallSettings() {
  const { canPromptInstall, promptInstall, isIos, isInstalled } = useInstallPrompt();
  if (isInstalled) return null;
  return (
    <div className="group list">
      {canPromptInstall
        ? <Row label="Instalar Movo en este teléfono" onClick={promptInstall} />
        : (
          <>
            <Row label="Instalar la app" />
            <p className="hint">
              {isIos
                ? 'En Safari: botón Compartir y luego "Agregar a pantalla de inicio".'
                : 'En Chrome: menú ⋮ y luego "Instalar app" o "Agregar a pantalla principal".'}
            </p>
          </>
        )}
    </div>
  );
}

/** Ajustes: presupuesto, Gmail, respaldo en la nube y cuenta. */
export function SettingsScreen() {
  const { profile } = useSession();
  const { openModal } = useModal();
  const { budgetCents, exchangeRate, exchangeRateInfo } = useAppData();

  const exchangeRateSource = exchangeRateInfo?.source
    ? `Fuente: ${exchangeRateInfo.source}${exchangeRateInfo.date ? ', ' + exchangeRateInfo.date : ''}`
    : 'Valor de referencia hasta conectar con el servidor.';

  return (
    <section aria-label="Ajustes">
      <div className="ihead"><h1>Ajustes</h1></div>
      <div className="settings">
        <ProfileHeader profile={profile} />
        <div className="group list">
          <Row label="Presupuesto mensual" value={formatColonesShort(budgetCents)} onClick={() => openModal(<BudgetModal />)} />
          <Row label="Tipo de cambio del dólar" value={`₡${exchangeRate.toFixed(2)}`} />
          <p className="hint">{exchangeRateSource}</p>
        </div>

        {profile.demo ? <DemoSettings /> : (<><GmailSettings /><CloudBackupSettings /><AccountSettings /></>)}
        <InstallSettings />
        <p className="foot">Movo · código abierto (MIT)</p>
      </div>
    </section>
  );
}
