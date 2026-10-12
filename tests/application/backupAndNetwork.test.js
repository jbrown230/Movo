// Pruebas de lo que depende de la red: respaldo, tipo de cambio y lectura de Gmail.
// El servidor y Gmail se simulan; la base SQLite es real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/createTestApp.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';

const NO_CHANGES = { transactions: [], categoryRules: [], settings: [] };

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
