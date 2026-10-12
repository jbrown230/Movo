import { useCallback, useState } from 'react';
import { applyThemePreference, loadThemePreference, saveThemePreference } from '../../composition/platform.js';

/**
 * La apariencia que eligió la persona: "auto", "light" o "dark".
 * Al cambiarla se guarda en este teléfono y se aplica al instante.
 */
export function useThemePreference() {
  const [preference, setPreference] = useState(loadThemePreference);

  const choosePreference = useCallback((nextPreference) => {
    saveThemePreference(nextPreference);
    applyThemePreference(nextPreference);
    setPreference(nextPreference);
  }, []);

  return { preference, choosePreference };
}
