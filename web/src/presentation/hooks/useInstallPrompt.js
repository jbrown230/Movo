import { useCallback, useEffect, useState } from 'react';

/**
 * Instalación de la app en el teléfono.
 *
 * Chrome avisa con el evento `beforeinstallprompt` cuando se puede instalar; la app lo guarda
 * para mostrar su propio botón. En iPhone no existe ese evento: hay que dar instrucciones.
 */
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const saveEvent = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener('beforeinstallprompt', saveEvent);
    return () => window.removeEventListener('beforeinstallprompt', saveEvent);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }, [installEvent]);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);

  return { canPromptInstall: Boolean(installEvent), promptInstall, isIos, isInstalled };
}
