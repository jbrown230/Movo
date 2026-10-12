// Ayudas de texto compartidas por las plantillas.

/** Colapsa espacios y saltos de línea en un solo espacio. */
export const collapseSpaces = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

/** Palabras con las que un banco indica que no aprobó la transacción. */
const DECLINED_WORDS = /negad|rechazad|declinad|denegad|anulad|revers/i;

export const isDeclinedStatus = (status) => DECLINED_WORDS.test(status || '');
