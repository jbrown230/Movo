// El logo de Movo: una M cuyo trazo derecho es una flecha que sube ("money" + movimiento).
// Es el mismo dibujo del ícono de la app (ver scripts/generate-icons.mjs), en colores sólidos
// para que se vea bien sobre el fondo con degradado de la pantalla.

const LETTER_COLOR = '#FFFFFF';
const ARROW_COLOR = '#6EE7B7';
const STROKE_WIDTH = 48;

/**
 * Dibuja solo la figura (sin el cuadro de fondo). El tamaño lo da el contenedor.
 * El marco (viewBox) está centrado ópticamente, igual que los íconos: ver scripts/generate-icons.mjs.
 */
export function Logo(svgProps) {
  return (
    <svg
      viewBox="91 144 342 254"
      fill="none"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svgProps}
    >
      <path d="M136 366V200L252 322L368 206" stroke={LETTER_COLOR} />
      <path d="M368 366V168M327 209L368 168L409 209" stroke={ARROW_COLOR} />
    </svg>
  );
}
