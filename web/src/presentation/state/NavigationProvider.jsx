import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NO_MOVEMENT_FILTERS } from './movementFilters.js';

/**
 * Pantalla activa y movimiento resaltado.
 *
 * `view`: "home" (inicio), "movements" (movimientos), "inbox" (bandeja) o "settings" (ajustes).
 * `movementFilters`: los filtros de la vista de movimientos. Viven aquí para que se conserven al cambiar
 *   de pestaña, y para que otras pantallas puedan abrir esa vista ya filtrada (`showMovements`).
 * `filtersPanelRequest`: sube cada vez que otra pantalla pide abrir el panel de filtros al llegar.
 * `flashTransactionId`: el movimiento recién registrado, que se resalta un momento en la lista.
 */
const NavigationContext = createContext(null);

export const Views = Object.freeze({ HOME: 'home', MOVEMENTS: 'movements', INBOX: 'inbox', SETTINGS: 'settings' });

const FLASH_DURATION_MS = 2600;

export function NavigationProvider({ children }) {
  const [view, setView] = useState(Views.HOME);
  const [flashTransactionId, setFlashTransactionId] = useState(null);
  const [movementFilters, setMovementFilters] = useState(NO_MOVEMENT_FILTERS);
  const [filtersPanelRequest, setFiltersPanelRequest] = useState(0);
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

  /** Abre la vista de movimientos con esos filtros; con `openFilters`, también su panel de filtros. */
  const showMovements = useCallback(
    (filters, { openFilters = false } = {}) => {
      setMovementFilters(filters);
      if (openFilters) setFiltersPanelRequest((count) => count + 1);
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
      showMovements,
      filtersPanelRequest,
    }),
    [view, goTo, flashTransactionId, flashTransaction, movementFilters, showMovements, filtersPanelRequest],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation debe usarse dentro de <NavigationProvider>');
  return value;
}
