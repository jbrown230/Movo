// Casos de uso del respaldo opcional en la nube.
// Solo viajan los movimientos ya extraídos, las reglas y los ajustes; los correos se quedan en el teléfono.
// Protocolo: se sube lo pendiente y se baja lo que cambió desde el último cursor.

const META_CURSOR = 'sync_cursor';
const META_LAST_SYNC = 'last_sync';
const META_CLOUD_ENABLED = 'cloud';
const MAX_ROUNDS = 20; // tope de seguridad contra bucles

export function createBackupSync({ backup, meta, backend }) {
  const countOf = (changes) => changes.tx.length + changes.rule.length + changes.setting.length;

  /**
   * Sincroniza hasta que no quede nada pendiente.
   * @returns {Promise<{pushed: number, pulled: number}>}
   */
  async function syncNow(token) {
    let pushed = 0;
    let pulled = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = backup.collectPending();
      const response = await backend.syncBackup({ token, since: meta.get(META_CURSOR, 0), changes: pending });

      backup.markSynced(pending);
      pulled += backup.applyRemote(response.changes || {});
      pushed += countOf(pending);
      meta.set(META_CURSOR, response.cursor);
      meta.set(META_LAST_SYNC, Date.now());

      if (!response.more && backup.pendingCount() === 0) break;
    }
    return { pushed, pulled };
  }

  /** Borra todo lo que el servidor guarda de esta persona. Lo del teléfono no se toca. */
  async function deleteCloudBackup(token) {
    await backend.deleteMyData({ token });
    meta.set(META_CLOUD_ENABLED, false);
    meta.set(META_CURSOR, 0);
  }

  return { syncNow, deleteCloudBackup, pendingCount: () => backup.pendingCount() };
}
