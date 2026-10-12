// Cómo se muestran las fechas y horas en pantalla.

const LOCALE = 'es-CR';
const MS_PER_DAY = 86400e3;

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Hoy", "Ayer" o "Lunes, 5 de enero". */
export function dayLabel(iso, now = new Date()) {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(iso)) / MS_PER_DAY);
  if (daysAgo === 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  return capitalize(new Date(iso).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
}

export const timeLabel = (iso) => new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });

/** "10:30 a. m." (hoy), "Ayer, 10:30 a. m." o "5 ene, 10:30 a. m.". */
export function shortWhen(iso) {
  const day = dayLabel(iso);
  if (day === 'Hoy') return timeLabel(iso);
  if (day === 'Ayer') return 'Ayer, ' + timeLabel(iso);
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) + ', ' + timeLabel(iso);
}

export const longWhen = (iso) => new Date(iso).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export const monthName = (date = new Date()) => date.toLocaleDateString(LOCALE, { month: 'long' });
