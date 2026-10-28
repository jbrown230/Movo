// Pruebas de lo que depende de la red: respaldo, tipo de cambio y lectura de Gmail.
// El servidor y Gmail se simulan; la base SQLite es real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import { BCR_TARJETA_CORDOBAS } from '../fixtures/bcrMails.js';

const NO_CHANGES = { transactions: [], categoryRules: [], settings: [], savingsGoals: [] };

const cardMail = (overrides = {}) =>
  buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'CAFE CORDILLERA', amount: 2900, ...overrides });

// ---------------------------------------------------------------- respaldo

test('sincronizar sube lo pendiente y lo deja limpio', async () => {
  const sent = [];
  const backend = {
    syncBackup: async ({ changes }) => {
      sent.push(changes);
      return { cursor: 7, hasMore: false, changes: NO_CHANGES };
    },
  };
  const { services } = createTestApp({ backend });
  services.readMail(cardMail());

  assert.equal(services.backup.pendingCount(), 1);
  const result = await services.backup.syncNow('token-de-prueba-0123456789');

  assert.deepEqual(result, { pushed: 1, pulled: 0 });
  assert.equal(sent[0].transactions.length, 1);
  assert.equal(sent[0].transactions[0].amountCents, 290000);
  assert.equal(services.backup.pendingCount(), 0);
});

test('aplicar cambios del servidor: gana el más reciente', async () => {
  const { services, storage, queries } = createTestApp();
  const { transaction } = services.readMail(cardMail());
  const pending = storage.backup.collectPending();
  storage.backup.markSynced(pending);

  const synced = pending.transactions[0];
  const remote = (updatedAt, category) => ({ ...NO_CHANGES, transactions: [{ ...synced, updatedAt, category }] });

  assert.equal(storage.backup.applyRemote(remote(transaction.updatedAt - 10, 'ocio')), 0, 'más viejo: se ignora');
  assert.equal(storage.backup.applyRemote(remote(transaction.updatedAt + 10, 'ocio')), 1, 'más nuevo: se aplica');
  assert.equal(queries.getTransaction(transaction.id).category, 'ocio');
});

test('si el servidor no responde, la app local sigue funcionando y no pierde cambios', async () => {
  const { services, queries } = createTestApp(); // el servidor simulado por defecto no responde
  services.readMail(cardMail());

  await assert.rejects(services.backup.syncNow('token-de-prueba-0123456789'), /sin conexión/);
  assert.equal(services.backup.pendingCount(), 1, 'el cambio sigue pendiente para el próximo intento');
  assert.equal(queries.countTransactions(), 1);
});

test('si MongoDB no responde, el respaldo falla con el mensaje del servidor y la app sigue igual', async () => {
  // Lo que hace la API cuando MongoDB no responde: 503 con un mensaje claro (ver server/test/adapters/outages.test.js).
  let mongoIsDown = true;
  const backend = {
    getExchangeRate: async () => ({}),
    syncBackup: async () => {
      if (mongoIsDown) throw Object.assign(new Error('Respaldo no disponible por ahora.'), { status: 503 });
      return { cursor: 1, hasMore: false, changes: NO_CHANGES };
    },
    deleteMyData: async () => ({ deleted: 0 }),
  };
  const { services, queries } = createTestApp({ backend });
  services.readMail(cardMail());

  await assert.rejects(services.backup.syncNow('token-de-prueba-0123456789'), {
    message: 'Respaldo no disponible por ahora.',
  });
  assert.equal(queries.countTransactions(), 1, 'lo local sigue ahí');
  assert.equal(services.backup.pendingCount(), 1, 'y el cambio queda pendiente');
  services.readMail(cardMail({ counterparty: 'SODA LA PRUEBA' }));
  assert.equal(queries.countTransactions(), 2, 'la app sigue leyendo correos sin el respaldo');

  mongoIsDown = false; // MongoDB vuelve
  const { pushed } = await services.backup.syncNow('token-de-prueba-0123456789');
  assert.equal(pushed, 2);
  assert.equal(services.backup.pendingCount(), 0);
});

