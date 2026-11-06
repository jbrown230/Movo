// "Despliegue": una escena fija que avanza con el scroll, igual que "Cómo funciona". Dos ventanas en 3D:
// primero la consola de Google Cloud (un cursor crea el proyecto, activa Gmail y el ID de cliente) y luego
// la terminal del servidor (clonar, completar el .env, levantar Docker y ver el sitio en línea).
// Todo es ilustrativo: la consola es un dibujo en HTML, no la página de Google.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStageDisplay, linkRange } from './stageControls.js';

const TOTAL = 21; // duración de la línea de tiempo, en unidades arbitrarias
const STAGE_STARTS = [0, 2.2, 4.4, 8.4, 12.4, 16]; // dónde empieza cada paso
const RANGE_MAX = 300;
const PERSPECTIVE = 1400;
const EXIT = 8.6; // la consola se aleja hacia atrás...
const ENTER = 8.9; // ...y la terminal entra desde el otro lado
const SWAP = 0.9;
const MAX_FIT = 1.15; // las ventanas pueden crecer un poco en pantallas grandes
const LIVE = 18.2; // aparece el sitio en línea, al frente

const DOMAIN = 'https://movo.tudominio.com';
const stageAt = (time) => STAGE_STARTS.findLastIndex((start) => time >= start);

/** Ajusta las ventanas al escenario, para que quepan enteras en cualquier pantalla. */
function fitWindows(stage, fits) {
  const resize = () => {
    const scale = Math.min(
      MAX_FIT,
      (stage.clientWidth - 32) / fits[0].offsetWidth,
      (stage.clientHeight - 96) / fits[0].offsetHeight,
    );
    fits.forEach((fit) => fit.style.setProperty('--fit', scale.toFixed(3)));
  };
  resize();
  window.addEventListener('resize', resize);
}

/** Centro de un elemento dentro de `root`. Usa offset*, que no cambia con las transformaciones. */
function centerIn(element, root) {
  let left = 0;
  let top = 0;
  for (let node = element; node && node !== root; node = node.offsetParent) {
    left += node.offsetLeft;
    top += node.offsetTop;
  }
  return { x: left + element.offsetWidth / 2, y: top + element.offsetHeight / 2, left };
}

/** Escribe `text` letra por letra, desde `at` y durante `over`. */
function typeInto(timeline, element, text, { at, over }) {
  const state = { count: 0 };
  element.textContent = '';
  timeline.to(
    state,
    {
      count: text.length,
      duration: over,
      ease: 'none',
      onUpdate: () => {
        element.textContent = text.slice(0, Math.round(state.count));
      },
    },
    at,
  );
}

/** Ventana 1: un cursor recorre la consola de Google Cloud. */
function addConsole(timeline, gc) {
  const cursor = gc.querySelector('.d-cursor');
  const ripple = cursor.querySelector('.d-ripple');
  const part = (name) => gc.querySelector(`[data-p="${name}"]`);
  const typed = (name) => part(name).querySelector('.gc-typed');

  gsap.set(cursor, { x: gc.clientWidth - 70, y: gc.clientHeight - 60 });
  const moveTo = (name, time, { duration = 0.45, inside = false } = {}) => {
    const box = centerIn(part(name), gc);
    // En los campos de texto el cursor apunta a la izquierda, donde se escribe.
    const targetX = inside ? box.left + 70 : box.x;
    timeline.to(cursor, { x: targetX - 4, y: box.y - 2, duration, ease: 'power2.inOut' }, time);
  };
  const click = (name, time) => {
    timeline
      .fromTo(ripple, { scale: 0, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 0.4, ease: 'power2.out' }, time)
      .to(cursor, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1 }, time)
      .to(part(name), { scale: 0.94, duration: 0.08, yoyo: true, repeat: 1 }, time);
  };

  // Paso 1: el nombre del proyecto.
  moveTo('name', 0.15, { inside: true });
  click('name', 0.6);
  typeInto(timeline, typed('name'), 'Movo', { at: 0.65, over: 0.5 });
  moveTo('create', 1.2);
  click('create', 1.6);
  timeline
    .fromTo('.gc-done', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 1.7)
    .fromTo('.gc-project-old', { opacity: 1 }, { opacity: 0, duration: 0.25 }, 1.8)
    .fromTo('.gc-project-new', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 1.8);

  // Paso 2: habilitar la Gmail API y marcar los cuatro permisos.
  timeline.fromTo('.gc-gmail', { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'power3.inOut' }, 2.2);
  moveTo('enable', 2.85);
  click('enable', 3.25);
  timeline
    .fromTo(part('enable'), { opacity: 1 }, { opacity: 0, duration: 0.15 }, 3.3)
    .fromTo(
      '.gc-enabled',
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' },
      3.3,
    )
    .fromTo(
      '.gc-scopes i',
      { '--tick': 0, backgroundColor: '#ffffff', borderColor: '#5f6368' },
      { '--tick': 1, backgroundColor: '#1a73e8', borderColor: '#1a73e8', duration: 0.2, stagger: 0.22 },
      3.55,
    );

  // Paso 3: el ID de cliente, con el dominio como origen y como redirección.
  timeline.fromTo('.gc-client', { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'power3.inOut' }, 4.4);
  moveTo('origin', 5, { inside: true });
  click('origin', 5.35);
  typeInto(timeline, typed('origin'), DOMAIN, { at: 5.4, over: 0.7 });
  moveTo('redirect', 6.2, { inside: true });
  click('redirect', 6.55);
  typeInto(timeline, typed('redirect'), `${DOMAIN}/`, { at: 6.6, over: 0.7 });
  moveTo('create-client', 7.4);
  click('create-client', 7.75);
  timeline.fromTo('.gc-result', { yPercent: 130 }, { yPercent: 0, duration: 0.45, ease: 'back.out(1.4)' }, 7.8);
  moveTo('copy', 8.1, { duration: 0.35 });
  click('copy', 8.4);
  timeline
    .fromTo('.gc-copy-done', { opacity: 0 }, { opacity: 1, duration: 0.12 }, 8.45)
    .fromTo('.gc-copy-label', { opacity: 1 }, { opacity: 0, duration: 0.12 }, 8.45);
}

