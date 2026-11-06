// Controles que comparten las escenas fijas que avanzan con el scroll ("Cómo funciona" y "Despliegue"):
// la frase de la etapa activa y el control deslizante que recorre la escena.
import { gsap } from 'gsap';

/** Muestra la frase y el nombre de la etapa activa. Solo mira dentro de `section`, así dos escenas no se pisan. */
export function createStageDisplay(section) {
  const clauses = [...section.querySelectorAll('.clause')];
  const names = [...section.querySelectorAll('.stage-names li')];
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
export function linkRange(range, trigger, lenis, rangeMax) {
  let dragging = false;
  range.addEventListener('pointerdown', () => (dragging = true));
  window.addEventListener('pointerup', () => (dragging = false));
  range.addEventListener('input', () => {
    const target = trigger.start + (Number(range.value) / rangeMax) * (trigger.end - trigger.start);
    if (lenis) lenis.scrollTo(target, { immediate: dragging, duration: 0.8 });
    else window.scrollTo({ top: target });
  });
  return (progress) => {
    range.style.setProperty('--fill', `${(progress * 100).toFixed(1)}%`);
    if (!dragging) range.value = String(Math.round(progress * rangeMax));
  };
}
