// Lectura de la respuesta del BCCR. La respuesta es un XML escapado dentro de otro XML,
// por eso primero se "desescapan" los símbolos < y >.

const ESCAPED_LESS_THAN = /&lt;/g;
const ESCAPED_GREATER_THAN = /&gt;/g;
const DATE_AND_VALUE = /<DES_FECHA>([^<]+)<\/DES_FECHA>\s*<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/g;
const DATE_LENGTH = 10; // "2026-01-15"; el BCCR agrega la hora detrás
const SOURCE_TEXT = 'BCCR, tipo de cambio de venta';

/**
 * @param {string} responseText
 * @returns {import('../../application/ports.js').ExchangeRate} El último valor de la respuesta.
 */
export function parseLatestRate(responseText) {
  const xml = responseText.replace(ESCAPED_LESS_THAN, '<').replace(ESCAPED_GREATER_THAN, '>');
  const entries = [...xml.matchAll(DATE_AND_VALUE)];
  if (!entries.length) throw new Error('BCCR sin datos');

  const [, date, value] = entries.at(-1);
  return {
    rate: Math.round(Number(value) * 100) / 100,
    date: date.slice(0, DATE_LENGTH),
    source: SOURCE_TEXT,
  };
}
