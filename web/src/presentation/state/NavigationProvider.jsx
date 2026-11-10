import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NO_MOVEMENT_FILTERS } from './movementFilters.js';

/**
 * Pantalla activa y movimiento resaltado.
 *
 * `view`: "home" (inicio), "movements" (movimientos), "inbox" (bandeja), "settings" (ajustes) o "goals" (metas).
 *   También queda en la dirección (ver HASH_OF_VIEW).
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

/**
 * La pantalla va en la dirección (`#movimientos`), así refrescar la página la conserva y el botón
 * Atrás vuelve a la anterior. Se usa el `#` y no una ruta como /movimientos: funciona sin conexión
 * y en cualquier servidor, sin que tenga que conocer esas rutas. El inicio no lleva nada.
 */
const HASH_OF_VIEW = Object.freeze({
  [Views.HOME]: '',
  [Views.MOVEMENTS]: '#movimientos',
  [Views.INBOX]: '#bandeja',
  [Views.SETTINGS]: '#ajustes',
  [Views.GOALS]: '#metas',
});
const VIEW_OF_HASH = Object.fromEntries(Object.entries(HASH_OF_VIEW).map(([view, hash]) => [hash, view]));

/** La pantalla que indica la dirección; cualquier otra cosa (o nada) es el inicio. */
const viewFromLocation = () => VIEW_OF_HASH[window.location.hash] ?? Views.HOME;

function pushViewToLocation(view) {
  const hash = HASH_OF_VIEW[view] ?? '';
  if (window.location.hash === hash) return;
  history.pushState(null, '', window.location.pathname + window.location.search + hash);
}

export function NavigationProvider({ children }) {
  const [view, setView] = useState(viewFromLocation);
  const [flashTransactionId, setFlashTransactionId] = useState(null);
  const [movementFilters, setMovementFilters] = useState(NO_MOVEMENT_FILTERS);
  const flashTimer = useRef(null);

  const goTo = useCallback((nextView) => {
    pushViewToLocation(nextView);
    setView(nextView);
    window.scrollTo({ top: 0 });
  }, []);

  // Atrás y Adelante del navegador (o del teléfono) cambian la dirección: la pantalla la sigue.
  useEffect(() => {
    const followLocation = () => setView(viewFromLocation());
    window.addEventListener('popstate', followLocation);
    return () => window.removeEventListener('popstate', followLocation);
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
