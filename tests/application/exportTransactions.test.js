// Pruebas de la exportación de movimientos a CSV, sobre una base SQLite real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { UTF8_BOM } from '../../web/src/domain/csv.js';
import ExcelJS from 'exceljs';
import { findCell, loadWorkbook, lookOf, rgb, valuesOfRow } from '../helpers/readWorkbook.js';

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

test('exporta el rango pedido, del más viejo al más nuevo, con el encabezado en español', async () => {
  const { services } = sampleApp();
  const file = await services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' });

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

test('con punto y coma: coma decimal, y el comercio con comillas y comas queda bien escrito', async () => {
  const { services } = sampleApp();
  const file = await services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-16' });
  const [, cafe, netflix, pan] = linesOf(file.content);

  assert.equal(
    cafe,
    '2026-01-14 08:05;"CAFÉ ""LA ESQUINA"", SAN JOSÉ";2500,50;CRC;2500,50;Comida;Gasto;Tarjeta;BAC Credomatic',
  );
  assert.equal(netflix, '2026-01-15 21:00;NETFLIX.COM;7,99;USD;3640,24;Ocio;Gasto;Tarjeta;Banco de Costa Rica');
  assert.equal(pan, '2026-01-16 07:30;PAN DULCE;1800,00;CRC;1800,00;Comida;Gasto;Efectivo;', 'sin banco: celda vacía');
});

test('con coma: punto decimal, y las celdas con coma van entre comillas', async () => {
  const { services } = sampleApp();
  const file = await services.exportTransactions({ fromDay: '2026-01-14', toDay: '2026-01-14', separator: ',' });
  const [header, cafe] = linesOf(file.content);
  assert.equal(header, 'Fecha,Comercio,Monto,Moneda,Monto en colones,Categoría,Tipo,Medio,Banco');
  assert.equal(
    cafe,
    '2026-01-14 08:05,"CAFÉ ""LA ESQUINA"", SAN JOSÉ",2500.50,CRC,2500.50,Comida,Gasto,Tarjeta,BAC Credomatic',
  );
});

test('sin fechas exporta todo, y un ingreso se marca como tal', async () => {
  const { services } = sampleApp();
  const file = await services.exportTransactions({});
  assert.equal(file.count, 4);
  assert.equal(file.fileName, 'movo-movimientos-inicio-a-hoy.csv');
  assert.match(linesOf(file.content).at(-1), /;Ingresos;Ingreso;SINPE;Banco Nacional$/);
});

test('los movimientos eliminados no se exportan, y un rango vacío da un archivo con solo el encabezado', async () => {
  const { services } = sampleApp();
  services.deleteTransaction('netflix');
  assert.equal((await services.exportTransactions({ fromDay: '2026-01-15', toDay: '2026-01-15' })).count, 0);
  assert.deepEqual(linesOf((await services.exportTransactions({ fromDay: '2027-01-01' })).content).length, 1);
});

test('exporta solo lo que cumple los mismos filtros que la lista de movimientos', async () => {
  const { services } = sampleApp();

  const byCategory = await services.exportTransactions({ category: 'comida' });
  assert.equal(byCategory.count, 2);

  const byText = await services.exportTransactions({ text: 'netflix' });
  assert.equal(byText.count, 1);
  assert.match(linesOf(byText.content)[1], /NETFLIX.COM/);

  const combined = await services.exportTransactions({ category: 'comida', bank: 'BAC', minCents: 200000 });
  assert.equal(combined.count, 1);
  assert.match(linesOf(combined.content)[1], /LA ESQUINA/);

  assert.equal((await services.exportTransactions({ text: 'no existe' })).count, 0);
});

// ---------------------------------------------------------------- Excel

const NOW = new Date(2026, 1, 3, 12, 5);
const PURPLE = '5A33E6';
const GREEN = '0E9F6E';
const GRAY = '8A859C';
const INK = '14111F';

/** Exporta un Excel y lo abre con ExcelJS, como lo vería Excel. */
async function excelOf(services, options = {}) {
  const file = await services.exportTransactions({ format: 'xlsx', now: NOW, ...options });
  const workbook = await loadWorkbook(file.content);
  return { file, workbook, sheet: workbook.getWorksheet('Movimientos') };
}

/** El número de la fila donde empieza la tabla (la del encabezado "Fecha"). */
const headerRowOf = (sheet) => findCell(sheet, 'Fecha').row;

test('el Excel es un .xlsx válido, con el nombre y el tipo de archivo correctos', async () => {
  const { file, workbook, sheet } = await excelOf(sampleApp().services);

  assert.equal(file.fileName, 'movo-movimientos-inicio-a-hoy.xlsx');
  assert.equal(file.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(file.count, 4);
  assert.ok(file.content instanceof Uint8Array);
  assert.deepEqual([file.content[0], file.content[1]], [0x50, 0x4b]); // "PK": un ZIP, que es lo que es un .xlsx
  assert.equal(workbook.creator, 'Movo');
  assert.ok(sheet);
  assert.equal(sheet.views[0].showGridLines, false);
  assert.equal(sheet.pageSetup.orientation, 'landscape');
});

test('el Excel abre con la marca de Movo, el rango de fechas y cuándo se generó, y una franja morada', async () => {
  const { sheet } = await excelOf(sampleApp().services);

  const title = findCell(sheet, 'Movo');
  assert.equal(title.address, 'A1');
  assert.deepEqual(lookOf(title), { ...lookOf(title), isBold: true, fontColor: INK, fontSize: 20 });
  assert.equal(lookOf(findCell(sheet, 'REPORTE DE MOVIMIENTOS')).fontColor, PURPLE);
  assert.equal(findCell(sheet, '14/01/2026 – 01/02/2026 · 4 movimientos').row, 3);
  const generated = findCell(sheet, 'Generado el 03/02/2026 12:05');
  assert.equal(lookOf(generated).horizontal, 'right');

  const bar = sheet.getRow(4);
  assert.equal(bar.height, 4);
  assert.equal(lookOf(bar.getCell(1)).fillColor, PURPLE);
  assert.ok(['A1:I1', 'A2:I2', 'A3:E3', 'F3:I3', 'A4:I4'].every((range) => sheet.model.merges.includes(range)));
});

test('el Excel trae cuatro tarjetas con los totales: gastos, ingresos, entre mis cuentas y balance', async () => {
  const { sheet } = await excelOf(sampleApp().services);

  // Gastos: ₡2 500,50 + ₡3 640,24 + ₡1 800,00. Ingresos: ₡500 000. Balance: la resta.
  const valueUnder = (label) => {
    const labelCell = findCell(sheet, label);
    return sheet.getCell(labelCell.row + 1, labelCell.col);
  };
  assert.deepEqual(
    ['GASTOS', 'INGRESOS', 'ENTRE MIS CUENTAS', 'BALANCE'].map((label) => valueUnder(label).value),
    [7940.74, 500000, 0, 492059.26],
  );
  assert.equal(lookOf(valueUnder('INGRESOS')).fontColor, GREEN);
  assert.equal(lookOf(valueUnder('BALANCE')).fontColor, PURPLE);
  assert.equal(lookOf(valueUnder('GASTOS')).numFmt, '"₡"#,##0.00');
  assert.equal(lookOf(valueUnder('GASTOS')).fillColor, 'F9FAFB');
  assert.equal(rgb(findCell(sheet, 'GASTOS').border.top.color), PURPLE); // el filete morado de la tarjeta
  assert.ok(['A6:B6', 'C6:E6', 'F6:G6', 'H6:I6'].every((range) => sheet.model.merges.includes(range)));
});

test('un balance negativo se ve en rojo', async () => {
  const { storage, services } = sampleApp();
  insert(storage, 'gasto-grande', { date: new Date(2026, 1, 2, 9, 0), amountCents: 90000000, counterparty: 'TIENDA' });
  const { sheet } = await excelOf(services);

  const labelCell = findCell(sheet, 'BALANCE');
  const balance = sheet.getCell(labelCell.row + 1, labelCell.col);
  assert.ok(balance.value < 0);
  assert.equal(lookOf(balance).fontColor, 'DC2626');
});

test('el Excel trae el encabezado oscuro y una fila por movimiento, del más viejo al más nuevo', async () => {
  const { sheet } = await excelOf(sampleApp().services);

  const header = headerRowOf(sheet);
  assert.deepEqual(valuesOfRow(sheet, header), [
    'Fecha',
    'Comercio',
    'Monto',
    'Moneda',
    'Monto en colones',
    'Categoría',
    'Tipo',
    'Medio',
    'Banco',
  ]);
  const look = lookOf(sheet.getCell(header, 1));
  assert.deepEqual([look.fillColor, look.fontColor, look.isBold], [INK, 'FFFFFF', true]);
  assert.equal(lookOf(sheet.getCell(header, 3)).horizontal, 'right');
  assert.deepEqual(
    [1, 2, 3, 4].map((offset) => sheet.getCell(header + offset, 2).value),
    ['CAFÉ "LA ESQUINA", SAN JOSÉ', 'NETFLIX.COM', 'PAN DULCE', 'EMPRESA PRUEBA'],
  );
});

test('en las filas, la fecha es una fecha real, los montos son números y las filas se alternan de color', async () => {
  const { sheet } = await excelOf(sampleApp().services);
  const first = headerRowOf(sheet) + 1;

  const date = sheet.getCell(first, 1);
  assert.ok(date.value instanceof Date);
  assert.equal(date.value.toISOString(), '2026-01-14T08:05:00.000Z'); // la hora del teléfono, tal cual
  assert.equal(lookOf(date).numFmt, 'dd/mm/yyyy hh:mm');
  assert.equal(sheet.getCell(first, 3).value, 2500.5);
  assert.equal(sheet.getCell(first + 1, 3).value, 7.99); // el monto original, en dólares
  assert.equal(sheet.getCell(first + 1, 4).value, 'USD');
  assert.equal(sheet.getCell(first + 1, 5).value, 3640.24); // y convertido a colones
  assert.deepEqual(
    [0, 1, 2, 3].map((offset) => lookOf(sheet.getCell(first + offset, 1)).fillColor),
    ['FFFFFF', 'F5F3FF', 'FFFFFF', 'F5F3FF'],
  );
});

test('el monto en colones va en negrita: verde si es ingreso, gris si es entre mis cuentas y oscuro si es gasto', async () => {
  const { services, storage } = sampleApp();
  insert(storage, 'propio', {
    date: new Date(2026, 0, 25, 9, 0),
    amountCents: 5000,
    counterparty: 'MI OTRA CUENTA',
    direction: 'self',
  });
  const { sheet } = await excelOf(services);
  const first = headerRowOf(sheet) + 1;

  const amountLook = (offset) => lookOf(sheet.getCell(first + offset, 5));
  assert.equal(sheet.getCell(first + 3, 2).value, 'MI OTRA CUENTA');
  assert.equal(amountLook(0).fontColor, INK); // gasto
  assert.equal(amountLook(3).fontColor, GRAY); // entre mis cuentas
  assert.equal(amountLook(4).fontColor, GREEN); // ingreso
  assert.equal(amountLook(4).isBold, true);
});

test('el Excel cierra con el balance en una franja morada', async () => {
  const { sheet } = await excelOf(sampleApp().services);

  const label = findCell(sheet, 'BALANCE DEL PERÍODO');
  assert.equal(lookOf(label).fillColor, PURPLE);
  assert.equal(sheet.getCell(label.row, 5).value, 492059.26);
  assert.equal(lookOf(sheet.getCell(label.row, 5)).numFmt, '"₡"#,##0.00');
  assert.ok(sheet.model.merges.includes(`A${label.row}:D${label.row}`));
});

test('en el Excel el comercio es texto aunque parezca una fórmula', async () => {
  const { storage, services } = sampleApp();
  insert(storage, 'raro', {
    date: new Date(2026, 0, 20, 9, 0),
    amountCents: 1000,
    counterparty: '=HYPERLINK("x") & <Co>',
  });
  const { sheet } = await excelOf(services);

  const cell = sheet.getCell(headerRowOf(sheet) + 4, 2);
  assert.equal(cell.value, '=HYPERLINK("x") & <Co>');
  assert.equal(cell.type, ExcelJS.ValueType.String); // no es una fórmula
});

test('el Excel anota los filtros puestos y respeta los mismos filtros que la lista', async () => {
  const { file, sheet } = await excelOf(sampleApp().services, {
    category: 'comida',
    filterLabels: ['Comida', 'Este mes'],
  });

  assert.equal(file.count, 2);
  const filters = findCell(sheet, 'Filtros: Comida · Este mes');
  assert.ok(sheet.model.merges.includes(`A${filters.row}:I${filters.row}`));
  assert.equal(findCell(sheet, '14/01/2026 – 16/01/2026 · 2 movimientos').row, 3);
});

test('el Excel sin movimientos sigue siendo un archivo válido, con un aviso en lugar de la tabla', async () => {
  const { file, sheet } = await excelOf(sampleApp().services, { text: 'no existe' });

  assert.equal(file.count, 0);
  assert.equal(findCell(sheet, 'Sin movimientos').row, 3);
  assert.equal(findCell(sheet, 'No hay movimientos con estos filtros.').row, headerRowOf(sheet) + 1);
  assert.throws(() => findCell(sheet, 'BALANCE DEL PERÍODO'));
});

test('sin pedir un formato se sigue exportando CSV', async () => {
  const { services } = sampleApp();
  const file = await services.exportTransactions({});
  assert.equal(file.mimeType, 'text/csv;charset=utf-8');
  assert.ok(file.fileName.endsWith('.csv'));
  assert.equal(typeof file.content, 'string');
});
