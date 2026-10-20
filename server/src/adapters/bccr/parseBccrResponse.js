// Lectura de la respuesta del BCCR (API del SDDE). Es un JSON con esta forma:
// { estado, mensaje, datos: [{ codigoIndicador, nombreIndicador, series: [{ fecha, valorDatoPorPeriodo }] }] }
// Un día sin valor publicado llega con `valorDatoPorPeriodo: null` o no llega.

const DATE_LENGTH = 10; // "2026-01-15"; por si el BCCR agrega la hora detrás

const hasValue = (entry) => typeof entry?.valorDatoPorPeriodo === 'number' && typeof entry.fecha === 'string';

/**
 * @param {unknown} body  Cuerpo de la respuesta, ya convertido de JSON.
 * @returns {Array<{ date: string, value: number }>} Los días con valor publicado, del más viejo al más nuevo.
 */
export function parseSeries(body) {
  if (body?.estado === false) throw new Error('BCCR: ' + (body.mensaje || 'consulta rechazada'));

  const published = (body?.datos ?? []).flatMap((indicator) => indicator?.series ?? []).filter(hasValue);
  if (!published.length) throw new Error('BCCR sin datos');

  return published
    .map((entry) => ({ date: entry.fecha.slice(0, DATE_LENGTH), value: entry.valorDatoPorPeriodo }))
    .sort((first, second) => first.date.localeCompare(second.date));
}
