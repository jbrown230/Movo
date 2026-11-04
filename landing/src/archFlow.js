// Puntos de luz que recorren el diagrama de arquitectura. Cuentan la promesa de privacidad:
// los correos llegan hasta el teléfono y ahí se quedan; al servidor solo pasan el token y el respaldo.
import { gsap } from 'gsap';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const PACKET_RADIUS = 9;
const FADE = 0.15;
const PHONE_PULSE_AT = 1.35;

// flow: el data-flow de la conexión. kind: el color del punto (ver .arch-packet en sections.css).
const PACKETS = [
  { flow: 'gmail-phone', kind: 'mail', at: 0, duration: 1.1 },
  { flow: 'gmail-phone', kind: 'mail', at: 0.35, duration: 1.1 },
  { flow: 'gmail-phone', kind: 'mail', at: 0.7, duration: 1.1 },
  { flow: 'phone-sqlite', kind: 'mail', at: 1.6, duration: 0.8 },
  { flow: 'phone-api', kind: 'server', at: 2.7, duration: 0.7 },
  { flow: 'api-redis', kind: 'server', at: 3.4, duration: 0.9 },
  { flow: 'api-bccr', kind: 'server', at: 3.4, duration: 0.7 },
  { flow: 'api-mongo', kind: 'server', at: 3.4, duration: 0.9 },
];

function createDot(layer, kind) {
  const dot = document.createElementNS(SVG_NAMESPACE, 'circle');
  dot.setAttribute('r', String(PACKET_RADIUS));
  dot.setAttribute('class', `arch-packet is-${kind}`);
  layer.append(dot);
  return dot;
}

/** Mueve un punto a lo largo de su conexión, con una entrada y una salida cortas. */
function addPacket(timeline, diagram, { flow, kind, at, duration }) {
  const path = diagram.querySelector(`[data-flow="${flow}"]`);
  const dot = createDot(diagram.querySelector('.arch-packets'), kind);
  const length = path.getTotalLength();
  const progress = { value: 0 };
  const moveDot = () => {
    const point = path.getPointAtLength(progress.value * length);
    dot.setAttribute('cx', String(point.x));
    dot.setAttribute('cy', String(point.y));
  };
  moveDot();
  timeline
    .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' }, at)
    .fromTo(progress, { value: 0 }, { value: 1, duration, ease: 'sine.inOut', onUpdate: moveDot }, at)
    .to(dot, { opacity: 0, duration: FADE, ease: 'none' }, at + duration - FADE);
}

/** Devuelve la animación en bucle, en pausa: quien la llama decide cuándo corre. */
export function createArchFlow(diagram) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.5 });
  PACKETS.forEach((packet) => addPacket(timeline, diagram, packet));
  // El teléfono "recibe" los correos: late una vez cuando llega el último.
  timeline.to(
    diagram.querySelector('.is-phone rect'),
    { scale: 1.03, transformOrigin: '50% 50%', duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' },
    PHONE_PULSE_AT,
  );
  return timeline;
}
