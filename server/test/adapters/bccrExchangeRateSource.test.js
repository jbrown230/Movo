import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBccrExchangeRateSource } from '../../src/adapters/bccr/BccrExchangeRateSource.js';

const SERIES_BODY = { estado: true, datos: [{ series: [{ fecha: '2026-01-15', valorDatoPorPeriodo: 505.5 }] }] };

/** Un `fetch` falso que recuerda qué se le pidió. */
function fakeFetch(response) {
  const calls = [];
  const httpFetch = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return { httpFetch, calls };
}

test('consulta la serie del indicador de venta con el token en el encabezado', async () => {
  const { httpFetch, calls } = fakeFetch({ ok: true, json: async () => SERIES_BODY });
  const source = createBccrExchangeRateSource({ token: 'token-de-prueba', httpFetch });

  const latest = await source.fetchLatestRate();

  const [{ url, options }] = calls;
  assert.equal(url.origin, 'https://apim.bccr.fi.cr');
  assert.match(url.pathname, /\/indicadoresEconomicos\/318\/series$/);
  assert.match(url.searchParams.get('fechaInicio'), /^\d{4}\/\d{2}\/\d{2}$/);
  assert.match(url.searchParams.get('fechaFin'), /^\d{4}\/\d{2}\/\d{2}$/);
  assert.equal(url.searchParams.get('idioma'), 'ES');
  assert.equal(options.headers.Authorization, 'Bearer token-de-prueba');
  assert.ok(!url.search.includes('token-de-prueba'), 'el token no debe viajar en la URL');
  assert.equal(latest.rate, 505.5);
});

test('un código de error del BCCR se convierte en un error con ese código', async () => {
  const { httpFetch } = fakeFetch({ ok: false, status: 401 });
  const source = createBccrExchangeRateSource({ token: 'token-vencido', httpFetch });
  await assert.rejects(() => source.fetchLatestRate(), /BCCR 401/);
});
