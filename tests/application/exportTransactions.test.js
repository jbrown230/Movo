// Pruebas de la exportación de movimientos a CSV, sobre una base SQLite real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { UTF8_BOM } from '../../web/src/domain/csv.js';
import { assertWellFormedXml, readCells, readMerges, readZipTexts, styleOf } from '../helpers/readXlsx.js';

/** Inserta un movimiento; `date` es la hora local del teléfono. */
function insert(storage, id, overrides) {
  storage.transactions.insert({
    id,
    date: overrides.date.toISOString(),
    amountCents: overrides.amountCents,
    currency: overrides.currency ?? 'CRC',
    crcCents: overrides.crcCents ?? overrides.amountCents,
    exchangeRate: overrides.exchangeRate ?? null,
    counterparty: overrides.counterparty,
    category: overrides.category ?? 'otros',
    categoryOrigin: 'regla automática',
    type: overrides.type ?? 'tarjeta',
    direction: overrides.direction ?? 'out',
    bank: overrides.bank === undefined ? 'BCR' : overrides.bank,
    mailKey: null,
    note: null,
  });
}

function sampleApp() {
  const app = createTestApp();
  insert(app.storage, 'cafe', {
    date: new Date(2026, 0, 14, 8, 5),
    amountCents: 250050,
    counterparty: 'CAFÉ "LA ESQUINA", SAN JOSÉ',
    category: 'comida',
    bank: 'BAC',
  });
  insert(app.storage, 'netflix', {
    date: new Date(2026, 0, 15, 21, 0),
    amountCents: 799,
    currency: 'USD',
    crcCents: 364024,
    exchangeRate: 455.6,
    counterparty: 'NETFLIX.COM',
    category: 'ocio',
  });
  insert(app.storage, 'pan', {
    date: new Date(2026, 0, 16, 7, 30),
    amountCents: 180000,
    counterparty: 'PAN DULCE',
    category: 'comida',
    type: 'efectivo',
    bank: null,
  });
  insert(app.storage, 'salario', {
    date: new Date(2026, 1, 1, 9, 0),
    amountCents: 50000000,
    counterparty: 'EMPRESA PRUEBA',
    category: 'ingreso',
    type: 'sinpe',
    direction: 'in',
    bank: 'BN',
  });
  return app;
}

const linesOf = (content) => content.slice(UTF8_BOM.length).trimEnd().split('\r\n');

test('exporta el rango pedido, del más viejo al más nuevo, con el encabezado en español', () => {
  const { services } = sampleApp();
  const file = services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' });

  assert.equal(file.count, 3);
  assert.equal(file.fileName, 'movo-movimientos-2026-01-14-a-2026-01-16.csv');
  assert.ok(file.content.startsWith(UTF8_BOM));
  const [header, ...rows] = linesOf(file.content);
  assert.equal(header, 'Fecha;Comercio;Monto;Moneda;Monto en colones;Categoría;Tipo;Medio;Banco');
  assert.deepEqual(
    rows.map((row) => row.split(';')[0]),
    ['2026-01-14 08:05', '2026-01-15 21:00', '2026-01-16 07:30'],
  );
});

test('con punto y coma: coma decimal, y el comercio con comillas y comas queda bien escrito', () => {
  const { services } = sampleApp();
  const [, cafe, netflix, pan] = linesOf(
    services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' }).content,
  );

  assert.equal(
    cafe,
    '2026-01-14 08:05;"CAFÉ ""LA ESQUINA"", SAN JOSÉ";2500,50;CRC;2500,50;Comida;Gasto;Tarjeta;BAC Credomatic',
  );
  assert.equal(netflix, '2026-01-15 21:00;NETFLIX.COM;7,99;USD;3640,24;Ocio;Gasto;Tarjeta;Banco de Costa Rica');
  assert.equal(pan, '2026-01-16 07:30;PAN DULCE;1800,00;CRC;1800,00;Comida;Gasto;Efectivo;', 'sin banco: celda vacía');
});

test('con coma: punto decimal, y las celdas con coma van entre comillas', () => {
  const { services } = sampleApp();
  const [header, cafe] = linesOf(
    services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-14', separator: ',' }).content,
  );
  assert.equal(header, 'Fecha,Comercio,Monto,Moneda,Monto en colones,Categoría,Tipo,Medio,Banco');
  assert.equal(
    cafe,
    '2026-01-14 08:05,"CAFÉ ""LA ESQUINA"", SAN JOSÉ",2500.50,CRC,2500.50,Comida,Gasto,Tarjeta,BAC Credomatic',
  );
});

test('sin fechas exporta todo, y un ingreso se marca como tal', () => {
  const { services } = sampleApp();
  const file = services.exportTransactions({});
  assert.equal(file.count, 4);
  assert.equal(file.fileName, 'movo-movimientos-inicio-a-hoy.csv');
  assert.match(linesOf(file.content).at(-1), /;Ingresos;Ingreso;SINPE;Banco Nacional$/);
});

