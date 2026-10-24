import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NO_MOVEMENT_FILTERS } from './movementFilters.js';

/**
 * Pantalla activa y movimiento resaltado.
 *
 * `view`: "home" (inicio), "movements" (movimientos), "inbox" (bandeja) o "settings" (ajustes).
 * `movementFilters`: los filtros de la pantalla de movimientos. Viven aquí para que se conserven al
 *   cambiar de pestaña, y para que otras partes puedan filtrar esa lista (`filterMovements`).
 * `flashTransactionId`: el movimiento recién registrado, que se resalta un momento en la lista.
 */
const NavigationContext = createContext(null);

/** Pantallas de la app. Metas no tiene pestaña: se abre desde el inicio y cuenta como parte de él. */
export const Views = Object.freeze({
  HOME: 'home',
  MOVEMENTS: 'movements',
  INBOX: 'inbox',
  SETTINGS: 'settings',
  GOALS: 'goals',
});

const FLASH_DURATION_MS = 2600;

export function NavigationProvider({ children }) {
  const [view, setView] = useState(Views.HOME);
  const [flashTransactionId, setFlashTransactionId] = useState(null);
  const [movementFilters, setMovementFilters] = useState(NO_MOVEMENT_FILTERS);
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

  /** Lleva a la pantalla de movimientos ya filtrada (por ejemplo, al tocar una categoría del inicio). */
  const filterMovements = useCallback(
    (filters) => {
      setMovementFilters(filters);
      goTo(Views.MOVEMENTS);
    },
    [goTo],
  );

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const value = useMemo(
    () => ({
      view,
      goTo,
      flashTransactionId,
      flashTransaction,
      movementFilters,
      setMovementFilters,
      filterMovements,
    }),
    [view, goTo, flashTransactionId, flashTransaction, movementFilters, filterMovements],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation debe usarse dentro de <NavigationProvider>');
  return value;
}
