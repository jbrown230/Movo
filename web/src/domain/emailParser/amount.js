// Lectura de montos escritos en distintos formatos.

/** Patrón de un número tal como lo escriben los correos: "1,234.50", "15.000,00" o ".15". */
export const AMOUNT_PATTERN = '(\\d[\\d.,]*|\\.\\d+)';

/**
 * Convierte un monto escrito a número.
 * Entiende "15,000.00", "15.000,00", "15000", "1.234", ".15" y "2 500,50".
 * Devuelve NaN si no es un número.
 */
export function parseAmount(text) {
  let amount = String(text).trim().replace(/\s/g, '');
  const lastComma = amount.lastIndexOf(',');
  const lastDot = amount.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // Con los dos símbolos, el que aparece de último es el decimal.
    amount = lastComma > lastDot
      ? amount.replace(/\./g, '').replace(',', '.')
      : amount.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Una coma seguida de 1 o 2 dígitos es decimal; si no, separa miles.
    amount = /,\d{1,2}$/.test(amount) ? amount.replace(',', '.') : amount.replace(/,/g, '');
  } else if (lastDot > -1 && !/\.\d{1,2}$/.test(amount)) {
    amount = amount.replace(/\./g, ''); // "1.234": el punto separa miles
  }

  const value = parseFloat(amount);
  return Number.isFinite(value) ? value : NaN;
}
