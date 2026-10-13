// Lectura de la respuesta del BCCR (API del SDDE). Es un JSON con esta forma:
// { estado, mensaje, datos: [{ codigoIndicador, nombreIndicador, series: [{ fecha, valorDatoPorPeriodo }] }] }
// Un día sin valor publicado llega con `valorDatoPorPeriodo: null`.

const DATE_LENGTH = 10; // "2026-01-15"; por si el BCCR agrega la hora detrás
const SOURCE_TEXT = 'BCCR, tipo de cambio de venta';

const hasValue = (entry) => typeof entry?.valorDatoPorPeriodo === 'number' && typeof entry.fecha === 'string';
const mostRecent = (latest, entry) => (entry.fecha > latest.fecha ? entry : latest);

/**
 * @param {unknown} body  Cuerpo de la respuesta, ya convertido de JSON.
 * @returns {import('../../application/ports.js').ExchangeRate} El último valor publicado.
 */
export function parseLatestRate(body) {
  if (body?.estado === false) throw new Error('BCCR: ' + (body.mensaje || 'consulta rechazada'));

  const published = (body?.datos ?? []).flatMap((indicator) => indicator?.series ?? []).filter(hasValue);
  if (!published.length) throw new Error('BCCR sin datos');

  const latest = published.reduce(mostRecent);
  return {
    rate: Math.round(latest.valorDatoPorPeriodo * 100) / 100,
    date: latest.fecha.slice(0, DATE_LENGTH),
    source: SOURCE_TEXT,
  };
}
