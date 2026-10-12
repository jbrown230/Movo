// Punto donde se conectan las capas: abre la base de un usuario y arma los casos de uso
// con las piezas reales (SQLite en el navegador, Gmail y la API de Movo).
// Es el único lugar que conoce a la vez la aplicación y la infraestructura.

import { createServices } from '../application/createServices.js';
import { openUserDatabase } from '../infrastructure/sqlite/openUserDatabase.js';
import { gmailMailSource } from '../infrastructure/gmail/gmailMailSource.js';
import { backendApi } from '../infrastructure/backend/backendApi.js';
import { buildDemoSeedMails } from '../demo/seedMails.js';

/**
 * @param {{sub: string, demo?: boolean}} profile
 * @returns {Promise<{services: ReturnType<typeof createServices>, flush: () => Promise<void>, wipe: () => Promise<void>}>}
 */
export async function openSession(profile) {
  const { storage, flush, wipe } = await openUserDatabase(profile.demo ? 'demo' : profile.sub);
  const services = createServices({
    storage,
    mailSource: gmailMailSource,
    backend: backendApi,
    buildDemoMails: buildDemoSeedMails,
  });
  return { services, flush, wipe };
}
