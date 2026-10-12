import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { displayName } from '../../domain/names.js';
import { clearSavedToken, getSavedToken, startGoogleSignIn } from '../../composition/platform.js';
import { formatColonesShort } from '../format/money.js';
import { useSession } from './SessionProvider.jsx';
import { useNavigation } from './NavigationProvider.jsx';
import { useToast } from './ToastProvider.jsx';

/**
 * Lectura del correo y respaldo en la nube: lo que depende de Internet.
 *
 * Expone `scan` (buscar correos), `reconnect` (pedir permiso otra vez a Google),
 * `syncBackup` y el estado para mostrar en la etiqueta de arriba.
 */
const GmailContext = createContext(null);

const SCAN_AGAIN_AFTER_MS = 120_000; // al volver a la app, se busca otra vez si pasaron más de 2 minutos

export function GmailProvider({ children }) {
  const { profile, services, config, refresh } = useSession();
  const { flashTransaction } = useNavigation();
  const showToast = useToast();
  const [progressText, setProgressText] = useState(null);
  const [, setTokenVersion] = useState(0); // fuerza redibujar cuando el token cambia
  const isScanning = useRef(false);

  const isDemo = Boolean(profile.demo);

  const reconnect = useCallback(() => {
    if (config?.googleClientId) startGoogleSignIn(config.googleClientId, { hint: profile.email, silent: true });
    else showToast('El servidor no tiene configurado Google.');
  }, [config, profile, showToast]);

  const syncBackup = useCallback(async ({ quiet = false } = {}) => {
    const token = getSavedToken();
    if (!token) {
      if (!quiet) showToast('Reconecta Gmail para sincronizar el respaldo.');
      return;
    }
    try {
      const { pushed, pulled } = await services.backup.syncNow(token);
      refresh();
      if (!quiet) showToast(`Respaldo al día: ${pushed} enviados, ${pulled} recibidos.`);
    } catch (error) {
      if (!quiet) showToast('No se pudo sincronizar: ' + error.message);
    }
  }, [services, refresh, showToast]);

  const scan = useCallback(async ({ quiet = false } = {}) => {
    if (isScanning.current || isDemo) return;

    const token = getSavedToken();
    if (!token) {
      setTokenVersion((version) => version + 1);
      if (!quiet) reconnect();
      return;
    }
    if (!navigator.onLine) {
      if (!quiet) showToast('Sin conexión. Busco correos cuando vuelva el Internet.');
      return;
    }

    isScanning.current = true;
    setProgressText('Buscando correos…');
    try {
      const { newTransactions, firstTransaction } = await services.scanInbox({
        token,
        onProgress: (done, total) => setProgressText(`Leyendo ${done} de ${total}…`),
      });
      if (firstTransaction) flashTransaction(firstTransaction.id);
      refresh();

      if (newTransactions === 1) {
        showToast(`Nuevo movimiento: ${displayName(firstTransaction.counterparty)}, ${formatColonesShort(firstTransaction.crcCents)}`);
      } else if (newTransactions > 1) {
        showToast(`${newTransactions} movimientos nuevos desde tu correo`);
      } else if (!quiet) {
        showToast('No hay notificaciones nuevas de tus bancos.');
      }
      if (services.preferences.isCloudBackupEnabled()) syncBackup({ quiet: true });
    } catch (error) {
      if (error.auth) {
        clearSavedToken();
        showToast('Tu sesión de Gmail venció. Toca "Reconectar Gmail".');
      } else {
        showToast('No se pudo leer Gmail: ' + error.message);
      }
    } finally {
      isScanning.current = false;
      setProgressText(null);
    }
  }, [isDemo, services, reconnect, refresh, flashTransaction, syncBackup, showToast]);

  // Al entrar, y cada vez que se vuelve a la app, se buscan correos nuevos en silencio.
  useEffect(() => {
    if (isDemo) return undefined;
    if (getSavedToken()) scan({ quiet: true });

    const scanWhenVisible = () => {
      const wasAwayLongEnough = Date.now() - (services.preferences.lastScanAt() || 0) > SCAN_AGAIN_AFTER_MS;
      if (document.visibilityState === 'visible' && getSavedToken() && wasAwayLongEnough) scan({ quiet: true });
    };
    document.addEventListener('visibilitychange', scanWhenVisible);
    return () => document.removeEventListener('visibilitychange', scanWhenVisible);
    // Solo al entrar con esta sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const value = useMemo(() => ({
    scan,
    reconnect,
    syncBackup,
    progressText,
    isConnected: Boolean(getSavedToken()),
  }), [scan, reconnect, syncBackup, progressText]);

  return <GmailContext.Provider value={value}>{children}</GmailContext.Provider>;
}

export function useGmail() {
  const value = useContext(GmailContext);
  if (!value) throw new Error('useGmail debe usarse dentro de <GmailProvider>');
  return value;
}
