// Genera el logo de Movo: el ícono SVG y los PNG que usa la app instalada.
//
// Uso (sharp no es dependencia del proyecto: se instala solo para esto):
//   npm install --no-save sharp
//   node scripts/generate-icons.mjs
//
// Idea del logo: una M cuyo trazo derecho es una flecha que sube. "Movo" = money + movimiento.
// Los colores son los del degradado de la app (violeta, rosa y cian); la M va en blanco y la flecha
// es un verde esmeralda suave (dinero que crece), sin brillo neón.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICONS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '../web/public/icons');
const SIZE = 512;
const CORNER_RADIUS = 112;
const GLYPH_STROKE_WIDTH = 48;
// Centrado ÓPTICO. La M es gruesa y el ojo la toma como "la letra", mientras que la flecha es fina y sobresale
// a la derecha y arriba. Si se centra solo la caja del dibujo, la M se ve corrida a la izquierda y abajo.
// Por eso el centro que se usa es el punto medio entre el centro de la M (x 252, y 283) y el de toda la
// figura (x 272, y 267): (262, 271).
const GLYPH_OPTICAL_CENTER = { x: 262, y: 271 };
const GLYPH_CENTERING_OFFSET = { x: SIZE / 2 - GLYPH_OPTICAL_CENTER.x, y: SIZE / 2 - GLYPH_OPTICAL_CENTER.y };

const DEFINITIONS = `
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2A1A9E"/><stop offset=".55" stop-color="#4426CC"/><stop offset="1" stop-color="#6A3BEE"/>
    </linearGradient>
    <radialGradient id="pink" cx=".9" cy=".05" r=".7">
      <stop offset="0" stop-color="#FF7BB0" stop-opacity=".85"/><stop offset="1" stop-color="#FF7BB0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cyan" cx=".75" cy="1.05" r=".7">
      <stop offset="0" stop-color="#2FC3D9" stop-opacity=".7"/><stop offset="1" stop-color="#2FC3D9" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="letter" gradientUnits="userSpaceOnUse" x1="120" y1="150" x2="400" y2="390">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9E2FF"/>
    </linearGradient>
    <linearGradient id="arrow" gradientUnits="userSpaceOnUse" x1="368" y1="366" x2="368" y2="168">
      <stop offset="0" stop-color="#D1FAE5"/><stop offset="1" stop-color="#34D399"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#14006B" flood-opacity=".35"/>
    </filter>
  </defs>`;

/** La M con su trazo derecho convertido en flecha. `scale` la achica hacia el centro (para el ícono "maskable"). */
function glyph(scale = 1) {
  const center = SIZE / 2;
  const { x, y } = GLYPH_CENTERING_OFFSET;
  const transform = `translate(${center} ${center}) scale(${scale}) translate(${-center + x} ${-center + y})`;
  return `
  <g transform="${transform}" filter="url(#shadow)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${GLYPH_STROKE_WIDTH}">
    <path d="M136 366V200L252 322L368 206" stroke="url(#letter)"/>
    <path d="M368 366V168" stroke="url(#arrow)"/>
    <path d="M327 209L368 168L409 209" stroke="url(#arrow)"/>
  </g>`;
}

/** @param {{ rounded: boolean, glyphScale?: number }} options */
function iconSvg({ rounded, glyphScale = 1 }) {
  const radius = rounded ? ` rx="${CORNER_RADIUS}"` : '';
  const layer = (fill) => `<rect width="${SIZE}" height="${SIZE}"${radius} fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${DEFINITIONS}
  ${layer('url(#background)')}
  ${layer('url(#pink)')}
  ${layer('url(#cyan)')}${glyph(glyphScale)}
</svg>
`;
}

const OUTPUTS = [
  // Ícono vectorial, para el navegador y para quien lo quiera en otro tamaño.
  { file: 'icon.svg', svg: iconSvg({ rounded: true }) },
  // Íconos de la app instalada. Los de Android se recortan solos, así que "maskable" va sin esquinas
  // y con la figura dentro de la zona segura (el 80 % central).
  { file: 'icon-192.png', svg: iconSvg({ rounded: true }), size: 192 },
  { file: 'icon-512.png', svg: iconSvg({ rounded: true }), size: 512 },
  { file: 'maskable-512.png', svg: iconSvg({ rounded: false, glyphScale: 0.78 }), size: 512 },
  // iOS pone sus propias esquinas redondeadas y no admite transparencia.
  { file: 'apple-touch-icon.png', svg: iconSvg({ rounded: false, glyphScale: 0.9 }), size: 180 },
];

const { default: sharp } = await import('sharp');
mkdirSync(ICONS_DIRECTORY, { recursive: true });

for (const { file, svg, size } of OUTPUTS) {
  const destination = join(ICONS_DIRECTORY, file);
  if (size) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(destination);
  else writeFileSync(destination, svg);
  console.log('listo', file);
}
