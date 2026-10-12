// Generación de identificadores.

/** Id aleatorio, para movimientos creados a mano. */
export function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

/**
 * Hash de texto (cyrb53): rápido, síncrono y siempre da el mismo resultado.
 * Sirve para derivar ids a partir del Message-ID de un correo.
 */
export function hash53(text, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let position = 0; position < text.length; position++) {
    const code = text.charCodeAt(position);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Id del movimiento que sale de un correo. Depende solo del Message-ID y de la
 * posición de la fila dentro del correo, así que dos teléfonos de la misma
 * persona que leen el mismo correo generan el mismo id y el respaldo no duplica.
 */
export function transactionIdForMail(mailKey, rowIndex) {
  const source = rowIndex === 0 ? mailKey : `${mailKey}#${rowIndex}`;
  return 'm' + hash53(source);
}
