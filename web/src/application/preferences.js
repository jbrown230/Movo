// Ajustes de la persona y estado local de la app.
//
// Los ajustes (presupuesto, búsqueda de Gmail) se sincronizan con el respaldo.
// El resto es estado de este teléfono: cuándo se leyó el correo, si el respaldo está activo, etc.

import { LocalStateKey } from './localStateKeys.js';

export const DEFAULT_MONTHLY_BUDGET_CENTS = 35_000_000; // ₡350 000
export const FALLBACK_EXCHANGE_RATE = 510; // colones por dólar, mientras no haya uno del servidor

/**
 * Búsqueda de Gmail que usa Movo para encontrar notificaciones de bancos.
 * Del Banco Nacional solo se traen los comprobantes ("Voucher Digital"): el resto de lo que
 * envía ese remitente es publicidad y avisos que no son movimientos.
 */
export const DEFAULT_GMAIL_QUERY =
  '(from:baccr.com OR from:credomatic OR (from:bncr.fi.cr subject:"Voucher Digital") OR from:bancobcr.com OR from:davivienda OR from:promerica OR subject:SINPE)';

/** Nombres de los ajustes que se sincronizan. Deben coincidir con SYNCED_SETTING_NAMES de shared/backupContract.js. */
export const SettingName = Object.freeze({ BUDGET: 'budget', GMAIL_QUERY: 'gmail_query' });

export function createPreferences({ settings, localState }) {
  return {
    // ---- ajustes que se sincronizan ----
    budgetCents: () => settings.get(SettingName.BUDGET, DEFAULT_MONTHLY_BUDGET_CENTS),
    setBudgetCents: (cents) => settings.set(SettingName.BUDGET, cents),

    gmailQuery: () => settings.get(SettingName.GMAIL_QUERY, DEFAULT_GMAIL_QUERY),
    /** Al cambiar la búsqueda, la próxima lectura vuelve a revisar los últimos 45 días. */
    setGmailQuery(query) {
      settings.set(SettingName.GMAIL_QUERY, query.trim() || DEFAULT_GMAIL_QUERY);
      localState.set(LocalStateKey.LAST_SCAN_AT, null);
    },

    // ---- tipo de cambio ----
    /** Último tipo de cambio guardado ({ rate, source, date }) o null. */
    exchangeRateInfo: () => localState.get(LocalStateKey.EXCHANGE_RATE_INFO),
    exchangeRate: () => localState.get(LocalStateKey.EXCHANGE_RATE_INFO)?.rate || FALLBACK_EXCHANGE_RATE,

    // ---- estado de este teléfono ----
    lastScanAt: () => localState.get(LocalStateKey.LAST_SCAN_AT),
    markScanned: () => localState.set(LocalStateKey.LAST_SCAN_AT, Date.now()),

    isCloudBackupEnabled: () => Boolean(localState.get(LocalStateKey.CLOUD_BACKUP_ENABLED)),
    setCloudBackupEnabled: (enabled) => localState.set(LocalStateKey.CLOUD_BACKUP_ENABLED, enabled),
    lastSyncAt: () => localState.get(LocalStateKey.LAST_SYNC_AT),
    wasDemoSeeded: () => Boolean(localState.get(LocalStateKey.DEMO_DATA_LOADED)),
    markDemoSeeded: () => localState.set(LocalStateKey.DEMO_DATA_LOADED, true),
  };
}
