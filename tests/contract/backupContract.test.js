// Pruebas de contrato: comprueban que la app (web/) y el servidor (server/) sigan entendiéndose.
//
// No usan red: el "servidor" es el código real de server/src (validación, caso de uso y almacén
// en memoria), conectado al cliente a través del formato de red de shared/backupContract.js.
// Si alguien cambia un nombre o un valor de un solo lado, estas pruebas fallan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as contract from '../../shared/backupContract.js';
import { createInMemoryBackupStore } from '../../server/src/adapters/memory/InMemoryBackupStore.js';
import { parseSyncRequest } from '../../server/src/adapters/http/parseSyncRequest.js';
import { toSyncResponse } from '../../server/src/adapters/http/toSyncResponse.js';
import { createSyncBackup } from '../../server/src/application/syncBackup.js';
import { SettingName } from '../../web/src/application/preferences.js';
import { Currency, Direction, TransactionType } from '../../web/src/domain/types.js';
import { fromWireChanges, toWireChanges } from '../../web/src/infrastructure/backend/backupWireFormat.js';
import { createTestApp } from '../helpers/createTestApp.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';

const sorted = (values) => [...values].sort();

test('los valores permitidos del contrato coinciden con el vocabulario de la app', () => {
  assert.deepEqual(sorted(contract.ALLOWED_CURRENCIES), sorted(Object.values(Currency)));
  assert.deepEqual(sorted(contract.ALLOWED_TRANSACTION_TYPES), sorted(Object.values(TransactionType)));
  assert.deepEqual(sorted(contract.ALLOWED_DIRECTIONS), sorted(Object.values(Direction)));
  assert.deepEqual(sorted(contract.SYNCED_SETTING_NAMES), sorted(Object.values(SettingName)));
});

test('el límite de cambios por petición del cliente cabe en lo que acepta el servidor', () => {
  assert.ok(contract.MAX_CHANGES_PER_REQUEST >= 500, 'el cliente envía hasta 500 registros por lista');
});

/** Un "servidor" en proceso: el mismo código del servidor real, sin red ni Express. */
function createInProcessServer(userId) {
  const syncBackup = createSyncBackup({ backupStore: createInMemoryBackupStore() });
  return {
    /** Un teléfono que sincroniza con este servidor. Todo pasa por JSON, como en la red. */
    backendForPhone: () => ({
      async syncBackup({ since, changes }) {
        const requestBody = JSON.parse(JSON.stringify({ since, changes: toWireChanges(changes) }));
        const { cursor, records } = parseSyncRequest(requestBody);
        const result = await syncBackup({ userId, cursor, records });
        const responseBody = JSON.parse(JSON.stringify(toSyncResponse(result)));
        return {
          cursor: responseBody.cursor,
          hasMore: responseBody.hasMore,
          changes: fromWireChanges(responseBody.changes),
        };
      },
    }),
  };
}

const TOKEN = 'token-de-prueba-0123456789';

test('dos teléfonos de la misma persona se sincronizan a través del contrato', async () => {
  const server = createInProcessServer('ana');
  const phoneA = createTestApp({ backend: server.backendForPhone() });
  const phoneB = createTestApp({ backend: server.backendForPhone() });

  // En el teléfono A: se lee un correo, se cambia la categoría (crea una regla) y el presupuesto.
  const mail = buildBankMail({
    bank: 'BAC',
    type: 'tarjeta',
    counterparty: 'NETFLIX.COM',
    amount: 7.99,
    currency: 'USD',
  });
  const { transaction } = phoneA.services.readMail(mail);
  phoneA.services.recategorize(transaction.id, 'comida');
  phoneA.services.preferences.setBudgetCents(40_000_000);
  await phoneA.services.backup.syncNow(TOKEN);

  // El teléfono B se sincroniza y recibe todo.
  const received = await phoneB.services.backup.syncNow(TOKEN);
  assert.equal(received.pulled, 3, 'un movimiento, una regla y un ajuste');

  const copy = phoneB.queries.getTransaction(transaction.id);
  assert.deepEqual(copy, phoneA.queries.getTransaction(transaction.id), 'el movimiento llega idéntico');
  assert.equal(phoneB.services.preferences.budgetCents(), 40_000_000);
  assert.deepEqual(phoneB.storage.rules.list(), phoneA.storage.rules.list());
  assert.equal(phoneB.services.backup.pendingCount(), 0, 'lo recibido no se vuelve a subir');
});

test('eliminar en un teléfono se refleja en el otro', async () => {
  const server = createInProcessServer('ana');
  const phoneA = createTestApp({ backend: server.backendForPhone() });
  const phoneB = createTestApp({ backend: server.backendForPhone() });

  const { transaction } = phoneA.services.readMail(
    buildBankMail({ bank: 'BN', type: 'sinpe', counterparty: 'SODA DONA ROSA', amount: 1500 }),
  );
  await phoneA.services.backup.syncNow(TOKEN);
  await phoneB.services.backup.syncNow(TOKEN);
  assert.equal(phoneB.queries.countTransactions(), 1);

  phoneB.services.deleteTransaction(transaction.id);
  await phoneB.services.backup.syncNow(TOKEN);
  await phoneA.services.backup.syncNow(TOKEN);

  assert.equal(phoneA.queries.countTransactions(), 0);
});

test('un valor fuera de lo permitido se corrige en el servidor y la app lo acepta', async () => {
  const server = createInProcessServer('ana');
  const phone = createTestApp({ backend: server.backendForPhone() });
  const { transaction } = phone.services.readMail(
    buildBankMail({ bank: 'BN', type: 'sinpe', counterparty: 'X PRUEBA', amount: 100 }),
  );

  // Se simula un cambio con un tipo inventado: el servidor lo reemplaza por uno válido.
  const [pending] = phone.storage.backup.collectPending().transactions;
  const tampered = { transactions: [{ ...pending, type: 'robo' }], categoryRules: [], settings: [] };
  const response = await server.backendForPhone().syncBackup({ since: 0, changes: tampered });

  assert.equal(response.changes.transactions[0].type, 'transferencia');
  assert.equal(response.changes.transactions[0].id, transaction.id);
});