/** Las dos ventanas giran despacio y se relevan: la consola se aleja y la terminal entra. */
function addWindows(timeline, windowA, windowB) {
  gsap.set([windowA, windowB], { transformPerspective: PERSPECTIVE, rotationX: 5 });
  timeline
    .fromTo(windowA, { rotationY: -16 }, { rotationY: 8, duration: EXIT + SWAP, ease: 'none' }, 0)
    .fromTo(
      windowA,
      { x: 0, z: 0, opacity: 1 },
      { x: -340, z: -300, opacity: 0, duration: SWAP, ease: 'power2.in' },
      EXIT,
    )
    .fromTo(
      windowB,
      { x: 340, z: -300, opacity: 0 },
      { x: 0, z: 0, opacity: 1, duration: SWAP, ease: 'power2.out' },
      ENTER,
    )
    .fromTo(windowB, { rotationY: 14 }, { rotationY: -10, duration: TOTAL - ENTER, ease: 'none' }, ENTER);
}

const typingTime = (element) => Math.min(0.9, Math.max(0.25, element.dataset.text.length * 0.022));
const rowTime = (row) => {
  const typedPart = row.querySelector('.ty');
  if (typedPart) return typingTime(typedPart);
  return row.classList.contains('tbar') ? 0.7 : 0.18;
};

/** Ventana 2: cada grupo de líneas se escribe como en una terminal, repartido en el tiempo de su paso. */
function addTerminal(timeline, term) {
  const groups = [...term.querySelectorAll('.tg')];
  const starts = groups.map((group) => {
    const stage = Number(group.dataset.stage);
    return Math.max(STAGE_STARTS[stage] + 0.15, stage === 3 ? ENTER + SWAP : 0);
  });

  groups.forEach((group, index) => {
    const start = starts[index];
    const end = (starts[index + 1] ?? TOTAL) - 0.3;
    const rows = [...group.children];
    const raw = rows.reduce((sum, row) => sum + rowTime(row), 0);
    const speed = Math.min(1, (end - start) / raw);

    timeline.fromTo(group, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, start - 0.05);
    if (starts[index + 1]) {
      const hide = starts[index + 1] - 0.15;
      timeline.fromTo(group, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, hide);
    }

    let time = start;
    for (const row of rows) {
      const span = rowTime(row) * speed;
      timeline.fromTo(row, { opacity: 0 }, { opacity: 1, duration: 0.05 }, time);
      const typedPart = row.querySelector('.ty');
      if (typedPart) typeInto(timeline, typedPart, typedPart.dataset.text, { at: time, over: span });
      const fill = row.querySelector('.tbar-fill');
      if (fill) timeline.fromTo(fill, { width: '0%' }, { width: '100%', duration: span, ease: 'none' }, time);
      time += span;
    }
  });
}

/** Al final aparece el sitio en línea, al frente de la terminal. */
function addLive(timeline, windowB, live) {
  gsap.set(live, { transformPerspective: PERSPECTIVE });
  timeline
    .to(windowB, { x: -50, z: -140, scale: 0.94, duration: 0.8, ease: 'power2.inOut' }, LIVE - 0.1)
    .fromTo(
      live,
      { autoAlpha: 0, y: 60, z: -120, rotationX: 24 },
      { autoAlpha: 1, y: 0, z: 70, rotationX: 0, duration: 0.8, ease: 'back.out(1.4)' },
      LIVE,
    );
}

function buildScene({ section, lenis, reducedMotion }) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  const windowA = section.querySelector('.d-win-a');
  const windowB = section.querySelector('.d-win-b');
  addConsole(timeline, windowA.querySelector('.gc'));
  addWindows(timeline, windowA, windowB);
  addTerminal(timeline, windowB.querySelector('.term'));
  addLive(timeline, windowB, section.querySelector('.d-live'));
  timeline.set({}, {}, TOTAL);

  const showStage = createStageDisplay(section);
  const range = section.querySelector('.stage-range');
  let updateRange = () => {};
  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: reducedMotion ? true : 0.8,
    animation: timeline,
    onUpdate: (self) => {
      updateRange(self.progress);
      showStage(stageAt(self.progress * TOTAL));
    },
  });
  updateRange = linkRange(range, trigger, lenis, RANGE_MAX);
}

export function initDeploy({ lenis, reducedMotion }) {
  const section = document.querySelector('.deploy');
  if (!section) return;
  fitWindows(section.querySelector('.deploy-stage'), [...section.querySelectorAll('.d-fit')]);

  // El cursor apunta a posiciones medidas sobre los botones: hay que medir con la letra ya cargada.
  const fontLoads = ['500 14px Onest', '700 14px Onest'].map((font) => document.fonts.load(font));
  Promise.allSettled(fontLoads).then(() => buildScene({ section, lenis, reducedMotion }));
}
