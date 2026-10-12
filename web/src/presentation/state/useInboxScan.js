import { useCallback, useRef, useState } from 'react';
import { displayName } from '../../domain/names.js';
import { clearSavedToken, getSavedToken } from '../../composition/platform.js';
import { formatColonesShort } from '../format/money.js';
import { useNavigation } from './NavigationProvider.jsx';
import { useSession } from './SessionProvider.jsx';
import { useToast } from './ToastProvider.jsx';

/** Qué se le dice a la persona después de buscar correos. Devuelve null si no hay nada que decir. */
function describeScanResult({ newTransactions, firstTransaction }, { quiet }) {
  if (newTransactions === 1) {
    return `Nuevo movimiento: ${displayName(firstTransaction.counterparty)}, ${formatColonesShort(firstTransaction.crcCents)}`;
  }
  if (newTransactions > 1) return `${newTransactions} movimientos nuevos desde tu correo`;
  return quiet ? null : 'No hay notificaciones nuevas de tus bancos.';
}

/**
 * Buscar correos nuevos de bancos en Gmail.
 *
 * @param {{ reconnect: () => void, syncBackup: (options?: {quiet?: boolean}) => Promise<void> }} actions
 * @returns {{ scan: (options?: {quiet?: boolean}) => Promise<void>, progressText: string|null, tokenVersion: number }}
 */
export function useInboxScan({ reconnect, syncBackup }) {
  const { profile, services, refresh } = useSession();
  const { flashTransaction } = useNavigation();
  const showToast = useToast();
  const [progressText, setProgressText] = useState(null);
  const [tokenVersion, setTokenVersion] = useState(0); // cambia cuando el token deja de servir, para redibujar
  const isScanning = useRef(false);

  const runScan = useCallback(
    async (token, { quiet }) => {
      setProgressText('Buscando correos…');
      try {
        const summary = await services.scanInbox({
          token,
          onProgress: (done, total) => setProgressText(`Leyendo ${done} de ${total}…`),
        });
        if (summary.firstTransaction) flashTransaction(summary.firstTransaction.id);
        refresh();

        const message = describeScanResult(summary, { quiet });
        if (message) showToast(message);
        if (services.preferences.isCloudBackupEnabled()) syncBackup({ quiet: true });
      } catch (error) {
        if (!error.auth) return showToast('No se pudo leer Gmail: ' + error.message);
        clearSavedToken();
        setTokenVersion((version) => version + 1);
        return showToast('Tu sesión de Gmail venció. Toca "Reconectar Gmail".');
      } finally {
        setProgressText(null);
      }
      return undefined;
    },
    [services, refresh, flashTransaction, syncBackup, showToast],
  );

  const scan = useCallback(
    async ({ quiet = false } = {}) => {
      if (isScanning.current || profile.demo) return;

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
      try {
        await runScan(token, { quiet });
      } finally {
        isScanning.current = false;
      }
    },
    [profile, reconnect, runScan, showToast],
  );

  return { scan, progressText, tokenVersion };
}
