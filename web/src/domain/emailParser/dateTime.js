// Fechas y horas de los correos bancarios.

// Los bancos escriben la hora de Costa Rica: UTC−6 todo el año, sin horario de verano.
const COSTA_RICA_HOURS_BEHIND_UTC = 6;

/**
 * Convierte una fecha y hora escritas en hora de Costa Rica a formato ISO (UTC).
 * Los valores pueden venir como texto, tal como los captura una expresión regular.
 */
export function costaRicaToIso({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  const utcMillis = Date.UTC(+year, +month - 1, +day, +hour + COSTA_RICA_HOURS_BEHIND_UTC, +minute, +second);
  return new Date(utcMillis).toISOString();
}

/** Pasa una hora de 12 horas ("7", "PM") a 24 horas. Sin AM/PM, la hora ya viene en 24 horas. */
export function to24Hour(hour, meridiem) {
  const hour12 = Number(hour);
  if (!meridiem) return hour12;
  const isPm = /p/i.test(meridiem);
  if (hour12 === 12) return isPm ? 12 : 0;
  return isPm ? hour12 + 12 : hour12;
}

/** Texto opcional de hora: "09:41:55", "7:37 PM" ... */
export const TIME_PATTERN = '(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*([AaPp]\\.?\\s?[Mm]\\.?)?';
