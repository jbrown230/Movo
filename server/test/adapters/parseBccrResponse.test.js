import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLatestRate } from '../../src/adapters/bccr/parseBccrResponse.js';

// Respuesta de ejemplo con la forma real del servicio (XML escapado dentro de XML). Los valores son inventados.
const SAMPLE_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<string xmlns="http://ws.sdde.bccr.fi.cr">&lt;Datos_de_INGC011_CAT_INDICADORECONOMIC&gt;
&lt;INGC011_CAT_INDICADORECONOMIC&gt;&lt;COD_INDICADORINTERNO&gt;318&lt;/COD_INDICADORINTERNO&gt;
&lt;DES_FECHA&gt;2026-01-14T00:00:00-06:00&lt;/DES_FECHA&gt;&lt;NUM_VALOR&gt;505.10000000&lt;/NUM_VALOR&gt;
&lt;/INGC011_CAT_INDICADORECONOMIC&gt;&lt;INGC011_CAT_INDICADORECONOMIC&gt;
&lt;DES_FECHA&gt;2026-01-15T00:00:00-06:00&lt;/DES_FECHA&gt;&lt;NUM_VALOR&gt;505.55400000&lt;/NUM_VALOR&gt;
&lt;/INGC011_CAT_INDICADORECONOMIC&gt;&lt;/Datos_de_INGC011_CAT_INDICADORECONOMIC&gt;</string>`;

test('toma el último valor publicado y lo redondea a dos decimales', () => {
  assert.deepEqual(parseLatestRate(SAMPLE_RESPONSE), {
    rate: 505.55,
    date: '2026-01-15',
    source: 'BCCR, tipo de cambio de venta',
  });
});

test('una respuesta sin datos lanza un error claro', () => {
  assert.throws(() => parseLatestRate('<string></string>'), /BCCR sin datos/);
});
