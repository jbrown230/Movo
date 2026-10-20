// Conversión de HTML de correos a texto. Usa DOMParser, que existe en el navegador
// y se puede simular en las pruebas de Node (con linkedom).

// Salto de línea "duro" (carácter separador de línea, U+2028). Sobrevive al colapso de
// espacios porque no es un espacio en blanco normal. Se arma con su código para que
// ningún editor lo confunda con un salto de línea real dentro del código fuente.
const HARD_LINE_BREAK = String.fromCharCode(0x2028);

const AROUND_BREAKS = new RegExp(` *${HARD_LINE_BREAK} *`, 'g');
const EDGE_BREAKS = new RegExp(`^${HARD_LINE_BREAK}+|${HARD_LINE_BREAK}+$`, 'g');
const ANY_LINE_BREAK = new RegExp(`[\\n${HARD_LINE_BREAK}]`);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/**
 * Linkedom (y a veces un HTML pegado desde Gmail) deja un <table> como raíz del
 * documento, con un body vacío. Hay que leer esa raíz, no el body hueco.
 */
function contentRoot(doc) {
  if (doc.body && doc.body.childNodes.length > 0) return doc.body;
  return doc.documentElement || doc;
}

/** Colapsa los espacios del texto como lo haría un navegador (excepto dentro de <pre>). */
function collapseWhitespace(node) {
  for (const child of node.childNodes) {
    if (child.nodeType === TEXT_NODE) {
      child.nodeValue = child.nodeValue.replace(/\s+/g, ' ');
    } else if (child.nodeType === ELEMENT_NODE && child.nodeName !== 'PRE') {
      collapseWhitespace(child);
    }
  }
}

/** Cada celda sin tablas anidadas queda como una sola línea de texto seguida de un tabulador. */
function flattenTableCells(doc) {
  const cells = [...doc.querySelectorAll('td,th')].reverse(); // de adentro hacia afuera
  for (const cell of cells) {
    if (cell.querySelector('table')) continue;
    cell.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6').forEach((block) => block.append(HARD_LINE_BREAK));
    const text = cell.textContent
      .replace(AROUND_BREAKS, HARD_LINE_BREAK)
      .replace(EDGE_BREAKS, '')
      .replace(/ +/g, ' ')
      .trim();
    cell.textContent = text + '\t';
  }
}

/**
 * HTML -> texto conservando la estructura: las celdas de una tabla quedan separadas
 * por tabulador, y las filas, párrafos y <br> por salto de línea.
 *
 * Los espacios del código fuente se colapsan como en un navegador. Esto importa
 * porque el BCR escribe "Estimado\r\n(a):" y pone tabuladores entre las celdas.
 */
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style,script,head,title').forEach((node) => node.remove());

  const root = contentRoot(doc);
  collapseWhitespace(root);
  doc.querySelectorAll('br').forEach((br) => br.replaceWith(HARD_LINE_BREAK));
  flattenTableCells(doc);
  doc.querySelectorAll('tr').forEach((row) => {
    if (!row.querySelector('table')) row.append('\n');
  });
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,table').forEach((block) => {
    block.prepend('\n');
    block.append('\n');
  });

  return (root.textContent || '')
    .split(ANY_LINE_BREAK)
    .map((line) =>
      line
        .replace(/ +/g, ' ')
        .replace(/ ?\t ?/g, '\t')
        .replace(/^\t+|\t+$/g, '')
        .trim(),
    )
    .filter((line) => line.replace(/\t/g, '').trim())
    .join('\n');
}
