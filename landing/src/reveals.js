// Entradas de cada sección: titulares con máscara, párrafos que suben y el diagrama que se dibuja.
// Se repiten: al volver a subir se deshacen, y al bajar de nuevo se ven otra vez.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createArchFlow } from './archFlow.js';

const EASE_OUT = 'expo.out';
const REPLAY = 'play none none reverse';
const DIAGRAM_DRAWN = 'bottom 80%'; // el diagrama queda dibujado apenas está entero en pantalla
const STACK_QUERY = '(min-height: 700px)'; // la misma condición de la pila de capítulos en sections.css

/** El titular de la portada sube línea por línea desde su línea base; luego aparecen el texto y los botones. */
export function initHeroIntro({ reducedMotion }) {
  const lines = document.querySelectorAll('.hero-title .line-inner');
  const fades = document.querySelectorAll('[data-hero-fade]');
  if (reducedMotion) return;

  const timeline = gsap.timeline({ delay: 0.15 });
  timeline
    .from('.nav', { y: -24, opacity: 0, duration: 0.8, ease: EASE_OUT })
    .from(lines, { yPercent: 135, duration: 0.9, ease: 'power4.out', stagger: 0.11 }, 0.1)
    .from(fades, { y: 20, opacity: 0, duration: 0.8, ease: EASE_OUT, stagger: 0.08 }, 0.65);
}

/** Titulares con máscara: cada línea sube cuando la sección entra en pantalla. */
function revealMaskedHeadings() {
  document.querySelectorAll('.tech-title, .open-title').forEach((heading) => {
    gsap.from(heading.querySelectorAll('.line-inner'), {
      yPercent: 135,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.1,
      scrollTrigger: { trigger: heading, start: 'top 88%', toggleActions: REPLAY },
    });
  });
}

/** Cada bloque marcado con data-reveal sube 24 px con opacidad, escalonado dentro de su grupo. */
function revealBlocks() {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: EASE_OUT, stagger: 0.08, overwrite: true }),
    onLeaveBack: (batch) => gsap.to(batch, { opacity: 0, y: 24, duration: 0.25, overwrite: true }),
  });
}

/** El párrafo entra de golpe desde su lado del capítulo, girando. */
function throwInChapterText(chapter, side) {
  gsap.from(chapter.querySelector('.chapter-text'), {
    xPercent: 70 * side,
    rotation: 5 * side,
    opacity: 0,
    duration: 0.9,
    ease: EASE_OUT,
    scrollTrigger: { trigger: chapter, start: 'top 85%', toggleActions: REPLAY },
  });
}

/** La frase cae sobre el capítulo: llega enorme y girada, y rebota un poco al asentarse. */
function slamChapterPhrase(phrase, side) {
  gsap.from(phrase.querySelectorAll('.line-inner'), {
    scale: 1.9,
    yPercent: 70,
    rotation: -7 * side,
    opacity: 0,
    transformOrigin: `${getComputedStyle(phrase).textAlign === 'right' ? 'right' : 'left'} bottom`,
    duration: 0.85,
    ease: 'back.out(1.6)',
    stagger: 0.09,
    scrollTrigger: { trigger: phrase, start: 'top 95%', toggleActions: REPLAY },
  });
}

/** Mientras el capítulo siguiente sube encima, los elementos del actual salen empujados hacia arriba. */
function pushOutChapter(chapter, next, side) {
  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
    })
    .to(chapter.querySelector('.chapter-phrase'), { y: '-34vh', scale: 0.8, rotation: 4 * side }, 0)
    .to(chapter.querySelector('.chapter-text'), { y: '-45vh', x: `${12 * side}vw` }, 0);
}

function animateChapters() {
  const chapters = [...document.querySelectorAll('.field-chapter')];
  const isStacked = window.matchMedia(STACK_QUERY).matches;
  chapters.forEach((chapter, index) => {
    const side = chapter.classList.contains('is-mirrored') ? -1 : 1;
    throwInChapterText(chapter, side);
    slamChapterPhrase(chapter.querySelector('.chapter-phrase'), side);
    if (isStacked && chapters[index + 1]) pushOutChapter(chapter, chapters[index + 1], side);
  });
}

/** El diagrama de arquitectura se dibuja con el scroll: primero los nodos, luego las conexiones. */
function drawArchitecture() {
  const diagram = document.querySelector('.arch');
  if (!diagram) return;
  const paths = diagram.querySelectorAll('.arch-links path');
  paths.forEach((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  });
  const timeline = gsap.timeline({
    scrollTrigger: { trigger: diagram, start: 'top 80%', end: DIAGRAM_DRAWN, scrub: 0.6 },
  });
  timeline
    .from(diagram.querySelectorAll('[data-node]'), {
      opacity: 0,
      y: 30,
      transformOrigin: 'center',
      stagger: 0.12,
      duration: 0.5,
    })
    .to(paths, { strokeDashoffset: 0, stagger: 0.1, duration: 0.6 }, 0.25);

  // Ya dibujado, los puntos de luz corren solo mientras el diagrama está en pantalla.
  ScrollTrigger.create({
    trigger: diagram,
    start: DIAGRAM_DRAWN,
    end: 'bottom top',
    animation: createArchFlow(diagram),
    toggleActions: 'play pause resume pause',
  });
}

/** Al llegar al final de la página, "Movo" se desliza hasta el margen derecho siguiendo el scroll. */
function slideFooterMark() {
  const mark = document.querySelector('.footer-mark');
  if (!mark) return;
  const footer = mark.parentElement;
  const distance = () => {
    const { paddingLeft, paddingRight } = getComputedStyle(footer);
    return footer.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight) - mark.offsetWidth;
  };
  gsap.to(mark, {
    x: distance,
    ease: 'none',
    scrollTrigger: { trigger: footer, start: 'top 70%', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
  });
  // El ancho de la palabra cambia cuando carga la letra de la marca.
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/** Los números del benchmark cuentan desde cero cada vez que entran en pantalla. */
function countMetrics() {
  document.querySelectorAll('[data-count]').forEach((element) => {
    const target = Number(element.dataset.count);
    const counter = { value: 0 };
    gsap.to(counter, {
      value: target,
      duration: 1.6,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 85%', toggleActions: 'restart none none reset' },
      onUpdate: () => {
        element.textContent = `${Math.round(counter.value)}${element.dataset.suffix || ''}`;
      },
    });
  });
}

export function initReveals({ reducedMotion }) {
  if (reducedMotion) return;
  revealMaskedHeadings();
  revealBlocks();
  animateChapters();
  drawArchitecture();
  countMetrics();
  slideFooterMark();
}
