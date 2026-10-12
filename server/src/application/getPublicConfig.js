// Caso de uso: lo que el teléfono necesita saber de este servidor antes de iniciar sesión.

/**
 * @param {{ googleClientId: string, isBackupEnabled: boolean }} serverSettings
 * @returns {() => { googleClientId: string|null, cloudSync: boolean }}
 */
export function createGetPublicConfig({ googleClientId, isBackupEnabled }) {
  return () => ({ googleClientId: googleClientId || null, cloudSync: isBackupEnabled });
}
