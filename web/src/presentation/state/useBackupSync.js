import { useCallback } from 'react';
import { getSavedToken } from '../../composition/platform.js';
import { useSession } from './SessionProvider.jsx';
import { useToast } from './ToastProvider.jsx';

/**
 * Sincronizar el respaldo en la nube.
 * Con `quiet` no se muestran avisos (se usa cuando la app lo hace sola, sin que la persona lo pida).
 */
export function useBackupSync() {
  const { services, refresh } = useSession();
  const showToast = useToast();

  return useCallback(
    async ({ quiet = false } = {}) => {
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
    },
    [services, refresh, showToast],
  );
}
