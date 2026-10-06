// Utilidades de formato. Módulo puro: funciona en el navegador y en Node (tests).

const nf2 = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 });

/** Montos siempre en céntimos (enteros). Nunca float para dinero. */
export const crc = (cents) => '₡' + nf2.format(cents / 100);
/** Sin céntimos, salvo montos pequeños con fracción (₡0,15 no debe verse como ₡0). */
export const crc0 = (cents) => (cents % 100 !== 0 && Math.abs(cents) < 100000 ? crc(cents) : '₡' + nf0.format(Math.round(cents / 100)));
export const usd = (cents) => 'US$' + nf2.format(cents / 100);
export const money = (cents, cur) => (cur === 'USD' ? usd(cents) : crc(cents));

export const pad = (n) => String(n).padStart(2, '0');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

/** Hash síncrono (cyrb53). Se usa para derivar ids deterministas desde el Message-ID. */
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Clave normalizada para reglas: mayúsculas, sin tildes, espacios simples. */
export function normKey(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function prettyName(s) {
  return String(s || '').toLowerCase()
    .replace(/(^|[\s.*\-(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

export function dayLabel(iso, now = new Date()) {
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  const x = new Date(iso); x.setHours(0, 0, 0, 0);
  const diff = Math.round((t - x) / 86400e3);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const s = new Date(iso).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const timeLbl = (iso) => new Date(iso).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });

export function shortWhen(iso) {
  const l = dayLabel(iso);
  if (l === 'Hoy') return timeLbl(iso);
  if (l === 'Ayer') return 'Ayer, ' + timeLbl(iso);
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' }) + ', ' + timeLbl(iso);
}

export const longWhen = (iso) => new Date(iso).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });

export function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}

/**
 * Nombre de comercio para mostrar, al estilo de las apps bancarias modernas:
 * "ANTHROPIC  CLAUDE SUB  14152360599 US" -> "Anthropic Claude Sub".
 * Quita números largos (teléfonos, ids) y el código de país final. El texto
 * original se conserva para las reglas de categoría.
 */
export function displayName(s) {
  const raw = String(s || '');
  const c = raw.replace(/\b\d{6,}\b/g, ' ').replace(/\s+(US|USA|CR|CRI|GB|IE|NL|CA|MX)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return prettyName(c || raw);
}
