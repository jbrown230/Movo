// Al abrir la app: ¿quién es la persona? Puede venir guardada en el teléfono, o puede estar
// regresando de la pantalla de permisos de Google (con el token en la dirección).

import { fetchGoogleProfile, loadProfile, readSignInRedirect, saveProfile } from '../../composition/platform.js';

const PROFILE_ERROR_MESSAGE = 'No se pudo leer tu perfil de Google. Intenta de nuevo.';
const SCOPE_DENIED_MESSAGE = 'Para leer tus notificaciones, marca el permiso de Gmail al conectar.';
const SIGN_IN_FAILED_MESSAGE = 'No se completó el inicio de sesión con Google.';

/**
 * @typedef {Object} StartupResult
 * @property {import('../../infrastructure/browser/profileStorage.js').Profile|null} profile  Quién entra (null: ir a la bienvenida).
 * @property {string} [message]     Aviso para mostrar a la persona.
 * @property {{clientId: string, hint?: string}} [restartSignIn]  Hay que volver a mandar a Google, esta vez con pantalla.
 */

async function profileFromGoogleToken(token, savedProfile) {
  try {
    const google = await fetchGoogleProfile(token);
    const profile = {
      sub: google.sub,
      email: google.email,
      name: google.name || google.email,
      picture: google.picture || null,
    };
    saveProfile(profile);
    return { profile };
  } catch {
    return { profile: savedProfile, message: PROFILE_ERROR_MESSAGE };
  }
}

function resultForFailedRedirect(redirect, savedProfile, serverConfig) {
  // Una renovación silenciosa falló (la sesión de Google ya no está activa): se pide iniciar sesión de nuevo.
  if (redirect.silent && serverConfig?.googleClientId) {
    return {
      profile: savedProfile,
      restartSignIn: { clientId: serverConfig.googleClientId, hint: savedProfile?.email },
    };
  }
  const message = redirect.error === 'scope_denied' ? SCOPE_DENIED_MESSAGE : SIGN_IN_FAILED_MESSAGE;
  return { profile: savedProfile, message };
}

/**
 * @param {{ googleClientId: string|null }|null} serverConfig  Lo que dijo el servidor (null si no respondió).
 * @returns {Promise<StartupResult>}
 */
export async function resolveStartupProfile(serverConfig) {
  const savedProfile = loadProfile();
  const redirect = readSignInRedirect();

  if (redirect?.token) return profileFromGoogleToken(redirect.token, savedProfile);
  if (redirect?.error) return resultForFailedRedirect(redirect, savedProfile, serverConfig);
  return { profile: savedProfile };
}
