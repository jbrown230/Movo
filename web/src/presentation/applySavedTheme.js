import { applyThemePreference, loadThemePreference } from '../composition/platform.js';

/**
 * Pone la apariencia guardada antes de dibujar la app, para que no se vea un destello
 * del tema equivocado al abrirla.
 */
export function applySavedTheme() {
  applyThemePreference(loadThemePreference());
}
