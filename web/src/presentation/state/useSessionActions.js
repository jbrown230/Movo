import { useMemo } from 'react';
import { clearSavedToken, DEMO_PROFILE, saveProfile, startGoogleSignIn } from '../../composition/platform.js';

/**
 * Lo que la persona puede hacer con su sesión: entrar, salir, borrar datos.
 *
 * @param {Object} parts
 * @param {{googleClientId: string|null}|null} parts.config
 * @param {(profile: object) => Promise<void>} parts.enterApp
 * @param {(nextPhase: string) => {flush: () => Promise<void>, wipe: () => Promise<void>}|null} parts.detachSession
 */
export function useSessionActions({ config, enterApp, detachSession }) {
  return useMemo(
    () => ({
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
    }),
    [config, enterApp, detachSession],
  );
}
