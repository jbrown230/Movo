import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeries } from '../../src/adapters/bccr/parseBccrResponse.js';

// Respuesta de ejemplo con la forma que documenta el BCCR para la API del SDDE. Los valores son inventados.
const SAMPLE_RESPONSE = {
  estado: true,
  mensaje: 'Consulta exitosa',
  datos: [
    {
      codigoIndicador: '318',
      nombreIndicador: 'Tipo cambio venta',
      series: [
        { fecha: '2026-01-15T00:00:00', valorDatoPorPeriodo: 505.554 },
        { fecha: '2026-01-14', valorDatoPorPeriodo: 505.1 },
        { fecha: '2026-01-16', valorDatoPorPeriodo: null },
      ],
    },
  ],
};

test('devuelve los días con valor, ordenados y sin la hora, sin redondear', () => {
  assert.deepEqual(parseSeries(SAMPLE_RESPONSE), [
    { date: '2026-01-14', value: 505.1 },
    { date: '2026-01-15', value: 505.554 },
  ]);
});

test('una respuesta sin datos lanza un error claro', () => {
  assert.throws(() => parseSeries({ estado: true, datos: [] }), /BCCR sin datos/);
  assert.throws(() => parseSeries({ estado: true, datos: [{ series: [{ fecha: '2026-01-16' }] }] }), /sin datos/);
  assert.throws(() => parseSeries(null), /BCCR sin datos/);
});

test('una consulta rechazada lanza el mensaje del BCCR', () => {
  assert.throws(() => parseSeries({ estado: false, mensaje: 'Token inválido', datos: [] }), /BCCR: Token inválido/);
});
