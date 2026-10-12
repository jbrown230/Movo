import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;
const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

/**
 * Número que "sube" suavemente hasta su nuevo valor. Si la persona pidió menos
 * movimiento en su teléfono, cambia de golpe.
 */
export function useAnimatedNumber(target) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const prefersLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersLessMotion || from === target) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }

    let frame;
    const startedAt = performance.now();
    const step = (now) => {
      // Entre 0 y 1: el primer cuadro puede traer una hora ligeramente anterior al inicio.
      const progress = Math.min(1, Math.max(0, (now - startedAt) / DURATION_MS));
      const value = Math.round(from + (target - from) * easeOutCubic(progress));
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}
