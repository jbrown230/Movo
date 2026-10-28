// Utilidades para nombres de comercios y de personas.

/** Clave para comparar nombres: mayúsculas, sin tildes y con espacios simples. */
export function normalizeKey(text) {
  return String(text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "SODA DONA ROSA" -> "Soda Dona Rosa". */
export function toTitleCase(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/(^|[\s.*\-(])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());
}

const COUNTRY_SUFFIX = /\s+(US|USA|CR|CRI|NI|GB|IE|NL|CA|MX)\s*$/i;
const LONG_NUMBER = /\b\d{6,}\b/g;

/**
 * Nombre de comercio listo para mostrar, al estilo de las apps bancarias:
 * "SERVICIO DIGITAL SUB  00000000000 US" -> "Servicio Digital Sub".
 * Quita los números largos (teléfonos, ids) y el código de país del final.
 * El texto original se conserva aparte, porque las reglas de categoría lo usan.
 */
export function displayName(rawName) {
  const raw = String(rawName || '');
  const cleaned = raw.replace(LONG_NUMBER, ' ').replace(COUNTRY_SUFFIX, '').replace(/\s+/g, ' ').trim();
  return toTitleCase(cleaned || raw);
}

const MIN_SHARED_WORDS = 3;

function nameWords(name) {
  return normalizeKey(name)
    .replace(/[^A-Z ]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 1);
}

/** Dos palabras coinciden si son iguales o una es el inicio de la otra (nombres recortados). */
const sameWord = (first, second) => first === second || second.startsWith(first) || first.startsWith(second);

/**
 * ¿Dos nombres son la misma persona?
 * Tolera orden distinto, tildes y nombres recortados por el banco
 * ("APELLIDO1 APELLIDO2 NOMBRE1 NO"), pero exige al menos 3 palabras en común
 * para no confundir a familiares que comparten apellidos.
 */
export function isSamePerson(nameA, nameB) {
  const wordsA = nameWords(nameA);
  const wordsB = nameWords(nameB);
  if (!wordsA.length || !wordsB.length) return false;
  if (wordsA.join(' ') === wordsB.join(' ')) return true;

  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.length < MIN_SHARED_WORDS) return false;

  const usedIndexes = new Set();
  for (const word of shorter) {
    const matchIndex = longer.findIndex((other, index) => !usedIndexes.has(index) && sameWord(word, other));
    if (matchIndex === -1) return false; // cada palabra del nombre corto debe aparecer en el largo
    usedIndexes.add(matchIndex);
  }
  return true;
}
