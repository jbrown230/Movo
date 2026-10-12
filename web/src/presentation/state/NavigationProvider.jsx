import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Pantalla activa y movimiento resaltado.
 *
 * `view`: "home" (inicio), "inbox" (bandeja) o "settings" (ajustes).
 * `flashTransactionId`: el movimiento recién registrado, que se resalta un momento en la lista.
 */
const NavigationContext = createContext(null);

export const Views = Object.freeze({ HOME: 'home', INBOX: 'inbox', SETTINGS: 'settings' });

const FLASH_DURATION_MS = 2600;

export function NavigationProvider({ children }) {
  const [view, setView] = useState(Views.HOME);
  const [flashTransactionId, setFlashTransactionId] = useState(null);
  const flashTimer = useRef(null);

  const goTo = useCallback((nextView) => {
    setView(nextView);
    window.scrollTo({ top: 0 });
  }, []);

  const flashTransaction = useCallback((transactionId) => {
    setFlashTransactionId(transactionId);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashTransactionId(null), FLASH_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const value = useMemo(
    () => ({ view, goTo, flashTransactionId, flashTransaction }),
    [view, goTo, flashTransactionId, flashTransaction],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation debe usarse dentro de <NavigationProvider>');
  return value;
}
