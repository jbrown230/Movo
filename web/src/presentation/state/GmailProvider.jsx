import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { getSavedToken, startGoogleSignIn } from '../../composition/platform.js';
import { useBackupSync } from './useBackupSync.js';
import { useInboxScan } from './useInboxScan.js';
import { useSession } from './SessionProvider.jsx';
import { useToast } from './ToastProvider.jsx';

/**
 * Lectura del correo y respaldo en la nube: lo que depende de Internet.
 *
 * Expone `scan` (buscar correos), `reconnect` (pedir permiso otra vez a Google),
 * `syncBackup` y el estado para mostrar en la etiqueta de arriba.
 */
const GmailContext = createContext(null);

const SCAN_AGAIN_AFTER_MS = 120_000; // al volver a la app, se busca otra vez si pasaron más de 2 minutos
// Al entrar, la primera pantalla se dibuja antes de empezar a leer. Si arrancan a la vez (sobre todo en la primera
// lectura, con cientos de correos), la pantalla de inicio tarda en responder.
const FIRST_SCAN_DELAY_MS = 600;

/** Busca correos en silencio al entrar y cada vez que la persona vuelve a la app. */
function useAutomaticScan({ scan, services, isDemo }) {
  useEffect(() => {
    if (isDemo) return undefined;
    const firstScan = getSavedToken() ? setTimeout(() => scan({ quiet: true }), FIRST_SCAN_DELAY_MS) : null;

    const scanWhenVisible = () => {
      const wasAwayLongEnough = Date.now() - (services.preferences.lastScanAt() || 0) > SCAN_AGAIN_AFTER_MS;
      if (document.visibilityState === 'visible' && getSavedToken() && wasAwayLongEnough) scan({ quiet: true });
    };
    document.addEventListener('visibilitychange', scanWhenVisible);
    return () => {
      clearTimeout(firstScan);
      document.removeEventListener('visibilitychange', scanWhenVisible);
    };
    // Solo al entrar con esta sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);
}

export function GmailProvider({ children }) {
  const { profile, services, config } = useSession();
  const showToast = useToast();

  const reconnect = useCallback(() => {
    if (config?.googleClientId) startGoogleSignIn(config.googleClientId, { hint: profile.email, silent: true });
    else showToast('El servidor no tiene configurado Google.');
  }, [config, profile, showToast]);

  const syncBackup = useBackupSync();
  const { scan, progressText, tokenVersion } = useInboxScan({ reconnect, syncBackup });
  useAutomaticScan({ scan, services, isDemo: Boolean(profile.demo) });

  const value = useMemo(
    () => ({ scan, reconnect, syncBackup, progressText, isConnected: Boolean(getSavedToken()) }),
    // tokenVersion cambia cuando el token deja de servir, para que `isConnected` se vuelva a calcular.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scan, reconnect, syncBackup, progressText, tokenVersion],
  );

  return <GmailContext.Provider value={value}>{children}</GmailContext.Provider>;
}

export function useGmail() {
  const value = useContext(GmailContext);
  if (!value) throw new Error('useGmail debe usarse dentro de <GmailProvider>');
  return value;
}
