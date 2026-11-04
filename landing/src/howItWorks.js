// "Cómo funciona": una escena fija que avanza con el scroll. El teléfono pasa por las cuatro
// etapas reales de Movo (Recibido, Leído, Extraído, Registrado) y el control deslizante permite
// recorrerlas a mano: moverlo desplaza la página hasta ese punto.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const TOTAL = 10; // duración de la línea de tiempo, en unidades arbitrarias
const STAGE_STARTS = [0, 1.6, 4, 7]; // dónde empieza cada etapa dentro de la línea de tiempo
const RANGE_MAX = 300;
const TOTAL_BEFORE = 92954;
const PAYMENT = 12500;

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

/** Etapa "Registrado": la pantalla de Movo entra, el gasto aparece y el total sube. */
function addRegistered(timeline) {
  const counter = { value: TOTAL_BEFORE };
  const countLabel = document.querySelector('.movo-count');
  timeline
    .fromTo('.screen-movo', { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 7)
    .fromTo('.row:not(.row-new)', { y: -72 }, { y: 0, duration: 0.6, ease: 'power2.out' }, 7.9)
    .fromTo(
      '.row-new',
      { opacity: 0, x: -40, scale: 0.94 },
      { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: 'back.out(1.8)' },
      8.1,
    )
    .to(
      counter,
      {
        value: TOTAL_BEFORE + PAYMENT,
        duration: 1,
        ease: 'power2.out',
        onUpdate: () => {
          countLabel.textContent = formatColones(counter.value);
        },
      },
      8.1,
    )
    .fromTo('.movo-bar span', { '--bar': 0.265 }, { '--bar': 0.301, duration: 1 }, 8.1)
    .fromTo(
      '.toast',
      { yPercent: 160, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' },
      8.6,
    )
    .fromTo(
      '.toast-steps span',
      { backgroundSize: '0% 4px' },
      { backgroundSize: '100% 4px', duration: 0.25, stagger: 0.2 },
      8.9,
    )
    .set({}, {}, TOTAL);
}

const stageAt = (time) => STAGE_STARTS.findLastIndex((start) => time >= start);

/** Muestra la frase y el nombre de la etapa activa. */
function createStageDisplay() {
  const clauses = [...document.querySelectorAll('.clause')];
  const names = [...document.querySelectorAll('.stage-names li')];
  let current = 0;
  return (stage) => {
    if (stage === current) return;
    const previous = clauses[current];
    const next = clauses[stage];
    const direction = stage > current ? 1 : -1;
    current = stage;
    gsap.to(previous, { autoAlpha: 0, y: -24 * direction, duration: 0.25, ease: 'power2.in', overwrite: true });
    gsap.fromTo(
      next,
      { autoAlpha: 0, y: 28 * direction },
      { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.12, ease: 'expo.out', overwrite: true },
    );
    clauses.forEach((clause, index) => clause.classList.toggle('is-active', index === stage));
    names.forEach((name, index) => name.classList.toggle('is-active', index === stage));
  };
}

/** El control deslizante sigue al scroll, y al moverlo lleva la página a esa etapa. */
function linkRange(range, trigger, lenis) {
  let dragging = false;
  range.addEventListener('pointerdown', () => (dragging = true));
  window.addEventListener('pointerup', () => (dragging = false));
  range.addEventListener('input', () => {
    const target = trigger.start + (Number(range.value) / RANGE_MAX) * (trigger.end - trigger.start);
    if (lenis) lenis.scrollTo(target, { immediate: dragging, duration: 0.8 });
    else window.scrollTo({ top: target });
  });
  return (progress) => {
    range.style.setProperty('--fill', `${(progress * 100).toFixed(1)}%`);
    if (!dragging) range.value = String(Math.round(progress * RANGE_MAX));
  };
}

export function initHowItWorks({ lenis, reducedMotion }) {
  const section = document.querySelector('.how');
  const phone = section?.querySelector('.phone');
  if (!section || !phone) return;
  fitPhone(phone, section.querySelector('.how-stage'));

  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  addPaymentAndPush(timeline);
  addMailReading(timeline);
  addRegistered(timeline);
  timeline.fromTo(phone, { '--ry': -14 }, { '--ry': 10, duration: TOTAL, ease: 'none' }, 0);

  const showStage = createStageDisplay();
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
  updateRange = linkRange(range, trigger, lenis);
}
