// Le da un respiro a la pantalla: deja que el navegador atienda toques y dibuje antes de seguir con lo siguiente.

/** @returns {Promise<void>} */
export function yieldToUi() {
  // `scheduler.yield` (Chrome y Edge) retoma el trabajo con prioridad. Si no existe, un temporizador de 0 ms
  // también termina la tarea actual y deja pasar a la pantalla.
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
