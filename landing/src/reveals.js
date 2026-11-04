// Entradas de cada sección: titulares con máscara, párrafos que suben y el diagrama que se dibuja.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const EASE_OUT = 'expo.out';

/** El titular de la portada sube línea por línea desde su línea base; luego aparecen el texto y los botones. */
export function initHeroIntro({ reducedMotion }) {
  const lines = document.querySelectorAll('.hero-title .line-inner');
  const fades = document.querySelectorAll('[data-hero-fade]');
  if (reducedMotion) return;

  const timeline = gsap.timeline({ delay: 0.15 });
  timeline
    .from('.nav', { y: -24, opacity: 0, duration: 0.8, ease: EASE_OUT })
    .from(lines, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.11 }, 0.1)
    .from(fades, { y: 20, opacity: 0, duration: 0.8, ease: EASE_OUT, stagger: 0.08 }, 0.65);
}

/** Titulares con máscara de los capítulos: cada línea sube cuando la sección entra en pantalla. */
function revealMaskedHeadings() {
  document.querySelectorAll('.chapter-phrase, .tech-title, .open-title').forEach((heading) => {
    gsap.from(heading.querySelectorAll('.line-inner'), {
      yPercent: 105,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.1,
      scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
    });
  });
}

/** Cada bloque marcado con data-reveal sube 24 px con opacidad, escalonado dentro de su grupo. */
function revealBlocks() {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: EASE_OUT, stagger: 0.08, overwrite: true }),
  });
}

/** Los capítulos de color se acercan un poco al entrar, como pósters que se asientan. */
function settleChapters() {
  document.querySelectorAll('.field-chapter').forEach((chapter) => {
    gsap.fromTo(
      chapter.querySelector('.chapter-phrase'),
      { xPercent: chapter.classList.contains('is-mirrored') ? 6 : -6 },
      {
        xPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: chapter, start: 'top bottom', end: 'bottom 60%', scrub: true },
      },
    );
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
    scrollTrigger: { trigger: diagram, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
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
}

/** Los números del benchmark cuentan desde cero la primera vez que se ven. */
function countMetrics() {
  document.querySelectorAll('[data-count]').forEach((element) => {
    const target = Number(element.dataset.count);
    const counter = { value: 0 };
    gsap.to(counter, {
      value: target,
      duration: 1.6,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 85%', once: true },
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
  settleChapters();
  drawArchitecture();
  countMetrics();
}
