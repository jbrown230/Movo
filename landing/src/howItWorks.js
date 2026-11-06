// "Cómo funciona": una escena fija que avanza con el scroll. El teléfono pasa por las cuatro
// etapas reales de Movo (Recibido, Leído, Extraído, Registrado) y el control deslizante permite
// recorrerlas a mano: moverlo desplaza la página hasta ese punto.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStageDisplay, linkRange } from './stageControls.js';

const TOTAL = 10; // duración de la línea de tiempo, en unidades arbitrarias
const STAGE_STARTS = [0, 1.6, 4, 7]; // dónde empieza cada etapa dentro de la línea de tiempo
const RANGE_MAX = 300;
const TOTAL_BEFORE = 92954;
const PAYMENT = 12500;
const FLIGHT_START = 7.75;
const FLIGHT_DURATION = 0.75;
const FLIGHT_STAGGER = 0.2;
const FIRST_LANDING = FLIGHT_START + FLIGHT_DURATION;
const CHIP_FADE = 0.3;

const formatColones = (value) => Math.round(value).toLocaleString('es-CR').replace(/[.,]/g, ' ');

/** Ajusta el teléfono al alto disponible, para que quepa entero en cualquier pantalla. */
function fitPhone(phone, stage) {
  const resize = () => {
    const available = stage.clientHeight - 32;
    const scale = Math.min(1, available / phone.offsetHeight, (stage.clientWidth - 24) / phone.offsetWidth);
    phone.style.setProperty('--phone-scale', scale.toFixed(3));
  };
  resize();
  window.addEventListener('resize', resize);
}

/** Etapa "Recibido": se envía el SINPE y cae la notificación del banco. */
function addPaymentAndPush(timeline) {
  timeline
    .to('.bank-button', { scale: 0.95, duration: 0.25, ease: 'power2.out' }, 0.6)
    .to('.bank-button', { scale: 1, backgroundColor: '#0e9e74', duration: 0.4, ease: 'back.out(3)' }, 0.85)
    .to('.bank-send', { yPercent: -120, opacity: 0, duration: 0.3 }, 0.85)
    .fromTo('.bank-sent', { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, 0.9)
    .fromTo(
      '.push',
      { yPercent: -160, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' },
      1.6,
    );
}

/** Etapas "Leído" y "Extraído": se abre el correo y Movo marca cada dato que encuentra. */
function addMailReading(timeline) {
  timeline
    .fromTo('.screen-mail', { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6)
    .to('.push', { yPercent: -160, opacity: 0, duration: 0.5, ease: 'power2.in' }, 2.8)
    .fromTo('.field', { '--mark': 0 }, { '--mark': 1, duration: 0.5, ease: 'power2.out', stagger: 0.55 }, 4.2)
    .fromTo(
      '.chip',
      { opacity: 0, y: 24, scale: 0.7 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.55 },
      4.5,
    );
}

/** Posición de un elemento dentro del teléfono. Usa offset*, que no cambia con la escala ni el giro del teléfono. */
function localBox(element, root) {
  let left = 0;
  let top = 0;
  for (let node = element; node && node !== root; node = node.offsetParent) {
    left += node.offsetLeft;
    top += node.offsetTop;
  }
  return { left, centerY: top + element.offsetHeight / 2 };
}

/** Calcula cómo debe llegar una etiqueta para que su texto caiga justo sobre el texto de la fila. */
function flightTo(chip, target, root) {
  const from = localBox(chip, root);
  const to = localBox(target, root);
  const chipStyle = getComputedStyle(chip);
  const targetStyle = getComputedStyle(target);
  const scale = parseFloat(targetStyle.fontSize) / parseFloat(chipStyle.fontSize);
  return {
    x: to.left - from.left - parseFloat(chipStyle.paddingLeft) * scale,
    y: to.centerY - from.centerY,
    scale,
    color: targetStyle.color,
  };
}

/** Cada dato sale del correo y aterriza en la fila nueva: la etiqueta se apaga y queda el texto real. */
function addChipFlights(timeline) {
  const root = document.querySelector('.phone-screen');
  document.querySelectorAll('.chip').forEach((chip, index) => {
    const target = root.querySelector(chip.dataset.target);
    const { x, y, scale, color } = flightTo(chip, target, root);
    const start = FLIGHT_START + index * FLIGHT_STAGGER;
    const landing = start + FLIGHT_DURATION;
    timeline
      .to(chip, { x, duration: FLIGHT_DURATION, ease: 'sine.inOut' }, start)
      .to(chip, { y, scale, duration: FLIGHT_DURATION, ease: 'power3.inOut' }, start)
      .to(chip, { backgroundColor: 'rgba(90, 51, 230, 0)', color, duration: CHIP_FADE }, landing - CHIP_FADE)
      .to(chip, { opacity: 0, duration: 0.1, ease: 'none' }, landing)
      .fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, landing);
  });
}

/** Etapa "Registrado": entra la pantalla de Movo, los datos vuelan a su fila y el total sube cuando llega el monto. */
function addRegistered(timeline) {
  const counter = { value: TOTAL_BEFORE };
  const countLabel = document.querySelector('.movo-count');
  timeline
    .fromTo('.screen-movo', { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 7)
    .fromTo('.row:not(.row-new)', { y: -72 }, { y: 0, duration: 0.5, ease: 'power2.out' }, 7.6)
    .fromTo(
      '.row-new',
      { opacity: 0, scale: 0.96 },
      { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' },
      7.7,
    );
  addChipFlights(timeline);
  timeline
    .to('.row-new', { scale: 1.03, duration: 0.12, yoyo: true, repeat: 1 }, FIRST_LANDING)
    .to(
      counter,
      {
        value: TOTAL_BEFORE + PAYMENT,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: () => {
          countLabel.textContent = formatColones(counter.value);
        },
      },
      FIRST_LANDING,
    )
    .fromTo('.movo-bar span', { '--bar': 0.265 }, { '--bar': 0.301, duration: 0.8 }, FIRST_LANDING)
    .fromTo(
      '.toast',
      { yPercent: 160, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.5)' },
      9.2,
    )
    .fromTo(
      '.toast-steps span',
      { backgroundSize: '0% 4px' },
      { backgroundSize: '100% 4px', duration: 0.2, stagger: 0.12 },
      9.3,
    )
    .set({}, {}, TOTAL);
}

const stageAt = (time) => STAGE_STARTS.findLastIndex((start) => time >= start);

function buildScene({ section, phone, lenis, reducedMotion }) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  addPaymentAndPush(timeline);
  addMailReading(timeline);
  addRegistered(timeline);
  timeline.fromTo(phone, { '--ry': -14 }, { '--ry': 10, duration: TOTAL, ease: 'none' }, 0);

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

export function initHowItWorks({ lenis, reducedMotion }) {
  const section = document.querySelector('.how');
  const phone = section?.querySelector('.phone');
  if (!section || !phone) return;
  fitPhone(phone, section.querySelector('.how-stage'));

  // Las etiquetas vuelan a posiciones medidas sobre el texto: hay que medir con la letra ya cargada.
  const fontLoads = ['500 14px Onest', '700 14px Onest'].map((font) => document.fonts.load(font));
  Promise.allSettled(fontLoads).then(() => buildScene({ section, phone, lenis, reducedMotion }));
}
