import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { openSession } from '../../composition/openSession.js';
import {
  backendApi, clearSavedToken, DEMO_PROFILE, fetchGoogleProfile, loadProfile, readSignInRedirect,
  saveProfile, startGoogleSignIn,
} from '../../composition/platform.js';
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

const SIGN_IN_ERROR_DELAY_MS = 400;
const PARSER_MESSAGE_DELAY_MS = 600;

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

  /** Abre la base de datos de esta persona y deja la app lista. */
  const enterApp = useCallback(async (nextProfile) => {
    const opened = await openSession(nextProfile);
    if (nextProfile.demo) opened.services.seedDemoData();

    const fixedCount = opened.services.reparseIfParserChanged();
    setProfile(nextProfile);
    setSession(opened);
    setPhase('ready');

    if (fixedCount) {
      setTimeout(
        () => showToast(`El lector mejoró: ${fixedCount} correo(s) que antes no reconocía ahora son movimientos.`),
        PARSER_MESSAGE_DELAY_MS,
      );
    }
    // El tipo de cambio es un extra: si el servidor no responde, se usa el último conocido.
    opened.services.refreshExchangeRate().then((updated) => { if (updated) refresh(); }).catch(() => {});
  }, [refresh, showToast]);

  /** Arranque: lee la configuración del servidor, recoge el regreso de Google (si lo hay) y entra. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverConfig = await backendApi.getConfig().catch(() => null);
      if (cancelled) return;
      setConfig(serverConfig);

      let currentProfile = loadProfile();
      const redirect = readSignInRedirect();
      if (redirect?.token) {
        try {
          const google = await fetchGoogleProfile(redirect.token);
          currentProfile = { sub: google.sub, email: google.email, name: google.name || google.email, picture: google.picture || null };
          saveProfile(currentProfile);
        } catch {
          showToast('No se pudo leer tu perfil de Google. Intenta de nuevo.');
        }
      } else if (redirect?.error) {
        if (redirect.silent && serverConfig?.googleClientId) {
          startGoogleSignIn(serverConfig.googleClientId, { hint: currentProfile?.email });
          return;
        }
        const message = redirect.error === 'scope_denied'
          ? 'Para leer tus notificaciones, marca el permiso de Gmail al conectar.'
          : 'No se completó el inicio de sesión con Google.';
        setTimeout(() => showToast(message), SIGN_IN_ERROR_DELAY_MS);
      }

      if (!currentProfile) { setPhase('signed-out'); return; }
      await enterApp(currentProfile);
    })().catch((error) => {
      console.error(error);
      showToast('Error al iniciar: ' + error.message);
      setPhase('signed-out');
    });
    return () => { cancelled = true; };
  // Solo al abrir la app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Deja de mostrar la sesión actual antes de cerrar su base de datos. */
  const detachSession = useCallback((nextPhase) => {
    const detached = sessionRef.current;
    setSession(null);
    setProfile(null);
    setPhase(nextPhase);
    return detached;
  }, []);

  const actions = useMemo(() => ({
    signInWithGoogle: () => startGoogleSignIn(config.googleClientId),

    enterDemo: async () => {
      saveProfile(DEMO_PROFILE);
      await enterApp(DEMO_PROFILE);
    },

    /** Cierra sesión; los datos quedan guardados en el teléfono. */
    signOut: async () => {
      const closing = detachSession('signed-out');
      saveProfile(null);
      clearSavedToken();
      await closing?.flush().catch(() => {});
    },

    /** Borra la base de este teléfono y cierra sesión. */
    wipeLocalDataAndSignOut: async () => {
      const closing = detachSession('signed-out');
      saveProfile(null);
      clearSavedToken();
      await closing?.wipe();
    },

    exitDemo: async () => {
      const closing = detachSession('signed-out');
      saveProfile(null);
      await closing?.flush().catch(() => {});
    },

    /** Borra los datos de ejemplo y los carga de nuevo. */
    resetDemo: async () => {
      const closing = detachSession('starting');
      await closing?.wipe();
      await enterApp(DEMO_PROFILE);
    },
  }), [config, enterApp, detachSession]);

  const value = useMemo(() => ({
    phase, profile, config, dataVersion, refresh,
    services: session?.services ?? null,
    ...actions,
  }), [phase, profile, config, dataVersion, refresh, session, actions]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return value;
}