test('un cambio hecho mientras se sincronizaba no se marca como subido', async () => {
  const { services, storage } = createTestApp();
  const { transaction } = services.readMail(cardMail());
  const pending = storage.backup.collectPending();

  await new Promise((resolve) => setTimeout(resolve, 2));
  services.recategorize(transaction.id, 'ocio'); // cambia después de armar el envío
  storage.backup.markSynced(pending);

  assert.equal(storage.backup.collectPending().transactions.length, 1, 'el movimiento sigue pendiente');
});

test('borrar el respaldo apaga la sincronización y reinicia el cursor', async () => {
  let deleted = false;
  const backend = {
    deleteMyData: async () => {
      deleted = true;
    },
  };
  const { services, storage } = createTestApp({ backend });
  storage.localState.set('cloud_backup_enabled', true);
  storage.localState.set('sync_cursor', 99);

  await services.backup.deleteCloudBackup('token-de-prueba-0123456789');

  assert.equal(deleted, true);
  assert.equal(services.preferences.isCloudBackupEnabled(), false);
  assert.equal(storage.localState.get('sync_cursor'), 0);
});

// ---------------------------------------------------------------- tipo de cambio

test('al llegar el tipo de cambio se corrigen las compras en dólares guardadas sin él', async () => {
  const backend = { getExchangeRate: async () => ({ rate: 520, source: 'BCCR' }) };
  const { storage, services, queries } = createTestApp({ backend });
  storage.transactions.insert({
    id: 'usd1',
    date: '2026-01-15T16:00:00.000Z',
    amountCents: 1000,
    currency: 'USD',
    crcCents: 0,
    exchangeRate: null,
    counterparty: 'NETFLIX.COM',
    category: 'ocio',
    categoryOrigin: 'regla automática',
    type: 'tarjeta',
    direction: 'out',
    bank: 'BAC',
    mailKey: null,
    note: null,
  });

  assert.equal(await services.refreshExchangeRate(), true);

  const fixed = queries.getTransaction('usd1');
  assert.equal(fixed.exchangeRate, 520);
  assert.equal(fixed.crcCents, 520000);
  assert.equal(services.preferences.exchangeRate(), 520);
});

test('sin tipo de cambio del servidor se usa el de reserva', async () => {
  const { services } = createTestApp();
  await assert.rejects(services.refreshExchangeRate());
  assert.equal(services.preferences.exchangeRate(), 510);
});

// ---------------------------------------------------------------- Gmail

test('buscar correos: registra los nuevos y recuerda cuándo fue la última búsqueda', async () => {
  const mails = {
    m1: cardMail({ counterparty: 'SUPER LA AMISTAD', amount: 23450 }),
    m2: cardMail({ counterparty: 'CAFE CORDILLERA', amount: 2900 }),
  };
  mails.m1.id = 'm1';
  mails.m2.id = 'm2';
  const mailSource = {
    listNewMailIds: async ({ isKnown }) => ['m1', 'm2'].filter((id) => !isKnown(id)),
    fetchMail: async ({ id }) => mails[id],
  };
  const { services, queries } = createTestApp({ mailSource });
  const progress = [];

  const summary = await services.scanInbox({
    token: 'token-de-prueba-0123456789',
    onProgress: (done, total) => progress.push([done, total]),
  });

  assert.equal(summary.found, 2);
  assert.equal(summary.newTransactions, 2);
  assert.equal(queries.countTransactions(), 2);
  assert.equal(progress.at(-1)[0], 2);
  assert.ok(services.preferences.lastScanAt() > 0);

  const again = await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  assert.equal(again.found, 0, 'los correos ya leídos no se descargan otra vez');
});

/** Una fuente de correo que recuerda con qué búsqueda y desde cuándo se le pidieron los correos. */
function recordingMailSource() {
  const requests = [];
  return {
    requests,
    listNewMailIds: async ({ query, since }) => {
      requests.push({ query, since });
      return [];
    },
    fetchMail: async () => ({}),
  };
}

