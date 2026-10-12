// Fecha ISO (UTC) de una hora escrita en hora de Costa Rica (UTC−6). Para comparar en las pruebas.
export const costaRicaIso = (year, month, day, hour, minute, second = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second)).toISOString();
