// Conversión de HTML de correos a texto. Módulo aparte para poder probarlo en Node
// (con un DOMParser de prueba) además del navegador.

/**
 * HTML -> texto conservando la estructura: celdas de tabla separadas por
 * tabulador y filas, párrafos y <br> por salto de línea. Los espacios del código
 * fuente se colapsan como lo haría un navegador (el BCR escribe "Estimado\r\n(a):"
 * y pone tabuladores entre las celdas de su tabla).
 */
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style,script,head,title').forEach((n) => n.remove());
  const NL = '\u2028'; // salto "duro" que sobrevive al colapso de espacios
  (function collapse(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) c.nodeValue = c.nodeValue.replace(/\s+/g, ' ');
      else if (c.nodeType === 1 && c.nodeName !== 'PRE') collapse(c);
    }
  })(doc.body || doc);
  doc.querySelectorAll('br').forEach((b) => b.replaceWith(NL));
  // Celdas sin tablas anidadas: su texto en una línea + tabulador.
  [...doc.querySelectorAll('td,th')].reverse().forEach((c) => {
    if (c.querySelector('table')) return;
    c.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6').forEach((b) => b.append(NL));
    const t = c.textContent.replace(/ *\u2028 */g, NL).replace(/^\u2028+|\u2028+$/g, '').replace(/ +/g, ' ').trim();
    c.textContent = t + '\t';
  });
  doc.querySelectorAll('tr').forEach((r) => { if (!r.querySelector('table')) r.append('\n'); });
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,table').forEach((b) => { b.prepend('\n'); b.append('\n'); });
  return (doc.body?.textContent || '')
    .split(/[\n\u2028]/)
    .map((l) => l.replace(/ +/g, ' ').replace(/ ?\t ?/g, '\t').replace(/^\t+|\t+$/g, '').trim())
    .filter((l) => l.replace(/\t/g, '').trim())
    .join('\n');
}
