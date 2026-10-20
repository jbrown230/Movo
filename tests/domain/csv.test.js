// Pruebas del formato CSV: lo que Excel necesita para abrir bien el archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UTF8_BOM, csvCell, toCsv } from '../../web/src/domain/csv.js';

test('una celda simple queda tal cual, aunque tenga tildes, ñ o ₡', () => {
  assert.equal(csvCell('Panadería Ñandú ₡', ';'), 'Panadería Ñandú ₡');
});

test('una celda con el separador va entre comillas', () => {
  assert.equal(csvCell('SODA, LA CEIBA', ','), '"SODA, LA CEIBA"');
  assert.equal(csvCell('SODA; LA CEIBA', ';'), '"SODA; LA CEIBA"');
  assert.equal(csvCell('SODA, LA CEIBA', ';'), 'SODA, LA CEIBA', 'con punto y coma, la coma no molesta');
});

test('las comillas internas se duplican y la celda va entre comillas', () => {
  assert.equal(csvCell('BAR "EL RINCÓN"', ';'), '"BAR ""EL RINCÓN"""');
});

test('saltos de línea y espacios en los bordes van entre comillas', () => {
  assert.equal(csvCell('LÍNEA 1\nLÍNEA 2', ';'), '"LÍNEA 1\nLÍNEA 2"');
  assert.equal(csvCell(' CON ESPACIO ', ';'), '" CON ESPACIO "');
});

test('vacíos y números', () => {
  assert.equal(csvCell(null, ';'), '');
  assert.equal(csvCell(undefined, ';'), '');
  assert.equal(csvCell(1250, ';'), '1250');
});

test('un texto que parece fórmula lleva un apóstrofo para que la hoja no lo ejecute', () => {
  assert.equal(csvCell('=HYPERLINK("x")', ','), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('+50688888888', ';'), "'+50688888888");
  assert.equal(csvCell('-1', ';'), "'-1");
});

test('el archivo empieza con la marca UTF-8 y usa fin de línea de Windows', () => {
  const content = toCsv(['Fecha', 'Comercio'], [['2026-01-15 10:30', 'CAFÉ, PAN']], ',');
  assert.ok(content.startsWith(UTF8_BOM));
  assert.equal(content.slice(1), 'Fecha,Comercio\r\n2026-01-15 10:30,"CAFÉ, PAN"\r\n');
});
