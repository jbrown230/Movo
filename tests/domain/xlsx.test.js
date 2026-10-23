// Pruebas del empaquetador ZIP y del libro de Excel (dominio puro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../../web/src/domain/zip.js';
import { Style, buildXlsx, escapeXml } from '../../web/src/domain/xlsx.js';
import { assertWellFormedXml, readZipTexts } from '../helpers/readXlsx.js';

const encode = (text) => new TextEncoder().encode(text);

test('crc32 da el valor conocido de la prueba estándar', () => {
  assert.equal(crc32(encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('un ZIP se puede leer de vuelta: nombres con tildes, contenido, CRC y cantidad de archivos', () => {
  const zip = zipStore([
    { name: 'a.txt', data: encode('hola ₡500') },
    { name: 'carpeta/ñandú.txt', data: encode('') },
  ]);
  assert.deepEqual(readZipTexts(zip), { 'a.txt': 'hola ₡500', 'carpeta/ñandú.txt': '' });
});

test('escapeXml cambia los símbolos y quita los caracteres que XML no admite', () => {
  assert.equal(escapeXml('A&B <c> "d" \'e\''), 'A&amp;B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  assert.equal(escapeXml('a\u0000b\u0007c'), 'abc');
});

const SAMPLE = {
  name: 'Movimientos',
  columnWidths: [20, 30],
  autoFilterRow: 2,
  rows: [
    { height: 30, cells: [{ value: 'Movo', style: Style.BRAND }, null] },
    {
      cells: [
        { value: 'Comercio', style: Style.HEADER },
        { value: 'Monto', style: Style.HEADER_RIGHT },
      ],
    },
    {
      cells: [
        { value: '=SUMA(1;1) & <b>', style: Style.TEXT },
        { value: 1234.5, style: Style.COLONES },
      ],
    },
    { cells: [{ value: null, style: Style.TEXT }] },
  ],
};

test('el libro trae las partes que Excel necesita, todas con XML bien formado', () => {
  const files = readZipTexts(buildXlsx(SAMPLE));
  assert.deepEqual(Object.keys(files).sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ]);
  for (const [name, xml] of Object.entries(files)) assertWellFormedXml(xml, name);
});

test('los textos van dentro de la celda y nunca como fórmula; los números, como números', () => {
  const sheet = readZipTexts(buildXlsx(SAMPLE))['xl/worksheets/sheet1.xml'];
  assert.match(
    sheet,
    /<c r="A3" s="9" t="inlineStr"><is><t xml:space="preserve">=SUMA\(1;1\) &amp; &lt;b&gt;<\/t><\/is><\/c>/,
  );
  assert.match(sheet, /<c r="B3" s="11"><v>1234.5<\/v><\/c>/);
  assert.match(sheet, /<c r="A4" s="9"\/>/); // una celda vacía con estilo conserva su borde
  assert.match(sheet, /<autoFilter ref="A2:B4"\/>/);
  assert.match(sheet, /<row r="1" ht="30" customHeight="1">/);
});

test('el estilo de cada celda existe en la hoja de estilos', () => {
  const styles = readZipTexts(buildXlsx(SAMPLE))['xl/styles.xml'];
  const declared = Number(styles.match(/<cellXfs count="(\d+)"/)[1]);
  assert.equal(declared, Object.keys(Style).length);
  assert.equal((styles.match(/<xf /g) ?? []).length, declared + 1); // + el estilo base de cellStyleXfs
});
