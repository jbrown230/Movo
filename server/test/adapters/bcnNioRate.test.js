import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBcnNioRate, lastMonths, parseMonthRates } from '../../src/adapters/nio/BcnNioRate.js';

/** La respuesta SOAP de RecuperaTC_Mes con la forma real: una etiqueta <Tc> por día. */
function monthResponse(year, month, rates) {
  const days = Object.entries(rates)
    .map(([day, value]) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return `<Tc><Fecha>${date}</Fecha><Valor>${value}</Valor><Ano>${year}</Ano><Mes>${month}</Mes><Dia>${Number(day)}</Dia></Tc>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    '<RecuperaTC_MesResponse xmlns="http://servicios.bcn.gob.ni/"><RecuperaTC_MesResult><Detalle_TC xmlns="">' +
    `${days}</Detalle_TC></RecuperaTC_MesResult></RecuperaTC_MesResponse></soap:Body></soap:Envelope>`
  );
}

test('lee la tasa de cada día de la respuesta del BCN', () => {
  const xml = monthResponse(2026, 10, { 1: '36.6243', 2: '36.6243', 31: '36.7001' });
  assert.deepEqual(parseMonthRates(xml), [
    { date: '2026-10-01', value: 36.6243 },
    { date: '2026-10-02', value: 36.6243 },
    { date: '2026-10-31', value: 36.7001 },
  ]);
});

test('descarta los valores que no son una tasa razonable del córdoba', () => {
  const xml = monthResponse(2026, 10, { 1: '36.6243', 2: '0', 3: '3.66', 4: '3662.43' });
  assert.deepEqual(parseMonthRates(xml), [{ date: '2026-10-01', value: 36.6243 }]);
  assert.deepEqual(parseMonthRates('<soap:Fault>algo falló</soap:Fault>'), []);
});

test('lastMonths da el mes actual y los anteriores, también al cruzar de año', () => {
  assert.deepEqual(lastMonths(new Date(2026, 9, 27), 3), [
    { year: 2026, month: 10 },
    { year: 2026, month: 9 },
    { year: 2026, month: 8 },
  ]);
  assert.deepEqual(lastMonths(new Date(2026, 0, 15), 3), [
    { year: 2026, month: 1 },
    { year: 2025, month: 12 },
    { year: 2025, month: 11 },
  ]);
});

/** Un cliente SOAP falso que responde según el mes pedido y recuerda cada llamada. */
function fakePost(responses) {
  const calls = [];
  const post = async (operation, parametersXml) => {
    calls.push({ operation, parametersXml });
    const key = parametersXml
      .replace(/<\/?(Ano|Mes)>/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
    const response = responses[key];
    if (response instanceof Error) throw response;
    return response ?? { status: 404, text: '' };
  };
  return { post, calls };
}

const NOW = () => new Date(2026, 9, 27);
const ok = (year, month, rates) => ({ status: 200, text: monthResponse(year, month, rates) });

test('pide tres meses al BCN y devuelve las tasas de cada día, del día más viejo al más nuevo', async () => {
  const { post, calls } = fakePost({
    '2026-10': ok(2026, 10, { 1: '36.6243', 27: '36.6243' }),
    '2026-9': ok(2026, 9, { 30: '36.5' }),
    '2026-8': ok(2026, 8, { 31: '36.4' }),
  });
  const rates = await createBcnNioRate({ post, now: NOW })();

  assert.deepEqual(
    calls.map((call) => [call.operation, call.parametersXml]),
    [
      ['RecuperaTC_Mes', '<Ano>2026</Ano><Mes>10</Mes>'],
      ['RecuperaTC_Mes', '<Ano>2026</Ano><Mes>9</Mes>'],
      ['RecuperaTC_Mes', '<Ano>2026</Ano><Mes>8</Mes>'],
    ],
  );
  assert.deepEqual(
    rates.map((rate) => [rate.date, rate.value]),
    [
      ['2026-08-31', 36.4],
      ['2026-09-30', 36.5],
      ['2026-10-01', 36.6243],
      ['2026-10-27', 36.6243],
    ],
  );
});

test('un mes anterior que falla no impide devolver los demás', async () => {
  const { post } = fakePost({
    '2026-10': ok(2026, 10, { 27: '36.6243' }),
    '2026-9': new Error('sin respuesta'),
    '2026-8': { status: 500, text: 'error' },
  });
  assert.deepEqual(await createBcnNioRate({ post, now: NOW })(), [{ date: '2026-10-27', value: 36.6243 }]);
});

test('si el mes actual falla, se lanza un error (para usar el valor de reserva)', async () => {
  const failures = [
    [new Error('el BCN no respondió a tiempo'), /no respondió a tiempo/],
    [{ status: 500, text: 'error' }, /BCN 500/],
    [{ status: 200, text: '<soap:Fault>sin datos</soap:Fault>' }, /sin tasas válidas/],
  ];
  for (const [response, expected] of failures) {
    const { post } = fakePost({ '2026-10': response, '2026-9': ok(2026, 9, { 30: '36.5' }) });
    await assert.rejects(createBcnNioRate({ post, now: NOW })(), expected);
  }
});
