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

const OFFICIAL_SOURCE = 'Banco Central de Nicaragua, tasa de cambio oficial';
const RESERVE_SOURCE = 'valor de reserva del servidor (tasa oficial fija del Banco Central de Nicaragua)';

/** Un origen del BCCR con el dólar y el euro de la prueba, y las opciones del córdoba que se quieran probar. */
function sourceWith(options) {
  const { httpFetch } = fakeFetch({ 318: okResponse(DOLLAR_BODY), 333: okResponse(EURO_IN_DOLLARS_BODY) });
  return createBccrExchangeRateSource({ token: 't', httpFetch, ...options });
}

const failingNioRates = async () => {
  throw new Error('sin respuesta');
};

test('el córdoba usa la tasa oficial de cada día: los colones por córdoba cambian cuando cambia la tasa', async () => {
  const fetchNioRates = async () => [
    { date: '2026-01-16', value: 36 },
    { date: '2026-01-19', value: 40 },
  ];
  const rates = await sourceWith({ fetchNioRates }).fetchLatestRate();

  assert.deepEqual(rates.nio, { rate: 12.65, date: '2026-01-19', source: OFFICIAL_SOURCE }); // 506 / 40
  assert.deepEqual(
    rates.history.map((day) => day.nio),
    [14.0278, 14.0278, 14.0278, 12.65], // 505 / 36 hasta el 18 (la tasa del 16 sigue vigente) y 506 / 40 el 19
  );
});

test('los días que la tasa oficial no cubre usan el valor de reserva', async () => {
  const fetchNioRates = async () => [{ date: '2026-01-18', value: 40 }];
  const rates = await sourceWith({ fetchNioRates, nioPerUsd: 50 }).fetchLatestRate();

  assert.deepEqual(
    rates.history.map((day) => day.nio),
    [10.1, 10.1, 12.625, 12.65], // 16 y 17 con la reserva (505 / 50); 18 y 19 con la oficial
  );
  assert.equal(rates.nio.source, OFFICIAL_SOURCE);
});

test('si el servicio del BCN falla, se usa el valor de reserva y se avisa en el registro', async () => {
  const warnings = [];
  const rates = await sourceWith({
    fetchNioRates: failingNioRates,
    nioPerUsd: 50,
    log: { warn: (...args) => warnings.push(args.join(' ')) },
  }).fetchLatestRate();

  assert.deepEqual(rates.nio, { rate: 10.12, date: '2026-01-19', source: RESERVE_SOURCE }); // 506 / 50
  assert.deepEqual(warnings, ['[córdoba] sin respuesta']);
});

test('sin servicio del BCN, se usa el valor de reserva', async () => {
  const rates = await sourceWith({ nioPerUsd: 50 }).fetchLatestRate();

  assert.deepEqual(rates.nio, { rate: 10.12, date: '2026-01-19', source: RESERVE_SOURCE });
  assert.deepEqual(
    rates.history.map((day) => day.nio),
    [10.1, 10.1, 10.1, 10.12],
  );
});

test('si falla el servicio del BCN y no hay reserva, no se inventa un tipo de cambio', async () => {
  const rates = await sourceWith({ fetchNioRates: failingNioRates }).fetchLatestRate();
  assert.equal(rates.nio, null);
  assert.equal(rates.rate, 506); // el dólar y el euro siguen
});

test('sin los córdobas por dólar de ninguna parte, no se inventa un tipo de cambio del córdoba', async () => {
  const rates = await sourceWith({}).fetchLatestRate();
  assert.equal(rates.nio, null);
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
