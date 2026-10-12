import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestUseCases } from '../helpers/fakes.js';

const BCCR_RATE = { rate: 505.5, date: '2026-01-15', source: 'BCCR, tipo de cambio de venta' };
const sourceReturning = (rate) => ({ fetchLatestRate: async () => rate });
const failingSource = {
  fetchLatestRate: async () => {
    throw new Error('BCCR 500');
  },
};

test('sin fuente configurada se usa el valor de referencia', async () => {
  const { useCases } = createTestUseCases();
  assert.deepEqual(await useCases.getExchangeRate(), {
    rate: 510,
    date: null,
    source: 'valor de referencia del servidor',
  });
});

test('con fuente, se devuelve su valor', async () => {
  const { useCases } = createTestUseCases({ exchangeRateSource: sourceReturning(BCCR_RATE) });
  assert.deepEqual(await useCases.getExchangeRate(), BCCR_RATE);
});

test('la fuente se consulta una sola vez: lo demás sale de la caché', async () => {
  let calls = 0;
  const countingSource = {
    fetchLatestRate: async () => {
      calls++;
      return BCCR_RATE;
    },
  };
  const { useCases } = createTestUseCases({ exchangeRateSource: countingSource });

  await useCases.getExchangeRate();
  await useCases.getExchangeRate();
  assert.equal(calls, 1);
});

test('si la fuente falla, se avisa en el registro y se usa el valor de referencia', async () => {
  const warnings = [];
  const { useCases } = createTestUseCases({
    exchangeRateSource: failingSource,
    log: { warn: (...args) => warnings.push(args.join(' ')) },
  });

  assert.equal((await useCases.getExchangeRate()).rate, 510);
  assert.match(warnings[0], /BCCR 500/);
});

test('si la fuente falla después de haber funcionado, se usa el último valor conocido', async () => {
  let fail = false;
  const flakySource = {
    fetchLatestRate: async () => {
      if (fail) throw new Error('caído');
      return BCCR_RATE;
    },
  };
  const { useCases, cache } = createTestUseCases({ exchangeRateSource: flakySource });

  await useCases.getExchangeRate(); // funciona y recuerda el valor
  await cache.set('fx:usd', 'vencido', -1); // el valor fresco de la caché vence
  fail = true;
  assert.deepEqual(await useCases.getExchangeRate(), BCCR_RATE);
});
