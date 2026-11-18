// La lectura de Gmail del primer arranque: cientos de correos seguidos no deben dejar la app pegada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { BCR_SINPE_ENVIADO } from '../fixtures/bcrMails.js';

const TOKEN = 'token-de-prueba-0123456789';
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Un correo del BCR distinto cada vez (cada uno genera su propio movimiento). */
const bankMail = (index) => ({ ...BCR_SINPE_ENVIADO, id: `m${index}`, messageId: `<m${index}@bancobcr.com>` });

/** Una fuente de correo con `count` correos que anota cuántos se descargan al mismo tiempo. */
function slowMailSource(count) {
  const state = { inFlight: 0, maxInFlight: 0 };
  const ids = Array.from({ length: count }, (_, index) => `m${index}`);
  return {
    state,
    listNewMailIds: async ({ isKnown }) => ids.filter((id) => !isKnown(id)),
    fetchMail: async ({ id }) => {
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      await nextTask(); // la descarga de Gmail
      state.inFlight -= 1;
      return bankMail(Number(id.slice(1)));
    },
  };
}

test('después de leer cada correo se le cede el control a la pantalla', async () => {
  const mailSource = slowMailSource(12);
  const events = [];
  const yieldToUi = async () => {
    events.push('respiro');
    await nextTask();
  };
  const { services, queries } = createTestApp({ mailSource, yieldToUi });

  const summary = await services.scanInbox({ token: TOKEN, onProgress: () => events.push('leído') });

  assert.equal(summary.found, 12);
  assert.equal(queries.countTransactions(), 12, 'ceder el control no pierde ningún correo');
  assert.equal(events.filter((event) => event === 'respiro').length, 12, 'un respiro por correo');
  assert.deepEqual(events.slice(0, 2), ['leído', 'respiro'], 'el respiro llega justo después de leer el correo');
});

test('sin respiro configurado (otras pantallas o pruebas) la lectura sigue funcionando', async () => {
  const { services, queries } = createTestApp({ mailSource: slowMailSource(5) });
  const summary = await services.scanInbox({ token: TOKEN });
  assert.equal(summary.newTransactions, 5);
  assert.equal(queries.countTransactions(), 5);
});

test('se descargan 6 correos a la vez: la primera lectura espera a la red, no al teléfono', async () => {
  const mailSource = slowMailSource(30);
  const { services } = createTestApp({ mailSource });

  await services.scanInbox({ token: TOKEN });

  assert.equal(mailSource.state.maxInFlight, 6);
});
