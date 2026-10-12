// Apariencia de la app: automática (sigue al teléfono), clara u oscura.
//
// La elección se guarda solo en este teléfono (no se sincroniza). Para aplicarla se pone
// `data-theme` en <html>: los colores de cada tema están en presentation/styles/app.css.
// En modo automático se quita ese atributo y manda la configuración del teléfono.

const STORAGE_KEY = 'movo:theme';

export const ThemePreference = Object.freeze({
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark',
});

const VALID_PREFERENCES = Object.values(ThemePreference);

/** La preferencia guardada, o AUTO si no hay o no sirve. */
export function loadThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID_PREFERENCES.includes(saved) ? saved : ThemePreference.AUTO;
  } catch {
    return ThemePreference.AUTO; // el almacenamiento puede estar bloqueado (ventana privada, por ejemplo)
  }
}

export function saveThemePreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Si no se puede guardar, el tema igual se aplica mientras la app esté abierta.
  }
}

/** Cambia los colores de la pantalla ahora mismo. */
export function applyThemePreference(preference) {
  const root = document.documentElement;
  if (preference === ThemePreference.AUTO) delete root.dataset.theme;
  else root.dataset.theme = preference;
}
