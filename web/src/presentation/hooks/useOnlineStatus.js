import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** true si el teléfono tiene Internet. Se actualiza solo cuando cambia la conexión. */
export const useOnlineStatus = () => useSyncExternalStore(subscribe, () => navigator.onLine);
