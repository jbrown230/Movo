import { useEffect } from 'react';
import { BottomNav } from './screens/BottomNav.jsx';
import { GoalsScreen } from './screens/GoalsScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { InboxScreen } from './screens/InboxScreen.jsx';
import { MovementsScreen } from './screens/MovementsScreen.jsx';
import { OnboardingScreen } from './screens/OnboardingScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { PasteModal } from './modals/SimpleModals.jsx';
import { GmailProvider } from './state/GmailProvider.jsx';
import { MailDeliveryProvider } from './state/MailDeliveryProvider.jsx';
import { ModalProvider, ModalSheet, useModal } from './state/ModalProvider.jsx';
import { NavigationProvider, Views, useNavigation } from './state/NavigationProvider.jsx';
import { SessionProvider, useSession } from './state/SessionProvider.jsx';
import { ToastProvider } from './state/ToastProvider.jsx';

/**
 * Cuando otra app comparte un texto con Movo (la PWA es destino de "Compartir"),
 * llega en la dirección como ?text=... y se abre el lector con ese texto.
 */
function useSharedTextFromOtherApps() {
  const { openModal } = useModal();
  useEffect(() => {
    const sharedText = new URLSearchParams(window.location.search).get('text');
    if (!sharedText) return;
    history.replaceState(null, '', '/');
    openModal(<PasteModal prefill={sharedText} />);
  }, [openModal]);
}

/** Las pantallas principales; solo la activa se ve, las otras quedan ocultas pero conservan su estado. */
function MainScreens() {
  const { view } = useNavigation();
  useSharedTextFromOtherApps();

  return (
    <>
      <div className="app">
        <div hidden={view !== Views.HOME}>
          <HomeScreen />
        </div>
        <div hidden={view !== Views.MOVEMENTS}>
          <MovementsScreen />
        </div>
        <div hidden={view !== Views.INBOX}>
          <InboxScreen />
        </div>
        <div hidden={view !== Views.SETTINGS}>
          <SettingsScreen />
        </div>
        <div hidden={view !== Views.GOALS}>
          <GoalsScreen />
        </div>
      </div>
      <BottomNav />
    </>
  );
}

/**
 * La app con una sesión abierta. Cada proveedor aporta una parte: navegación, Gmail, hojas y demo.
 * <ModalSheet /> va al final, dentro de todos los proveedores, para que las hojas puedan usarlos.
 */
function SignedInApp() {
  return (
    <NavigationProvider>
      <GmailProvider>
        <ModalProvider>
          <MailDeliveryProvider>
            <MainScreens />
            <ModalSheet />
          </MailDeliveryProvider>
        </ModalProvider>
      </GmailProvider>
    </NavigationProvider>
  );
}

function Router() {
  const { phase } = useSession();
  if (phase === 'ready') return <SignedInApp />;
  if (phase === 'signed-out')
    return (
      <div className="app">
        <OnboardingScreen />
      </div>
    );
  return null; // preparando
}

export function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Router />
      </SessionProvider>
    </ToastProvider>
  );
}
