import { useMemo } from 'react';
import { budgetAlerts } from '../../domain/budget.js';
import { Currency } from '../../domain/types.js';
import { useSession } from '../state/SessionProvider.jsx';

/**
 * Los datos que muestran las pantallas, leídos de la base local.
 * Se vuelven a leer solo cuando cambian (`dataVersion`).
 */
export function useAppData() {
  const { services, dataVersion } = useSession();

  return useMemo(() => {
    const { queries, preferences } = services;
    const summary = queries.getMonthSummary();
    const budgetCents = preferences.budgetCents();
    const categoryBudgets = preferences.categoryBudgets();
    const budgetAlertPercent = preferences.budgetAlertPercent();
    return {
      summary,
      budgetCents,
      categoryBudgets,
      budgetAlertPercent,
      budgetAlerts: budgetAlerts({ summary, budgetCents, categoryBudgets, alertPercent: budgetAlertPercent }),
      transactions: queries.listTransactions(),
      mails: queries.listMails(),
      exchangeRate: preferences.exchangeRate(),
      euroExchangeRate: preferences.exchangeRate(Currency.EUR),
      exchangeRateInfo: preferences.exchangeRateInfo(),
      isCloudBackupEnabled: preferences.isCloudBackupEnabled(),
      lastSyncAt: preferences.lastSyncAt(),
      pendingBackupCount: services.backup.pendingCount(),
      savingsGoals: services.savingsGoals.list(),
    };
    // dataVersion hace que se lea de nuevo después de cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, dataVersion]);
}
