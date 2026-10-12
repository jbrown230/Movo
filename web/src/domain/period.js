// Periodos de tiempo.

/** Inicio (incluido) y fin (excluido) del mes de una fecha, en formato ISO. */
export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
