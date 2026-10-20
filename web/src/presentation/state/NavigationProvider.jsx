import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NO_MOVEMENT_FILTERS } from './movementFilters.js';

/**
 * Pantalla activa y movimiento resaltado.
 *
 * `view`: "home" (inicio), "inbox" (bandeja) o "settings" (ajustes).
 * `movementFilters`: los filtros de la lista de movimientos del inicio. Viven aquí para que se conserven al
 *   cambiar de pestaña, y para que otras partes puedan filtrar esa lista (`filterMovements`).
 * `filtersPanelRequest`: sube cada vez que otra pantalla pide abrir el panel de filtros al llegar.
 * `flashTransactionId`: el movimiento recién registrado, que se resalta un momento en la lista.
 */
const NavigationContext = createContext(null);

export const Views = Object.freeze({ HOME: 'home', INBOX: 'inbox', SETTINGS: 'settings' });

/** Id del título de la lista de movimientos del inicio, para llevar la pantalla hasta ella al filtrar. */
export const HOME_MOVEMENTS_ANCHOR_ID = 'movimientos-del-inicio';

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

  /** Filtra la lista del inicio y lleva la pantalla hasta ella; con `openFilters`, abre también el panel. */
  const filterMovements = useCallback((filters, { openFilters = false } = {}) => {
    setMovementFilters(filters);
    if (openFilters) setFiltersPanelRequest((count) => count + 1);
    setView(Views.HOME);
    document.getElementById(HOME_MOVEMENTS_ANCHOR_ID)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

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
      filtersPanelRequest,
    }),
    [view, goTo, flashTransactionId, flashTransaction, movementFilters, filterMovements, filtersPanelRequest],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation debe usarse dentro de <NavigationProvider>');
  return value;
}
