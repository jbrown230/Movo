import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { openSession } from '../../composition/openSession.js';
import { backendApi, startGoogleSignIn } from '../../composition/platform.js';
import { resolveStartupProfile } from './resolveStartupProfile.js';
import { useSessionActions } from './useSessionActions.js';
import { useToast } from './ToastProvider.jsx';

/**
 * Quién está usando la app y sus datos.
 *
 * `phase`:
 *   - "starting":   todavía se está preparando
 *   - "signed-out": nadie ha entrado (pantalla de bienvenida)
 *   - "ready":      hay una sesión abierta con su base de datos
 *
 * `dataVersion` sube cada vez que cambian los datos. Las pantallas lo usan para volver a leerlos.
 */
const SessionContext = createContext(null);

const MESSAGE_DELAY_MS = 600;

export function SessionProvider({ children }) {
  const showToast = useToast();
  const [phase, setPhase] = useState('starting');
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null); // { services, flush, wipe }
  const [config, setConfig] = useState(null); // lo que dice el servidor: clientId de Google y respaldo
  const [dataVersion, setDataVersion] = useState(0);
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const refresh = useCallback(() => setDataVersion((version) => version + 1), []);
  const showToastLater = useCallback((message) => setTimeout(() => showToast(message), MESSAGE_DELAY_MS), [showToast]);

  /** Abre la base de datos de esta persona y deja la app lista. */
  const enterApp = useCallback(
    async (nextProfile) => {
      const opened = await openSession(nextProfile);
      if (nextProfile.demo) opened.services.seedDemoData();

      const fixedCount = opened.services.reparseIfParserChanged();
      setProfile(nextProfile);
      setSession(opened);
      setPhase('ready');

      if (fixedCount) {
        showToastLater(`El lector mejoró: ${fixedCount} correo(s) que antes no reconocía ahora son movimientos.`);
      }
      // El tipo de cambio es un extra: si el servidor no responde, se usa el último conocido.
      opened.services
        .refreshExchangeRate()
        .then((updated) => updated && refresh())
        .catch(() => {});
    },
    [refresh, showToastLater],
  );

  /** Deja de mostrar la sesión actual antes de cerrar su base de datos. */
  const detachSession = useCallback((nextPhase) => {
    const detached = sessionRef.current;
    setSession(null);
    setProfile(null);
    setPhase(nextPhase);
    return detached;
  }, []);

  /** Arranque: lee la configuración del servidor, recoge el regreso de Google (si lo hay) y entra. */
  const start = useCallback(async () => {
    const serverConfig = await backendApi.getConfig().catch(() => null);
    setConfig(serverConfig);

    const startup = await resolveStartupProfile(serverConfig);
    if (startup.message) showToastLater(startup.message);
    if (startup.restartSignIn)
      return startGoogleSignIn(startup.restartSignIn.clientId, { hint: startup.restartSignIn.hint });

    if (!startup.profile) return setPhase('signed-out');
    return enterApp(startup.profile);
  }, [enterApp, showToastLater]);

  useEffect(() => {
    start().catch((error) => {
      console.error(error);
      showToast('Error al iniciar: ' + error.message);
      setPhase('signed-out');
    });
    // Solo al abrir la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useSessionActions({ config, enterApp, detachSession });

  const value = useMemo(
    () => ({ phase, profile, config, dataVersion, refresh, services: session?.services ?? null, ...actions }),
    [phase, profile, config, dataVersion, refresh, session, actions],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return value;
}
