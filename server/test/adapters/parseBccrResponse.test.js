import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLatestRate } from '../../src/adapters/bccr/parseBccrResponse.js';

// Respuesta de ejemplo con la forma que documenta el BCCR para la API del SDDE. Los valores son inventados.
const SAMPLE_RESPONSE = {
  estado: true,
  mensaje: 'Consulta exitosa',
  datos: [
    {
      codigoIndicador: '318',
      nombreIndicador: 'Tipo cambio venta',
      series: [
        { fecha: '2026-01-14', valorDatoPorPeriodo: 505.1 },
        { fecha: '2026-01-15', valorDatoPorPeriodo: 505.554 },
        { fecha: '2026-01-16', valorDatoPorPeriodo: null },
      ],
    },
  ],
};

test('toma el último valor publicado y lo redondea a dos decimales', () => {
  assert.deepEqual(parseLatestRate(SAMPLE_RESPONSE), {
    rate: 505.55,
    date: '2026-01-15',
    source: 'BCCR, tipo de cambio de venta',
  });
});

test('no depende del orden de la serie y recorta la hora de la fecha', () => {
  const series = [
    { fecha: '2026-01-15T00:00:00', valorDatoPorPeriodo: 506 },
    { fecha: '2026-01-13T00:00:00', valorDatoPorPeriodo: 504 },
  ];
  const latest = parseLatestRate({ estado: true, datos: [{ series }] });
  assert.equal(latest.rate, 506);
  assert.equal(latest.date, '2026-01-15');
});

test('una respuesta sin datos lanza un error claro', () => {
  assert.throws(() => parseLatestRate({ estado: true, datos: [] }), /BCCR sin datos/);
  assert.throws(() => parseLatestRate({ estado: true, datos: [{ series: [{ fecha: '2026-01-16' }] }] }), /sin datos/);
  assert.throws(() => parseLatestRate(null), /BCCR sin datos/);
});

test('una consulta rechazada lanza el mensaje del BCCR', () => {
  assert.throws(() => parseLatestRate({ estado: false, mensaje: 'Token inválido', datos: [] }), /BCCR: Token inválido/);
});
