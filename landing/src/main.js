// Punto de entrada del landing: scroll suave, escena 3D de la portada y animaciones por sección.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHowItWorks } from './howItWorks.js';
import { initReveals, initHeroIntro } from './reveals.js';
import { initShowcase, initCopyButton } from './interactions.js';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

/** Scroll con inercia (Lenis) sincronizado con ScrollTrigger. Sin él, el scroll nativo funciona igual. */
function initSmoothScroll() {
  if (prefersReducedMotion) return null;
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { duration: 1.4 });
    });
  });
  return lenis;
}

/** La escena 3D se carga aparte para que el texto de la portada aparezca primero. */
async function initHeroScene() {
  const canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  try {
    const { createHeroScene } = await import('./hero3d.js');
    createHeroScene(canvas, { reducedMotion: prefersReducedMotion });
  } catch (error) {
    console.warn('No se pudo iniciar la escena 3D:', error);
  }
}

const lenis = initSmoothScroll();
initHeroIntro({ reducedMotion: prefersReducedMotion });
initHeroScene();
initHowItWorks({ lenis, reducedMotion: prefersReducedMotion });
initReveals({ reducedMotion: prefersReducedMotion });
initShowcase();
initCopyButton();
