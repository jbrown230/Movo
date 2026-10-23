// Pruebas del empaquetador ZIP y del libro de Excel (dominio puro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../../web/src/domain/zip.js';
import { buildXlsx, escapeXml } from '../../web/src/domain/xlsx.js';
import { assertWellFormedXml, readCells, readMerges, readZipTexts, styleOf } from '../helpers/readXlsx.js';

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

const PURPLE = { font: { size: 24, bold: true, color: '5A33E6' }, fill: 'F5F3FF' };
const MONEY = {
  numFmt: '"₡"#,##0.00',
  font: { color: '0E9F6E', bold: true },
  border: { bottom: { style: 'thin', color: 'E5E2EE' } },
  align: { horizontal: 'right', vertical: 'center' },
};

const SAMPLE = {
  name: 'Movimientos',
  columnWidths: [20, 30, 12],
  merges: ['A1:C1'],
  isLandscape: true,
  rows: [
    {
      height: 30,
      cells: [
        { value: 'Movo', style: PURPLE },
        { value: null, style: PURPLE },
        { value: null, style: PURPLE },
      ],
    },
    { cells: [{ value: '=SUMA(1;1) & <b>' }, { value: 1234.5, style: MONEY }, { value: 7.5, style: MONEY }] },
    { cells: [{ value: 'a', style: { numFmt: '#,##0.00' } }, null, { value: null }] },
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
  const cells = readCells(readZipTexts(buildXlsx(SAMPLE)));
  assert.equal(cells.A2.value, '=SUMA(1;1) & <b>');
  assert.equal(cells.B2.value, 1234.5);
  assert.equal(cells.A3.value, 'a');
  assert.equal(cells.C3.value, null); // una celda vacía con estilo conserva su formato
});

test('se escriben las celdas combinadas, las alturas y la orientación de la hoja', () => {
  const files = readZipTexts(buildXlsx(SAMPLE));
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.deepEqual(readMerges(files), ['A1:C1']);
  assert.match(sheet, /<mergeCells count="1">/);
  assert.match(sheet, /<row r="1" ht="30" customHeight="1">/);
  assert.match(sheet, /<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"\/>/);
});

test('cada estilo trae su tipografía, relleno, formato de número y alineación', () => {
  const files = readZipTexts(buildXlsx(SAMPLE));
  const cells = readCells(files);

  assert.deepEqual(styleOf(files, cells.A1), {
    fontColor: '5A33E6',
    isBold: true,
    fillColor: 'F5F3FF',
    numFmt: 0,
    horizontal: null,
  });
  assert.deepEqual(styleOf(files, cells.B2), {
    fontColor: '0E9F6E',
    isBold: true,
    fillColor: null,
    numFmt: '"₡"#,##0.00',
    horizontal: 'right',
  });
  assert.equal(styleOf(files, cells.A3).numFmt, 4); // "#,##0.00" ya existe en Excel: no se declara de nuevo
  assert.match(files['xl/styles.xml'], /<bottom style="thin"><color rgb="FFE5E2EE"\/><\/bottom>/);
});

test('un estilo repetido se escribe una sola vez, y uno distinto es otro', () => {
  const files = readZipTexts(buildXlsx(SAMPLE));
  const cells = readCells(files);
  assert.equal(cells.A1.style, cells.B1.style);
  assert.equal(cells.B2.style, cells.C2.style);
  assert.notEqual(cells.A1.style, cells.B2.style);
  assert.equal(cells.A2.style, 0); // sin estilo: el básico

  const declared = Number(files['xl/styles.xml'].match(/<cellXfs count="(\d+)"/)[1]);
  const inCellXfs = files['xl/styles.xml'].match(/<cellXfs.*?<\/cellXfs>/s)[0];
  assert.equal((inCellXfs.match(/<xf /g) ?? []).length, declared);
});
