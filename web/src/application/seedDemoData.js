// Caso de uso: cargar los datos de ejemplo del modo demo (una sola vez por base).

import { buildDemoSeedMails } from '../demo/seedMails.js';

export function createSeedDemoData({ readMail, preferences }) {
  return function seedDemoData(now = new Date()) {
    if (preferences.wasDemoSeeded()) return;
    for (const mail of buildDemoSeedMails(now)) readMail(mail);
    preferences.markDemoSeeded();
  };
}
