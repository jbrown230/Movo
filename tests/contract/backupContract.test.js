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
import { createDeleteUserBackup } from '../../server/src/application/deleteUserBackup.js';
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
  const backupStore = createInMemoryBackupStore();
  const syncBackup = createSyncBackup({ backupStore });
  const deleteUserBackup = createDeleteUserBackup({ backupStore });
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
      async deleteMyData() {
        return { deleted: await deleteUserBackup(userId) };
      },
    }),
  };
}

const TOKEN = 'token-de-prueba-0123456789';
const NO_CHANGES = { transactions: [], categoryRules: [], settings: [], savingsGoals: [] };
const countOf = (changes) => Object.values(changes).reduce((sum, list) => sum + list.length, 0);

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

test('los presupuestos por categoría y el umbral del aviso pasan al otro teléfono', async () => {
  const server = createInProcessServer('ana');
  const phoneA = createTestApp({ backend: server.backendForPhone() });
  const phoneB = createTestApp({ backend: server.backendForPhone() });

  phoneA.services.preferences.setCategoryBudgets({ comida: 5_000_000, ocio: 2_000_000 });
  phoneA.services.preferences.setBudgetAlertPercent(70);
  await phoneA.services.backup.syncNow(TOKEN);
  await phoneB.services.backup.syncNow(TOKEN);

  assert.deepEqual(phoneB.services.preferences.categoryBudgets(), { comida: 5_000_000, ocio: 2_000_000 });
  assert.equal(phoneB.services.preferences.budgetAlertPercent(), 70);
});

test('las metas de ahorro pasan al otro teléfono, y también cuando se eliminan', async () => {
  const server = createInProcessServer('ana');
  const phoneA = createTestApp({ backend: server.backendForPhone() });
  const phoneB = createTestApp({ backend: server.backendForPhone() });
  const now = new Date(2026, 9, 24, 12);

  const goal = phoneA.services.savingsGoals.create(
    { name: 'Viaje', targetCents: 30_000_000, targetDay: '2026-12-31' },
    now,
  );
  await phoneA.services.backup.syncNow(TOKEN);
  await phoneB.services.backup.syncNow(TOKEN);

  const [copy] = phoneB.services.savingsGoals.list(now);
  assert.deepEqual(
    { id: copy.id, name: copy.name, targetCents: copy.targetCents, targetDay: copy.targetDay, startDay: copy.startDay },
    { id: goal.id, name: 'Viaje', targetCents: 30_000_000, targetDay: '2026-12-31', startDay: '2026-10-01' },
  );

  phoneB.services.savingsGoals.remove(goal.id);
  await phoneB.services.backup.syncNow(TOKEN);
  await phoneA.services.backup.syncNow(TOKEN);
  assert.deepEqual(phoneA.services.savingsGoals.list(now), []);
});

test('el servidor limpia una meta de ahorro mal formada', () => {
  const { records } = parseSyncRequest({
    since: 0,
    changes: {
      savingsGoals: [
        {
          id: 'g1',
          updatedAt: 1,
          data: { name: 'x'.repeat(500), targetCents: -5, targetDay: 7, startDay: null, $where: 'hack' },
        },
      ],
    },
  });
  assert.equal(records[0].kind, 'savings_goal');
  assert.deepEqual(records[0].data, { name: 'x'.repeat(60), targetCents: 0, targetDay: '7', startDay: '' });
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

test('reactivar el respaldo después de borrarlo vuelve a subir todo lo del teléfono', async () => {
  const server = createInProcessServer('ana');
  const phone = createTestApp({ backend: server.backendForPhone() });

  const { transaction } = phone.services.readMail(
    buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'SUPER LA AMISTAD', amount: 23450 }),
  );
  phone.services.recategorize(transaction.id, 'comida');
  phone.services.preferences.setBudgetCents(40_000_000);
  phone.services.preferences.setCloudBackupEnabled(true);
  await phone.services.backup.syncNow(TOKEN);
  const before = phone.queries.getTransaction(transaction.id);

  await phone.services.backup.deleteCloudBackup(TOKEN);
  const empty = await server.backendForPhone().syncBackup({ since: 0, changes: NO_CHANGES });
  assert.equal(countOf(empty.changes), 0, 'el servidor quedó vacío');
  assert.equal(phone.services.backup.pendingCount(), 3, 'un movimiento, una regla y un ajuste por subir');
  assert.deepEqual(phone.queries.getTransaction(transaction.id), before, 'sin cambiar su fecha de modificación');

  phone.services.preferences.setCloudBackupEnabled(true);
  const { pushed } = await phone.services.backup.syncNow(TOKEN);
  assert.equal(pushed, 3);
  assert.equal(phone.services.backup.pendingCount(), 0);

  const cleanPhone = createTestApp({ backend: server.backendForPhone() });
  const { pulled } = await cleanPhone.services.backup.syncNow(TOKEN);
  assert.equal(pulled, 3, 'otro teléfono limpio recupera todo');
  assert.deepEqual(cleanPhone.queries.getTransaction(transaction.id), before);
  assert.equal(cleanPhone.services.preferences.budgetCents(), 40_000_000);
  assert.deepEqual(cleanPhone.storage.rules.list(), phone.storage.rules.list());
});

test('un valor fuera de lo permitido se corrige en el servidor y la app lo acepta', async () => {
  const server = createInProcessServer('ana');
  const phone = createTestApp({ backend: server.backendForPhone() });
  const { transaction } = phone.services.readMail(
    buildBankMail({ bank: 'BN', type: 'sinpe', counterparty: 'X PRUEBA', amount: 100 }),
  );

  // Se simula un cambio con un tipo inventado: el servidor lo reemplaza por uno válido.
  const [pending] = phone.storage.backup.collectPending().transactions;
  const tampered = { ...NO_CHANGES, transactions: [{ ...pending, type: 'robo' }] };
  const response = await server.backendForPhone().syncBackup({ since: 0, changes: tampered });

  assert.equal(response.changes.transactions[0].type, 'transferencia');
  assert.equal(response.changes.transactions[0].id, transaction.id);
});
