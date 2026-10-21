import { getCategory } from '../../domain/categories.js';

// Dibujos de los íconos (trazos SVG de 24x24). Las claves de categoría coinciden con domain/categories.js.
const ICON_PATHS = {
  // categorías
  super:
    '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6"/>',
  comida: '<path d="M7 2v9M4 2v5a3 3 0 0 0 6 0V2M7 11v11M18 2c-2.2 1.4-3 4-3 7v4h3v9"/>',
  transporte: '<path d="M3 13l2-6h14l2 6v4H3z"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  servicios: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  salud: '<path d="M20.8 5.6a5 5 0 0 0-7.8-.6L12 6l-1-1a5 5 0 0 0-7.8 6.4L12 21l8.8-9.6a5 5 0 0 0 0-5.8z"/>',
  ocio: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  transfer: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  ingreso: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  propias:
    '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  otros: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  // interfaz
  check: '<path d="M20 6 9 17l-5-5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  clipboard:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  home: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};

/** Ícono de trazo. `name` es una clave de ICON_PATHS. */
export function Icon({ name, ...svgProps }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svgProps}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? ICON_PATHS.otros }}
    />
  );
}

/** Círculo de color con el ícono de una categoría. `size` (px) es opcional. */
export function CategoryIcon({ category, size }) {
  const { color } = getCategory(category);
  const style = { background: `${color}1F`, color, ...(size ? { width: size, height: size } : {}) };
  return (
    <span className="ic" style={style}>
      <Icon name={category in ICON_PATHS ? category : 'otros'} />
    </span>
  );
}
