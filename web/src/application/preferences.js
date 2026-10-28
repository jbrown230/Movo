// Ajustes de la persona y estado local de la app.
//
// Los ajustes (presupuestos, aviso del presupuesto, búsqueda de Gmail) se sincronizan con el respaldo.
// El resto es estado de este teléfono: cuándo se leyó el correo, si el respaldo está activo, etc.

import { DEFAULT_ALERT_PERCENT, sanitizeCategoryBudgets, toAlertPercent } from '../domain/budget.js';
import { Currency } from '../domain/types.js';
import { exchangeRatesOn, latestRate } from './exchangeRates.js';
import { LocalStateKey } from './localStateKeys.js';

export const DEFAULT_MONTHLY_BUDGET_CENTS = 35_000_000; // ₡350 000
export const FALLBACK_EXCHANGE_RATE = 510; // colones por dólar, mientras no haya uno del servidor

/**
 * Búsqueda de Gmail que usa Movo para encontrar notificaciones de bancos.
 * Del Banco Nacional solo se traen los comprobantes ("Voucher Digital"): el resto de lo que
 * envía ese remitente es publicidad y avisos que no son movimientos. De Davivienda, solo el
 * remitente de las notificaciones: los estados de cuenta llegan de otra dirección y no traen movimientos.
 */
export const DEFAULT_GMAIL_QUERY =
  '(from:baccr.com OR from:baccredomatic.cr OR (from:bncr.fi.cr subject:"Voucher Digital") OR from:bancobcr.com OR from:bancavirtual@davivienda.cr OR from:bpdc.fi.cr OR from:bancopopularinforma.fi.cr OR from:promerica OR subject:SINPE)';

/** Nombres de los ajustes que se sincronizan. Deben coincidir con SYNCED_SETTING_NAMES de shared/backupContract.js. */
export const SettingName = Object.freeze({
  BUDGET: 'budget',
  CATEGORY_BUDGETS: 'category_budgets',
  BUDGET_ALERT_PERCENT: 'budget_alert_percent',
  GMAIL_QUERY: 'gmail_query',
});

/**
 * Los presupuestos por categoría se guardan como texto JSON: el respaldo solo acepta ajustes de texto,
 * número o booleano. Si el texto está dañado, se lee como "sin presupuestos por categoría".
 */
function parseCategoryBudgets(text) {
  try {
    return sanitizeCategoryBudgets(JSON.parse(text));
  } catch {
    return {};
  }
}

export function createPreferences({ settings, localState }) {
  const exchangeRateInfo = () => localState.get(LocalStateKey.EXCHANGE_RATE_INFO);

  return {
    // ---- ajustes que se sincronizan ----
    budgetCents: () => settings.get(SettingName.BUDGET, DEFAULT_MONTHLY_BUDGET_CENTS),
    setBudgetCents: (cents) => settings.set(SettingName.BUDGET, cents),

    /** Presupuesto de cada categoría que tiene uno, en céntimos: `{ comida: 5000000 }`. */
    categoryBudgets: () => parseCategoryBudgets(settings.get(SettingName.CATEGORY_BUDGETS, '{}')),
    setCategoryBudgets: (budgets) =>
      settings.set(SettingName.CATEGORY_BUDGETS, JSON.stringify(sanitizeCategoryBudgets(budgets))),

    /** Porcentaje del presupuesto al que se avisa (el 100 % siempre avisa). */
    budgetAlertPercent: () => toAlertPercent(settings.get(SettingName.BUDGET_ALERT_PERCENT, DEFAULT_ALERT_PERCENT)),
    setBudgetAlertPercent: (percent) => settings.set(SettingName.BUDGET_ALERT_PERCENT, toAlertPercent(percent)),

    gmailQuery: () => settings.get(SettingName.GMAIL_QUERY, DEFAULT_GMAIL_QUERY),
    /** Al cambiar la búsqueda, la próxima lectura vuelve a revisar los últimos 45 días. */
    setGmailQuery(query) {
      settings.set(SettingName.GMAIL_QUERY, query.trim() || DEFAULT_GMAIL_QUERY);
      localState.set(LocalStateKey.LAST_SCAN_AT, null);
    },

    // ---- tipo de cambio ----
    /** Último tipo de cambio guardado ({ rate, source, date, euro, history }) o null. */
    exchangeRateInfo,
    /**
     * Colones por unidad de la moneda, hoy. El dólar tiene un valor de reserva; el euro no:
     * sin dato del servidor es null, y sus compras se convierten cuando llegue.
     */
    exchangeRate: (currency = Currency.USD) =>
      latestRate(exchangeRateInfo(), currency) ?? (currency === Currency.USD ? FALLBACK_EXCHANGE_RATE : null),
    /** Colones por dólar y por euro para un movimiento de esa fecha: los de su día, si se conocen. */
    exchangeRatesOn(dateIso) {
      const rates = exchangeRatesOn(exchangeRateInfo(), dateIso);
      return { ...rates, [Currency.USD]: rates[Currency.USD] ?? FALLBACK_EXCHANGE_RATE };
    },

    // ---- estado de este teléfono ----
    lastScanAt: () => localState.get(LocalStateKey.LAST_SCAN_AT),
    /**
     * Desde cuándo pedir correos nuevos con esta búsqueda: la última lectura hecha con ELLA. Si la búsqueda es
     * otra (por ejemplo, una versión nueva agregó un banco a la búsqueda por defecto), devuelve null y la
     * lectura vuelve a revisar los últimos 45 días; los correos ya leídos no se descargan otra vez.
     */
    lastScanAtFor: (query) =>
      localState.get(LocalStateKey.LAST_SCAN_QUERY) === query ? localState.get(LocalStateKey.LAST_SCAN_AT) : null,
    /** Anota que se leyó el correo con esta búsqueda. */
    markScanned(query) {
      localState.set(LocalStateKey.LAST_SCAN_AT, Date.now());
      localState.set(LocalStateKey.LAST_SCAN_QUERY, query);
    },

    isCloudBackupEnabled: () => Boolean(localState.get(LocalStateKey.CLOUD_BACKUP_ENABLED)),
    setCloudBackupEnabled: (enabled) => localState.set(LocalStateKey.CLOUD_BACKUP_ENABLED, enabled),
    lastSyncAt: () => localState.get(LocalStateKey.LAST_SYNC_AT),
    wasDemoSeeded: () => Boolean(localState.get(LocalStateKey.DEMO_DATA_LOADED)),
    markDemoSeeded: () => localState.set(LocalStateKey.DEMO_DATA_LOADED, true),
  };
}
