// Ajustes de la persona y estado local de la app.
//
// Los ajustes (presupuesto, búsqueda de Gmail) se sincronizan con el respaldo.
// El resto es estado de este teléfono: cuándo se leyó el correo, si el respaldo está activo, etc.

export const DEFAULT_MONTHLY_BUDGET_CENTS = 35_000_000; // ₡350 000
export const FALLBACK_EXCHANGE_RATE = 510; // colones por dólar, mientras no haya uno del servidor

/** Búsqueda de Gmail que usa Movo para encontrar notificaciones de bancos. */
export const DEFAULT_GMAIL_QUERY =
  '(from:baccr.com OR from:credomatic OR from:bncr.fi.cr OR from:bancobcr.com OR from:davivienda OR from:promerica OR subject:SINPE)';

const SETTING_BUDGET = 'budget';
const SETTING_GMAIL_QUERY = 'gmail_query';

export function createPreferences({ settings, meta }) {
  return {
    // ---- ajustes que se sincronizan ----
    budgetCents: () => settings.get(SETTING_BUDGET, DEFAULT_MONTHLY_BUDGET_CENTS),
    setBudgetCents: (cents) => settings.set(SETTING_BUDGET, cents),

    gmailQuery: () => settings.get(SETTING_GMAIL_QUERY, DEFAULT_GMAIL_QUERY),
    /** Al cambiar la búsqueda, la próxima lectura vuelve a revisar los últimos 45 días. */
    setGmailQuery(query) {
      settings.set(SETTING_GMAIL_QUERY, query.trim() || DEFAULT_GMAIL_QUERY);
      meta.set('last_scan', null);
    },

    // ---- tipo de cambio ----
    /** Último tipo de cambio guardado ({ rate, source, date }) o null. */
    exchangeRateInfo: () => meta.get('fx'),
    exchangeRate: () => meta.get('fx')?.rate || FALLBACK_EXCHANGE_RATE,

    // ---- estado de este teléfono ----
    lastScanAt: () => meta.get('last_scan'),
    markScanned: () => meta.set('last_scan', Date.now()),

    isCloudBackupEnabled: () => Boolean(meta.get('cloud')),
    setCloudBackupEnabled: (enabled) => meta.set('cloud', enabled),
    lastSyncAt: () => meta.get('last_sync'),
    wasDemoSeeded: () => Boolean(meta.get('seeded')),
    markDemoSeeded: () => meta.set('seeded', true),
  };
}
