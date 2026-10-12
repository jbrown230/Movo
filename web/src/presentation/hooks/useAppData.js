import { useMemo } from 'react';
import { useSession } from '../state/SessionProvider.jsx';

/**
 * Los datos que muestran las pantallas, leídos de la base local.
 * Se vuelven a leer solo cuando cambian (`dataVersion`).
 */
export function useAppData() {
  const { services, dataVersion } = useSession();

  return useMemo(() => {
    const { queries, preferences } = services;
    return {
      summary: queries.getMonthSummary(),
      budgetCents: preferences.budgetCents(),
      transactions: queries.listTransactions(),
      mails: queries.listMails(),
      exchangeRate: preferences.exchangeRate(),
      exchangeRateInfo: preferences.exchangeRateInfo(),
      isCloudBackupEnabled: preferences.isCloudBackupEnabled(),
      lastSyncAt: preferences.lastSyncAt(),
      pendingBackupCount: services.backup.pendingCount(),
    };
    // dataVersion hace que se lea de nuevo después de cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, dataVersion]);
}
