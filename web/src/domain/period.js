// Periodos de tiempo.

/** Inicio (incluido) y fin (excluido) del mes de una fecha, en formato ISO. */
export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

const twoDigits = (number) => String(number).padStart(2, '0');

/** Día "AAAA-MM-DD" de una fecha, en la hora del teléfono (el formato de los campos de fecha). */
export const toDayString = (date) =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

/** Medianoche (hora del teléfono) del día "AAAA-MM-DD". */
function startOfDay(day) {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth);
}

/**
 * Inicio (incluido) y fin (excluido) de un rango de días "AAAA-MM-DD", en formato ISO.
 * El último día cuenta completo. Si falta alguno de los dos, ese extremo queda en null (sin límite).
 */
export function dayRange(fromDay, toDay) {
  const end = toDay ? startOfDay(toDay) : null;
  end?.setDate(end.getDate() + 1);
  return { from: fromDay ? startOfDay(fromDay).toISOString() : null, to: end ? end.toISOString() : null };
}
