import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBccrExchangeRateSource } from '../../src/adapters/bccr/BccrExchangeRateSource.js';

const seriesBody = (entries) => ({
  estado: true,
  datos: [{ series: entries.map(([fecha, valorDatoPorPeriodo]) => ({ fecha, valorDatoPorPeriodo })) }],
});
// El dólar se publica todos los días; el euro, no los fines de semana (17 y 18 de enero de 2026).
const DOLLAR_BODY = seriesBody([
  ['2026-01-16', 505],
  ['2026-01-17', 505],
  ['2026-01-18', 505],
  ['2026-01-19', 506],
]);
const EURO_IN_DOLLARS_BODY = seriesBody([
  ['2026-01-16', 1.1],
  ['2026-01-19', 1.2],
]);

const okResponse = (body) => ({ ok: true, json: async () => body });
const failedResponse = (status) => ({ ok: false, status });

/** Un `fetch` falso que responde según el indicador de la dirección y recuerda qué se le pidió. */
function fakeFetch(responsesByIndicator) {
  const calls = [];
  const httpFetch = async (url, options) => {
    calls.push({ url, options });
    const indicator = url.pathname.match(/indicadoresEconomicos\/(\d+)\/series$/)[1];
    return responsesByIndicator[indicator];
  };
  return { httpFetch, calls };
}

test('consulta el dólar (318) y el euro (333) con el token en el encabezado', async () => {
  const { httpFetch, calls } = fakeFetch({ 318: okResponse(DOLLAR_BODY), 333: okResponse(EURO_IN_DOLLARS_BODY) });
  await createBccrExchangeRateSource({ token: 'token-de-prueba', httpFetch }).fetchLatestRate();

  assert.deepEqual(calls.map(({ url }) => url.pathname.split('/').at(-2)).sort(), ['318', '333']);
  for (const { url, options } of calls) {
    assert.equal(url.origin, 'https://apim.bccr.fi.cr');
    assert.match(url.searchParams.get('fechaInicio'), /^\d{4}\/\d{2}\/\d{2}$/);
    assert.match(url.searchParams.get('fechaFin'), /^\d{4}\/\d{2}\/\d{2}$/);
    assert.equal(url.searchParams.get('idioma'), 'ES');
    assert.equal(options.headers.Authorization, 'Bearer token-de-prueba');
    assert.ok(!url.search.includes('token-de-prueba'), 'el token no debe viajar en la URL');
  }
});

test('devuelve el tipo de cambio de hoy y el de cada día, con el euro del último día publicado', async () => {
  const { httpFetch } = fakeFetch({ 318: okResponse(DOLLAR_BODY), 333: okResponse(EURO_IN_DOLLARS_BODY) });
  const rates = await createBccrExchangeRateSource({ token: 't', httpFetch }).fetchLatestRate();

  assert.equal(rates.rate, 506);
  assert.equal(rates.date, '2026-01-19');
  assert.equal(rates.source, 'BCCR, tipo de cambio de venta');
  assert.deepEqual(rates.euro, { rate: 607.2, date: '2026-01-19' });
  assert.deepEqual(rates.history, [
    { date: '2026-01-16', usd: 505, eur: 555.5 },
    { date: '2026-01-17', usd: 505, eur: 555.5 }, // sábado: se usa el euro del viernes
    { date: '2026-01-18', usd: 505, eur: 555.5 },
    { date: '2026-01-19', usd: 506, eur: 607.2 },
  ]);
});

test('si falla el euro, se responde solo el dólar', async () => {
  const { httpFetch } = fakeFetch({ 318: okResponse(DOLLAR_BODY), 333: failedResponse(500) });
  const rates = await createBccrExchangeRateSource({ token: 't', httpFetch }).fetchLatestRate();
  assert.equal(rates.rate, 506);
  assert.equal(rates.euro, null);
  assert.ok(rates.history.every((day) => day.eur === null));
});

test('si falla el dólar, la consulta falla con el código del BCCR', async () => {
  const { httpFetch } = fakeFetch({ 318: failedResponse(401), 333: okResponse(EURO_IN_DOLLARS_BODY) });
  const source = createBccrExchangeRateSource({ token: 'token-vencido', httpFetch });
  await assert.rejects(() => source.fetchLatestRate(), /BCCR 401/);
});
