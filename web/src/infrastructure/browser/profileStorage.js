// Perfil de la persona que usa la app (guardado en este teléfono).

const PROFILE_KEY = 'movo:profile';

/** @typedef {{sub: string, name: string, email?: string, picture?: string|null, demo?: boolean}} Profile */

/** @returns {Profile|null} */
export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

/** Guarda el perfil, o lo borra si es null. */
export function saveProfile(profile) {
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(PROFILE_KEY);
}

export const DEMO_PROFILE = Object.freeze({ sub: 'demo', name: 'Modo demo', demo: true });
