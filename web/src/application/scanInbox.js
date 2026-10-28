// Caso de uso: buscar correos nuevos de bancos y registrar sus movimientos.

const PARALLEL_DOWNLOADS = 4;

/**
 * @typedef {Object} ScanSummary
 * @property {number} found                  Correos nuevos encontrados.
 * @property {number} newTransactions        Movimientos registrados.
 * @property {import('../domain/types.js').Transaction|null} firstTransaction  El primero que se registró.
 */

export function createScanInbox({ mailSource, readMail, mails, preferences }) {
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
      }
    }
    await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, downloadAndRead));

    preferences.markScanned(query);
    return summary;
  };
}
