// Casos de uso del respaldo opcional en la nube.
// Solo viajan los movimientos ya extraídos, las reglas y los ajustes; los correos se quedan en el teléfono.
// Protocolo: se sube lo pendiente y se baja lo que cambió desde el último cursor.

import { LocalStateKey } from './localStateKeys.js';

const MAX_ROUNDS = 20; // tope de seguridad contra bucles

export function createBackupSync({ backup, localState, backend }) {
  const countOf = (changes) => changes.transactions.length + changes.categoryRules.length + changes.settings.length;

  /**
   * Sincroniza hasta que no quede nada pendiente.
   * @returns {Promise<{pushed: number, pulled: number}>}
   */
  async function syncNow(token) {
    let pushed = 0;
    let pulled = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = backup.collectPending();
      const response = await backend.syncBackup({
        token,
        since: localState.get(LocalStateKey.SYNC_CURSOR, 0),
        changes: pending,
      });

      backup.markSynced(pending);
      pulled += backup.applyRemote(response.changes);
      pushed += countOf(pending);
      localState.set(LocalStateKey.SYNC_CURSOR, response.cursor);
      localState.set(LocalStateKey.LAST_SYNC_AT, Date.now());

      if (!response.hasMore && backup.pendingCount() === 0) break;
    }
    return { pushed, pulled };
  }

  /** Borra todo lo que el servidor guarda de esta persona. Lo del teléfono no se toca. */
  async function deleteCloudBackup(token) {
    await backend.deleteMyData({ token });
    localState.set(LocalStateKey.CLOUD_BACKUP_ENABLED, false);
    localState.set(LocalStateKey.SYNC_CURSOR, 0);
  }

  return { syncNow, deleteCloudBackup, pendingCount: () => backup.pendingCount() };
}
