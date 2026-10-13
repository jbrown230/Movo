// Cómo se muestran los montos en pantalla. Reciben céntimos (enteros).

const withTwoDecimals = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const withoutDecimals = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 });

const SMALL_AMOUNT_CENTS = 100_000; // ₡1 000

/** ₡12 500,50 */
export const formatColones = (cents) => '₡' + withTwoDecimals.format(cents / 100);

/** US$7,99 */
export const formatDollars = (cents) => 'US$' + withTwoDecimals.format(cents / 100);

/**
 * Colones sin céntimos (₡12 500), salvo montos pequeños con fracción:
 * ₡0,15 no debe verse como ₡0.
 */
export function formatColonesShort(cents) {
  const hasCents = cents % 100 !== 0;
  if (hasCents && Math.abs(cents) < SMALL_AMOUNT_CENTS) {
    return formatColones(cents);
  }
  return '₡' + withoutDecimals.format(Math.round(cents / 100));
}

/** Parte un monto en colones en entero y decimales: "₡86 954,90" -> ["₡86 954", ",90"]. */
export function splitColonesDecimals(cents) {
  const text = formatColones(cents);
  const commaIndex = text.lastIndexOf(',');
  return [text.slice(0, commaIndex), text.slice(commaIndex)];
}
