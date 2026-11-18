// Caso de uso: buscar correos nuevos de bancos y registrar sus movimientos.

// La lectura de un correo espera a la red casi todo el tiempo, así que bajar varios a la vez acorta mucho la
// primera lectura. 6 queda lejos del límite de Gmail (unas 50 consultas de un correo por segundo por persona).
const PARALLEL_DOWNLOADS = 6;

/**
 * @typedef {Object} ScanSummary
 * @property {number} found                  Correos nuevos encontrados.
 * @property {number} newTransactions        Movimientos registrados.
 * @property {import('../domain/types.js').Transaction|null} firstTransaction  El primero que se registró.
 */

/**
 * @param {Object} dependencies
 * @param {() => Promise<void>} [dependencies.yieldToUi]  Le da un respiro a la pantalla (toques y dibujo) entre un
 *   correo y el siguiente. Leer un correo ocupa el hilo principal; sin esto, cientos seguidos dejan la app pegada.
 */
export function createScanInbox({ mailSource, readMail, mails, preferences, yieldToUi = () => Promise.resolve() }) {
  /**
   * @param {{ token: string, onProgress?: (done: number, total: number) => void }} options
   * @returns {Promise<ScanSummary>}
   */
  return async function scanInbox({ token, onProgress = () => {} }) {
    const query = preferences.gmailQuery();
    const ids = await mailSource.listNewMailIds({
      token,
      query,
      since: preferences.lastScanAtFor(query),
      isKnown: (id) => mails.exists({ id }),
    });

    const summary = { found: ids.length, newTransactions: 0, firstTransaction: null };
    const pending = [...ids];
    let done = 0;

    async function downloadAndRead() {
      while (pending.length) {
        const mail = await mailSource.fetchMail({ token, id: pending.shift() });
        const result = readMail(mail);
        if (result.transaction && !summary.firstTransaction) summary.firstTransaction = result.transaction;
        summary.newTransactions += result.transactions?.length || 0;
        onProgress(++done, ids.length);
        await yieldToUi();
      }
    }
    await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, downloadAndRead));

    preferences.markScanned(query);
    return summary;
  };
}