test('los movimientos eliminados no se exportan, y un rango vacío da un archivo con solo el encabezado', () => {
  const { services } = sampleApp();
  services.deleteTransaction('netflix');
  assert.equal(services.exportTransactions({ fromDay: '2026-01-15', toDay: '2026-01-15' }).count, 0);
  assert.deepEqual(linesOf(services.exportTransactions({ fromDay: '2027-01-01' }).content).length, 1);
});

test('exporta solo lo que cumple los mismos filtros que la lista de movimientos', () => {
  const { services } = sampleApp();

  const byCategory = services.exportTransactions({ category: 'comida' });
  assert.equal(byCategory.count, 2);

  const byText = services.exportTransactions({ text: 'netflix' });
  assert.equal(byText.count, 1);
  assert.match(linesOf(byText.content)[1], /NETFLIX.COM/);

  const combined = services.exportTransactions({ category: 'comida', bank: 'BAC', minCents: 200000 });
  assert.equal(combined.count, 1);
  assert.match(linesOf(combined.content)[1], /LA ESQUINA/);

  assert.equal(services.exportTransactions({ text: 'no existe' }).count, 0);
});

// ---------------------------------------------------------------- Excel

const NOW = new Date(2026, 1, 3, 12, 5);
const PURPLE = '5A33E6';
const GREEN = '0E9F6E';
const GRAY = '8A859C';

/** Exporta un Excel y deja a mano sus celdas, celdas combinadas y una forma de ver el estilo de cada una. */
function excelOf(services, options = {}) {
  const file = services.exportTransactions({ format: 'xlsx', now: NOW, ...options });
  const files = readZipTexts(file.content);
  return {
    file,
    files,
    cells: readCells(files),
    merges: readMerges(files),
    style: (ref, cells) => styleOf(files, cells[ref]),
  };
}

