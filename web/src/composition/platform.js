// Servicios propios del navegador y de Google que usa la interfaz.
// La interfaz importa de aquí y no de infrastructure/, para que las capas queden separadas.

export { backendApi } from '../infrastructure/backend/backendApi.js';
export { fetchGoogleProfile } from '../infrastructure/gmail/gmailMailSource.js';
export {
  clearSavedToken,
  getSavedToken,
  readSignInRedirect,
  startGoogleSignIn,
} from '../infrastructure/gmail/googleSignIn.js';
export {
  applyThemePreference,
  loadThemePreference,
  saveThemePreference,
  ThemePreference,
} from '../infrastructure/browser/themePreference.js';
export { DEMO_PROFILE, loadProfile, saveProfile } from '../infrastructure/browser/profileStorage.js';
export { downloadTextFile } from '../infrastructure/browser/downloadFile.js';
