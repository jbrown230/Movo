import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { useAppData } from '../hooks/useAppData.js';
import { Views, useNavigation } from '../state/NavigationProvider.jsx';

const TABS = [
  { view: Views.HOME, label: 'Inicio', icon: 'home' },
  { view: Views.MOVEMENTS, label: 'Movimientos', icon: 'list' },
  { view: Views.INBOX, label: 'Bandeja', icon: 'mail' },
  { view: Views.SETTINGS, label: 'Ajustes', icon: 'settings' },
];

/**
 * Navegación flotante: un botón redondo en la esquina, con el ícono de la pantalla actual.
 * Al tocarlo se despliegan las pantallas, con la actual marcada. La bandeja muestra cuántos correos hay.
 */
export function BottomNav() {
  const { view, goTo } = useNavigation();
  const { mails } = useAppData();
  const [isOpen, setIsOpen] = useState(false);
  const current = TABS.find((tab) => tab.view === view) ?? TABS[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && setIsOpen(false);
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const open = (tab) => {
    setIsOpen(false);
    goTo(tab.view);
  };

  return (
    <nav className={`fab-nav${isOpen ? ' open' : ''}`} aria-label="Navegación principal">
      {isOpen && <div className="fab-scrim" onClick={() => setIsOpen(false)} />}
      {isOpen && (
        <ul className="fab-menu">
          {TABS.map((tab, index) => (
            // --from-fab: 1 para la opción más cercana al botón; así aparecen de abajo hacia arriba.
            <li key={tab.view} style={{ '--from-fab': TABS.length - index }}>
              <button
                type="button"
                aria-current={tab.view === view ? 'page' : 'false'}
                aria-label={tab.label}
                onClick={() => open(tab)}
              >
                <span className="fab-label">{tab.label}</span>
                <span className="fab-item-icon">
                  <Icon name={tab.icon} />
                  {tab.view === Views.INBOX && <span className="badge">{mails.length}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="fab"
        aria-label={isOpen ? 'Cerrar menú' : `Menú. Estás en ${current.label}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* La clave cambia al abrir o cerrar, así el ícono vuelve a animarse al cambiar. */}
        <span className="fab-icon" key={isOpen ? 'close' : current.icon}>
          <Icon name={isOpen ? 'close' : current.icon} />
        </span>
      </button>
    </nav>
  );
}
