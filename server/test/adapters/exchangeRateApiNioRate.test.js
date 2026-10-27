import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExchangeRateApiNioRate } from '../../src/adapters/nio/ExchangeRateApiNioRate.js';

const okResponse = (body) => ({ ok: true, json: async () => body });

/** Un `fetch` falso que responde lo que se le diga y recuerda la dirección que se le pidió. */
function fakeFetch(response) {
  const calls = [];
  const httpFetch = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return { httpFetch, calls };
}

test('pide los córdobas por dólar a ExchangeRate-API y devuelve el número', async () => {
  const { httpFetch, calls } = fakeFetch(okResponse({ result: 'success', rates: { NIO: 36.812135, CRC: 505 } }));

  assert.equal(await createExchangeRateApiNioRate({ httpFetch })(), 36.812135);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://open.er-api.com/v6/latest/USD');
});

test('si el servicio responde con error, lanza un error', async () => {
  const { httpFetch } = fakeFetch({ ok: false, status: 503 });
  await assert.rejects(createExchangeRateApiNioRate({ httpFetch })(), /ExchangeRate-API 503/);
});

test('una respuesta sin un valor razonable del córdoba se rechaza, no se usa', async () => {
  const bodies = [
    { result: 'error', 'error-type': 'quota-reached' },
    { result: 'success', rates: {} },
    { result: 'success', rates: { NIO: 0 } },
    { result: 'success', rates: { NIO: 1 } }, // una tasa de 1 córdoba por dólar no existe
    { result: 'success', rates: { NIO: 3681 } }, // ni mil veces más
    { result: 'success', rates: { NIO: 'mucho' } },
    null,
  ];
  for (const body of bodies) {
    const { httpFetch } = fakeFetch(okResponse(body));
    await assert.rejects(
      createExchangeRateApiNioRate({ httpFetch })(),
      /sin un valor válido del córdoba/,
      JSON.stringify(body),
    );
  }
});
