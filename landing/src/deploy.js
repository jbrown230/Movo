// "Despliegue": una escena fija que avanza con el scroll, igual que "Cómo funciona". Tres ventanas en 3D:
// la consola de Google Cloud (un cursor crea el proyecto, activa Gmail y el ID de cliente), el sitio de
// Indicadores Económicos del BCCR (registro y token) y la terminal del servidor (clonar, completar el .env,
// levantar Docker y ver el sitio en línea).
// Todo es ilustrativo: las ventanas son dibujos en HTML, no las páginas reales.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStageDisplay, linkRange } from './stageControls.js';

const TOTAL = 26; // duración de la línea de tiempo, en unidades arbitrarias
const STAGE_STARTS = [0, 2.2, 4.4, 8.4, 13.4, 18.4, 22]; // dónde empieza cada paso
const RANGE_MAX = 300;
const PERSPECTIVE = 1400;
const SWAP = 0.9; // lo que tarda una ventana en entrar o salir
const EXIT_GOOGLE = 8.6; // la consola de Google se aleja...
const ENTER_BCCR = 8.9; // ...y entra el sitio del BCCR
const EXIT_BCCR = 13.7;
const ENTER_TERMINAL = 14;
const FIRST_TERMINAL_STAGE = 4;
const LIVE = 22.8; // aparece el sitio en línea, al frente
const MAX_FIT = 1.15; // las ventanas pueden crecer un poco en pantallas grandes

const DOMAIN = 'https://movo.tudominio.com';
const EMAIL = 'tu-correo@ejemplo.com';
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

/** El cursor de una ventana: se mueve a las partes marcadas con data-p, hace clic y escribe en los campos. */
function createCursor(timeline, root) {
  const cursor = root.querySelector('.d-cursor');
  const ripple = cursor.querySelector('.d-ripple');
  const part = (name) => root.querySelector(`[data-p="${name}"]`);
  gsap.set(cursor, { x: root.clientWidth - 70, y: root.clientHeight - 60 });

  return {
    part,
    type: (name, text, timing) => typeInto(timeline, part(name).querySelector('.gc-typed'), text, timing),
    moveTo(name, time, { duration = 0.45, inside = false } = {}) {
      const box = centerIn(part(name), root);
      // En los campos de texto el cursor apunta a la izquierda, donde se escribe.
      const targetX = inside ? box.left + 70 : box.x;
      timeline.to(cursor, { x: targetX - 4, y: box.y - 2, duration, ease: 'power2.inOut' }, time);
    },
    click(name, time) {
      timeline
        .fromTo(ripple, { scale: 0, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 0.4, ease: 'power2.out' }, time)
        .to(cursor, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1 }, time)
        .to(part(name), { scale: 0.94, duration: 0.08, yoyo: true, repeat: 1 }, time);
    },
  };
}