test('el Excel es un .xlsx válido, con el nombre y el tipo de archivo correctos', () => {
  const { file, files } = excelOf(sampleApp().services);

  assert.equal(file.fileName, 'movo-movimientos-inicio-a-hoy.xlsx');
  assert.equal(file.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(file.count, 4);
  assert.ok(file.content instanceof Uint8Array);
  for (const [name, xml] of Object.entries(files)) assertWellFormedXml(xml, name);
});

test('el Excel abre con la marca de Movo, el rango de fechas y cuándo se generó, y una franja morada', () => {
  const { cells, merges, style } = excelOf(sampleApp().services);

  assert.equal(cells.A1.value, 'Movo');
  assert.deepEqual(style('A1', cells), { ...style('A1', cells), fontColor: PURPLE, isBold: true });
  assert.equal(cells.A2.value, 'REPORTE DE MOVIMIENTOS');
  assert.equal(cells.A3.value, '14/01/2026 – 01/02/2026 · 4 movimientos');
  assert.equal(cells.F3.value, 'Generado el 03/02/2026 12:05');
  assert.equal(style('F3', cells).horizontal, 'right');
  assert.equal(style('A5', cells).fillColor, PURPLE); // la franja
  assert.ok(['A1:I1', 'A2:I2', 'A3:E3', 'F3:I3', 'A5:I5'].every((range) => merges.includes(range)));
});

test('el Excel trae cuatro tarjetas con los totales: gastos, ingresos, entre mis cuentas y balance', () => {
  const { cells, merges, style } = excelOf(sampleApp().services);

  // Gastos: ₡2 500,50 + ₡3 640,24 + ₡1 800,00. Ingresos: ₡500 000. Balance: la resta.
  assert.deepEqual(
    ['A7', 'C7', 'F7', 'H7'].map((ref) => cells[ref].value),
    ['GASTOS', 'INGRESOS', 'ENTRE MIS CUENTAS', 'BALANCE'],
  );
  assert.deepEqual(
    ['A8', 'C8', 'F8', 'H8'].map((ref) => cells[ref].value),
    [7940.74, 500000, 0, 492059.26],
  );
  assert.deepEqual(['A7:B7', 'C7:E7', 'F7:G7', 'H7:I7'].filter((range) => merges.includes(range)).length, 4);
  assert.equal(style('C8', cells).fontColor, GREEN);
  assert.equal(style('H8', cells).fontColor, PURPLE);
  assert.equal(style('A8', cells).numFmt, '"₡"#,##0.00');
  assert.equal(style('A8', cells).fillColor, 'F6F5FA');
});

test('un balance negativo se ve en rojo', () => {
  const { storage, services } = sampleApp();
  insert(storage, 'gasto-grande', { date: new Date(2026, 1, 2, 9, 0), amountCents: 90000000, counterparty: 'TIENDA' });
  const { cells, style } = excelOf(services);

  assert.ok(cells.H8.value < 0);
  assert.equal(style('H8', cells).fontColor, 'DC2626');
});

test('el Excel trae el encabezado oscuro y una fila por movimiento, del más viejo al más nuevo', () => {
  const { cells, style } = excelOf(sampleApp().services);

  assert.deepEqual(
    ['A10', 'B10', 'C10', 'D10', 'E10', 'F10', 'G10', 'H10', 'I10'].map((ref) => cells[ref].value),
    ['Fecha', 'Comercio', 'Monto', 'Moneda', 'Monto en colones', 'Categoría', 'Tipo', 'Medio', 'Banco'],
  );
  assert.equal(style('A10', cells).fillColor, '14111F');
  assert.equal(style('A10', cells).fontColor, 'FFFFFF');
  assert.equal(style('C10', cells).horizontal, 'right');
  assert.deepEqual(
    ['B11', 'B12', 'B13', 'B14'].map((ref) => cells[ref].value),
    ['CAFÉ "LA ESQUINA", SAN JOSÉ', 'NETFLIX.COM', 'PAN DULCE', 'EMPRESA PRUEBA'],
  );
});

test('en las filas, la fecha es una fecha real, los montos son números y las filas se alternan de color', () => {
  const { cells, style } = excelOf(sampleApp().services);

  assert.equal(style('A11', cells).numFmt, 'dd/mm/yyyy\\ hh:mm');
  assert.equal(cells.A11.value, (Date.UTC(2026, 0, 14, 8, 5) - Date.UTC(1899, 11, 30)) / 86_400_000);
  assert.equal(cells.C11.value, 2500.5);
  assert.equal(cells.C12.value, 7.99); // el monto original, en dólares
  assert.equal(cells.D12.value, 'USD');
  assert.equal(cells.E12.value, 3640.24); // y convertido a colones
  assert.deepEqual(
    ['A11', 'A12', 'A13', 'A14'].map((ref) => style(ref, cells).fillColor),
    ['FFFFFF', 'F5F3FF', 'FFFFFF', 'F5F3FF'],
  );
});

test('el monto en colones va en negrita: verde si es ingreso, gris si es entre mis cuentas y oscuro si es gasto', () => {
  const { services, storage } = sampleApp();
  insert(storage, 'propio', {
    date: new Date(2026, 0, 25, 9, 0),
    amountCents: 5000,
    counterparty: 'MI OTRA CUENTA',
    direction: 'self',
  });
  const { cells, style } = excelOf(services);

  assert.equal(cells.B14.value, 'MI OTRA CUENTA');
  assert.equal(style('E11', cells).fontColor, '14111F'); // gasto
  assert.equal(style('E14', cells).fontColor, GRAY); // entre mis cuentas
  assert.equal(style('E15', cells).fontColor, GREEN); // ingreso
  assert.equal(style('E15', cells).isBold, true);
});

test('el Excel cierra con el balance en una franja morada', () => {
  const { cells, merges, style } = excelOf(sampleApp().services);

  assert.equal(cells.A15.value, 'BALANCE DEL PERÍODO');
  assert.equal(cells.E15.value, 492059.26);
  assert.equal(style('A15', cells).fillColor, PURPLE);
  assert.equal(style('E15', cells).numFmt, '"₡"#,##0.00');
  assert.ok(merges.includes('A15:D15'));
});

test('en el Excel el comercio es texto aunque parezca una fórmula', () => {
  const { storage, services } = sampleApp();
  insert(storage, 'raro', {
    date: new Date(2026, 0, 20, 9, 0),
    amountCents: 1000,
    counterparty: '=HYPERLINK("x") & <Co>',
  });
  const { files, cells } = excelOf(services);

  assert.equal(cells.B14.value, '=HYPERLINK("x") & <Co>');
  assert.match(
    files['xl/worksheets/sheet1.xml'],
    /<t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\) &amp; &lt;Co&gt;<\/t>/,
  );
});

test('el Excel anota los filtros puestos y respeta los mismos filtros que la lista', () => {
  const { file, cells, merges } = excelOf(sampleApp().services, {
    category: 'comida',
    filterLabels: ['Comida', 'Este mes'],
  });

  assert.equal(file.count, 2);
  assert.equal(cells.A4.value, 'Filtros: Comida · Este mes');
  assert.ok(merges.includes('A4:I4'));
  assert.equal(cells.A3.value, '14/01/2026 – 16/01/2026 · 2 movimientos');
});

test('el Excel sin movimientos sigue siendo un archivo válido, con un aviso en lugar de la tabla', () => {
  const { file, files, cells, merges } = excelOf(sampleApp().services, { text: 'no existe' });

  assert.equal(file.count, 0);
  for (const [name, xml] of Object.entries(files)) assertWellFormedXml(xml, name);
  assert.equal(cells.A3.value, 'Sin movimientos');
  assert.equal(cells.A8.value, 0);
  assert.equal(cells.A11.value, 'No hay movimientos con estos filtros.');
  assert.ok(merges.includes('A11:I11'));
});

test('sin pedir un formato se sigue exportando CSV', () => {
  const { services } = sampleApp();
  const file = services.exportTransactions({});
  assert.equal(file.mimeType, 'text/csv;charset=utf-8');
  assert.ok(file.fileName.endsWith('.csv'));
  assert.equal(typeof file.content, 'string');
});
