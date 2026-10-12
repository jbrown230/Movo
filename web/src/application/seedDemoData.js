// Caso de uso: cargar los datos de ejemplo del modo demo (una sola vez por base).

/**
 * @param {Object} dependencies
 * @param {(mail: import('../domain/types.js').IncomingMail) => unknown} dependencies.readMail
 * @param {ReturnType<import('./preferences.js').createPreferences>} dependencies.preferences
 * @param {(now: Date) => import('../domain/types.js').IncomingMail[]} dependencies.buildDemoMails  Correos de ejemplo.
 */
export function createSeedDemoData({ readMail, preferences, buildDemoMails }) {
  return function seedDemoData(now = new Date()) {
    if (preferences.wasDemoSeeded()) return;
    for (const mail of buildDemoMails(now)) readMail(mail);
    preferences.markDemoSeeded();
  };
}