/** Ventana 1: un cursor recorre la consola de Google Cloud. */
function addGoogleConsole(timeline, root) {
  const { part, type, moveTo, click } = createCursor(timeline, root);
  const find = (selector) => root.querySelector(selector);

  // Paso 1: el nombre del proyecto.
  moveTo('name', 0.15, { inside: true });
  click('name', 0.6);
  type('name', 'Movo', { at: 0.65, over: 0.5 });
  moveTo('create', 1.2);
  click('create', 1.6);
  timeline
    .fromTo(find('.gc-done'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 1.7)
    .fromTo(find('.gc-project-old'), { opacity: 1 }, { opacity: 0, duration: 0.25 }, 1.8)
    .fromTo(find('.gc-project-new'), { opacity: 0 }, { opacity: 1, duration: 0.25 }, 1.8);

  // Paso 2: habilitar la Gmail API y marcar los cuatro permisos.
  timeline.fromTo(find('.gc-gmail'), { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'power3.inOut' }, 2.2);
  moveTo('enable', 2.85);
  click('enable', 3.25);
  timeline
    .fromTo(part('enable'), { opacity: 1 }, { opacity: 0, duration: 0.15 }, 3.3)
    .fromTo(
      find('.gc-enabled'),
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' },
      3.3,
    )
    .fromTo(
      root.querySelectorAll('.gc-scopes i'),
      { '--tick': 0, backgroundColor: '#ffffff', borderColor: '#5f6368' },
      { '--tick': 1, backgroundColor: '#1a73e8', borderColor: '#1a73e8', duration: 0.2, stagger: 0.22 },
      3.55,
    );

  // Paso 3: el ID de cliente, con el dominio como origen y como redirección.
  timeline.fromTo(find('.gc-client'), { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'power3.inOut' }, 4.4);
  moveTo('origin', 5, { inside: true });
  click('origin', 5.35);
  type('origin', DOMAIN, { at: 5.4, over: 0.7 });
  moveTo('redirect', 6.2, { inside: true });
  click('redirect', 6.55);
  type('redirect', `${DOMAIN}/`, { at: 6.6, over: 0.7 });
  moveTo('create-client', 7.4);
  click('create-client', 7.75);
  timeline.fromTo(find('.gc-result'), { yPercent: 130 }, { yPercent: 0, duration: 0.45, ease: 'back.out(1.4)' }, 7.8);
  moveTo('copy', 8.1, { duration: 0.35 });
  click('copy', 8.4);
  timeline
    .fromTo(find('.gc-copy-done'), { opacity: 0 }, { opacity: 1, duration: 0.12 }, 8.45)
    .fromTo(find('.gc-copy-label'), { opacity: 1 }, { opacity: 0, duration: 0.12 }, 8.45);
}

/** Ventana 2: el sitio de Indicadores Económicos del BCCR (registro, Mi perfil y Generar token). */
function addBccrSite(timeline, root) {
  const { type, moveTo, click } = createCursor(timeline, root);
  const menu = root.querySelector('.bc-menu');
  const tokenParts = root.querySelectorAll('.bc-tokenbox, .bc-hint');

  moveTo('email', ENTER_BCCR + 0.8, { inside: true });
  click('email', 10);
  type('email', EMAIL, { at: 10.05, over: 0.7 });
  moveTo('signup', 10.85);
  click('signup', 11.2);
  timeline.fromTo(root.querySelector('.gc-done'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 11.3);

  // Con la cuenta confirmada: Mi perfil, y de ahí Generar token.
  timeline
    .fromTo(tokenParts, { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0)
    .fromTo('.bc-profile-screen', { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power3.inOut' }, 11.7);
  moveTo('profile', 12.25);
  click('profile', 12.6);
  timeline.fromTo(menu, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 12.62);
  moveTo('generate', 12.8, { duration: 0.35 });
  click('generate', 13.15);
  timeline
    .fromTo(menu, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.15, immediateRender: false }, 13.2)
    .fromTo(tokenParts, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, immediateRender: false }, 13.2);
}

/** Las ventanas giran despacio y se relevan: una entra por un lado y la anterior se aleja hacia atrás. */
function addWindows(timeline, { google, bccr, terminal }) {
  gsap.set([google, bccr, terminal], { transformPerspective: PERSPECTIVE, rotationX: 5 });
  const leave = (element, time) =>
    timeline.fromTo(
      element,
      { x: 0, z: 0, opacity: 1 },
      { x: -340, z: -300, opacity: 0, duration: SWAP, ease: 'power2.in', immediateRender: false },
      time,
    );
  const arrive = (element, time) =>
    timeline.fromTo(
      element,
      { x: 340, z: -300, opacity: 0 },
      { x: 0, z: 0, opacity: 1, duration: SWAP, ease: 'power2.out' },
      time,
    );
  const tilt = (element, from, to, { at, until }) =>
    timeline.fromTo(element, { rotationY: from }, { rotationY: to, duration: until - at, ease: 'none' }, at);

  tilt(google, -16, 8, { at: 0, until: EXIT_GOOGLE + SWAP });
  leave(google, EXIT_GOOGLE);
  arrive(bccr, ENTER_BCCR);
  tilt(bccr, 14, -8, { at: ENTER_BCCR, until: EXIT_BCCR + SWAP });
  leave(bccr, EXIT_BCCR);
  arrive(terminal, ENTER_TERMINAL);
  tilt(terminal, 14, -10, { at: ENTER_TERMINAL, until: TOTAL });
}

const typingTime = (element) => Math.min(0.9, Math.max(0.25, element.dataset.text.length * 0.022));
const rowTime = (row) => {
  const typedPart = row.querySelector('.ty');
  if (typedPart) return typingTime(typedPart);
  return row.classList.contains('tbar') ? 0.7 : 0.18;
};

/** Reparte el tiempo de cada paso entre sus grupos de líneas, según el peso (data-weight) de cada uno. */
function scheduleGroups(groups) {
  const slots = new Map();
  const stages = [...new Set(groups.map((group) => Number(group.dataset.stage)))];
  for (const stage of stages) {
    const inStage = groups.filter((group) => Number(group.dataset.stage) === stage);
    const from = Math.max(STAGE_STARTS[stage] + 0.15, stage === FIRST_TERMINAL_STAGE ? ENTER_TERMINAL + SWAP : 0);
    const to = (STAGE_STARTS[stage + 1] ?? TOTAL) - 0.3;
    const weights = inStage.map((group) => Number(group.dataset.weight || 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = from;
    inStage.forEach((group, index) => {
      const end = cursor + ((to - from) * weights[index]) / totalWeight;
      slots.set(group, { start: cursor, end });
      cursor = end;
    });
  }
  return groups.map((group) => slots.get(group));
}

/** Ventana 3: cada grupo de líneas se escribe como en una terminal, repartido en el tiempo de su paso. */
function addTerminal(timeline, term) {
  const groups = [...term.querySelectorAll('.tg')];
  const slots = scheduleGroups(groups);

  groups.forEach((group, index) => {
    const { start, end } = slots[index];
    const rows = [...group.children];
    const raw = rows.reduce((sum, row) => sum + rowTime(row), 0);
    const speed = Math.min(1, (end - start - 0.1) / raw);

    timeline.fromTo(group, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, start - 0.05);
    if (slots[index + 1]) {
      const hide = slots[index + 1].start - 0.15;
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
function addLive(timeline, terminal, live) {
  gsap.set(live, { transformPerspective: PERSPECTIVE });
  timeline
    .to(terminal, { x: -50, z: -140, scale: 0.94, duration: 0.8, ease: 'power2.inOut' }, LIVE - 0.1)
    .fromTo(
      live,
      { autoAlpha: 0, y: 60, z: -120, rotationX: 24 },
      { autoAlpha: 1, y: 0, z: 70, rotationX: 0, duration: 0.8, ease: 'back.out(1.4)' },
      LIVE,
    );
}

function buildScene({ section, lenis, reducedMotion }) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  const google = section.querySelector('.d-win-a');
  const bccr = section.querySelector('.d-win-c');
  const terminal = section.querySelector('.d-win-b');
  addGoogleConsole(timeline, google.querySelector('.gc'));
  addBccrSite(timeline, bccr.querySelector('.gc'));
  addWindows(timeline, { google, bccr, terminal });
  addTerminal(timeline, terminal.querySelector('.term'));
  addLive(timeline, terminal, section.querySelector('.d-live'));
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