test('la primera lectura revisa el período inicial, y las siguientes piden solo desde la última', async () => {
  const mailSource = recordingMailSource();
  const { services } = createTestApp({ mailSource });

  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });

  assert.equal(mailSource.requests[0].since, null, 'la primera vez no hay última lectura');
  assert.ok(mailSource.requests[1].since > 0, 'la segunda parte de la primera');
  assert.equal(mailSource.requests[1].query, mailSource.requests[0].query);
});

test('si cambia la búsqueda por defecto (un banco nuevo en una versión nueva), vuelve a revisar el período inicial', async () => {
  const mailSource = recordingMailSource();
  const { services } = createTestApp({ mailSource });
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });

  // Un teléfono que leyó con la búsqueda de una versión anterior: se simula dejando anotada otra.
  services.preferences.markScanned('(from:bancoviejo.example)');

  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  assert.equal(mailSource.requests.at(-1).since, null, 'con otra búsqueda no se confía en la última lectura');
});

test('si la búsqueda no cambió, no se vuelve a revisar el período inicial', async () => {
  const mailSource = recordingMailSource();
  const { services } = createTestApp({ mailSource });

  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });

  assert.deepEqual(
    mailSource.requests.map((request) => request.since === null),
    [true, false, false],
  );
});

test('editar los bancos que se leen también vuelve a revisar el período inicial', async () => {
  const mailSource = recordingMailSource();
  const { services } = createTestApp({ mailSource });
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });

  services.preferences.setGmailQuery('from:otrobanco.example');
  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  assert.equal(mailSource.requests.at(-1).since, null);
  assert.equal(mailSource.requests.at(-1).query, 'from:otrobanco.example');

  await services.scanInbox({ token: 'token-de-prueba-0123456789' });
  assert.ok(mailSource.requests.at(-1).since > 0, 'con la búsqueda nueva ya leída, sigue desde la última lectura');
});

test('si el token de Gmail venció, la búsqueda falla con un error de autenticación y no guarda nada', async () => {
  const authError = Object.assign(new Error('auth'), { auth: true });
  const mailSource = {
    listNewMailIds: async () => {
      throw authError;
    },
    fetchMail: async () => ({}),
  };
  const { services, queries } = createTestApp({ mailSource });

  await assert.rejects(services.scanInbox({ token: 'vencido' }), (error) => error.auth === true);
  assert.equal(queries.countTransactions(), 0);
  assert.equal(services.preferences.lastScanAt(), null, 'no se marca como leído');
});

test('una compra en euros se convierte con los colones por euro del servidor', async () => {
  const backend = { getExchangeRate: async () => ({ rate: 455.6, source: 'BCCR', euro: { rate: 512.3 } }) };
  const { services } = createTestApp({ backend });
  await services.refreshExchangeRate();

  const { transaction } = services.readMail(cardMail({ amount: 10, currency: 'EUR' }));
  assert.equal(transaction.currency, 'EUR');
  assert.equal(transaction.exchangeRate, 512.3);
  assert.equal(transaction.crcCents, 512300);
});

test('una compra en córdobas se convierte con los colones por córdoba del servidor', async () => {
  const backend = { getExchangeRate: async () => ({ rate: 455.6, source: 'BCCR', nio: { rate: 12.4 } }) };
  const { services } = createTestApp({ backend });
  await services.refreshExchangeRate();

  const { transaction } = services.readMail({ id: 'cordobas-1', ...BCR_TARJETA_CORDOBAS });
  assert.equal(transaction.currency, 'NIO');
  assert.equal(transaction.amountCents, 30000); // C$300,00
  assert.equal(transaction.exchangeRate, 12.4);
  assert.equal(transaction.crcCents, 372000); // ₡3 720
});

