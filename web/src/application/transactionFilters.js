// Los filtros de movimientos, tal como los pide la interfaz, convertidos a lo que entiende el repositorio.
// Los usan la lista de movimientos y la exportación a CSV, para que ambas muestren lo mismo.

import { dayRange } from '../domain/period.js';

/**
 * @param {{ fromDay?: string, toDay?: string, minCents?: number, maxCents?: number, text?: string,
 *           category?: string, direction?: string, bank?: string }} [filters]  Días "AAAA-MM-DD" (los dos se
 *   incluyen completos) y montos en céntimos de colones. Lo que falte no filtra.
 */
export function toListFilters({ fromDay, toDay, minCents, maxCents, ...exact } = {}) {
  const { from, to } = dayRange(fromDay, toDay);
  return { ...exact, from, to, minCrcCents: minCents, maxCrcCents: maxCents };
}
