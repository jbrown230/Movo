import { Icon } from '../components/Icon.jsx';
import { useAppData } from '../hooks/useAppData.js';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';

const TABS = [
  { view: Views.HOME, label: 'Inicio', icon: 'home' },
  { view: Views.MOVEMENTS, label: 'Movimientos', icon: 'list' },
  { view: Views.INBOX, label: 'Bandeja', icon: 'mail' },
  { view: Views.SETTINGS, label: 'Ajustes', icon: 'settings' },
];

/** Pantallas sin pestaña propia y la pestaña que queda marcada mientras se ven. */
const TAB_OF_VIEW = { [Views.GOALS]: Views.HOME };

/** Barra de navegación de abajo. La bandeja muestra cuántos correos hay. */
export function BottomNav() {
  const { view, goTo } = useNavigation();
  const activeTab = TAB_OF_VIEW[view] ?? view;
  const { mails } = useAppData();

  return (
    <nav className="nav" aria-label="Navegación principal">
      {TABS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          aria-current={tab.view === activeTab ? 'page' : 'false'}
          onClick={() => goTo(tab.view)}
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
          {tab.view === Views.INBOX && <span className="badge">{mails.length}</span>}
        </button>
      ))}
    </nav>
  );
}