test('sin tipo de cambio del euro, la compra queda sin convertir y se convierte cuando llega', async () => {
  let euro = null;
  const backend = { getExchangeRate: async () => ({ rate: 455.6, source: 'BCCR', euro }) };
  const { services, queries } = createTestApp({ backend });
  assert.equal(services.preferences.exchangeRate('EUR'), null, 'el euro no tiene valor de reserva');

  const { transaction } = services.readMail(cardMail({ amount: 10, currency: 'EUR' }));
  assert.equal(transaction.exchangeRate, 0);
  assert.equal(transaction.crcCents, 0);

  await services.refreshExchangeRate(); // el servidor todavía no tiene el euro
  assert.equal(queries.getTransaction(transaction.id).crcCents, 0);

  euro = { rate: 512.3 };
  await services.refreshExchangeRate();
  const converted = queries.getTransaction(transaction.id);
  assert.equal(converted.exchangeRate, 512.3);
  assert.equal(converted.crcCents, 512300);
});

// ---------------------------------------------------------------- tipo de cambio del día de la compra

// Lo que responde el servidor: el tipo de cambio de hoy y el de cada día reciente.
const RATES_WITH_HISTORY = {
  rate: 460,
  source: 'BCCR',
  euro: { rate: 520 },
  history: [
    { date: '2026-01-14', usd: 450, eur: 500 },
    { date: '2026-01-15', usd: 455, eur: 505 },
    { date: '2026-01-16', usd: 460, eur: 520 },
  ],
};

test('una compra se convierte con el tipo de cambio del día en que se hizo, no con el de hoy', async () => {
  const { services } = createTestApp({ backend: { getExchangeRate: async () => RATES_WITH_HISTORY } });
  await services.refreshExchangeRate();

  const dollars = services.readMail(cardMail({ amount: 10, currency: 'USD', date: costaRicaIso(2026, 1, 15, 10, 0) }));
  assert.equal(dollars.transaction.exchangeRate, 455);
  assert.equal(dollars.transaction.crcCents, 455000);

  const euros = services.readMail(cardMail({ amount: 10, currency: 'EUR', date: costaRicaIso(2026, 1, 14, 23, 30) }));
  assert.equal(euros.transaction.exchangeRate, 500, 'el día se cuenta en hora de Costa Rica');

  const afterLastDay = services.readMail(
    cardMail({ amount: 10, currency: 'USD', date: costaRicaIso(2026, 1, 17, 9, 0) }),
  );
  assert.equal(afterLastDay.transaction.exchangeRate, 460, 'sin el valor de ese día, el más reciente');
});

test('al llegar el tipo de cambio, las compras ya guardadas quedan con el de su día', async () => {
  let response = null;
  const backend = {
    getExchangeRate: async () => {
      if (!response) throw new Error('sin conexión');
      return response;
    },
  };
  const { services, queries } = createTestApp({ backend });
  const { transaction } = services.readMail(
    cardMail({ amount: 10, currency: 'USD', date: costaRicaIso(2026, 1, 15, 10, 0) }),
  );
  assert.equal(transaction.exchangeRate, 510, 'sin servidor se usa el valor de reserva');

  response = RATES_WITH_HISTORY;
  await services.refreshExchangeRate();
  const corrected = queries.getTransaction(transaction.id);
  assert.equal(corrected.exchangeRate, 455);
  assert.equal(corrected.crcCents, 455000);
});

test('una compra más vieja que el historial conserva el tipo de cambio con que se guardó', async () => {
  let response = RATES_WITH_HISTORY;
  const { services, queries } = createTestApp({ backend: { getExchangeRate: async () => response } });
  await services.refreshExchangeRate();
  const { transaction } = services.readMail(
    cardMail({ amount: 10, currency: 'USD', date: costaRicaIso(2026, 1, 2, 10, 0) }),
  );
  assert.equal(transaction.exchangeRate, 460);

  response = { ...RATES_WITH_HISTORY, rate: 470 };
  await services.refreshExchangeRate();
  assert.equal(queries.getTransaction(transaction.id).exchangeRate, 460);
});
