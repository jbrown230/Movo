// Conflictos de sincronización entre dos teléfonos de la misma persona.
//
// Regla: gana la última escritura POR REGISTRO (cada movimiento, regla o ajuste por separado), según la
// marca de tiempo `updatedAt` que pone el teléfono al hacer el cambio. En un empate exacto gana lo que
// llegó primero al servidor, y el otro teléfono adopta esa versión. Ver docs/ARQUITECTURA.md, "Sincronización".
//
// Los dos teléfonos son la app real con SQLite en memoria; el servidor es el código real de server/src
// (validación, caso de uso y almacén en memoria), y todo viaja como JSON, igual que por la red.
// El reloj se controla para decidir quién escribió después.
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryBackupStore } from '../../server/src/adapters/memory/InMemoryBackupStore.js';
import { parseSyncRequest } from '../../server/src/adapters/http/parseSyncRequest.js';
import { toSyncResponse } from '../../server/src/adapters/http/toSyncResponse.js';
import { createSyncBackup } from '../../server/src/application/syncBackup.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { fromWireChanges, toWireChanges } from '../../web/src/infrastructure/backend/backupWireFormat.js';
import { createTestApp } from '../helpers/createTestApp.js';

const TOKEN = 'token-de-prueba-0123456789';
const realNow = Date.now;
afterEach(() => {
  Date.now = realNow;
});

/** Hace lo que sea dentro de `fn` como si el reloj del teléfono marcara `ms`. */
function at(ms, fn) {
  Date.now = () => ms;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

/** Un servidor en proceso y dos teléfonos de la misma persona que sincronizan con él. */
function twoPhones() {
  const syncBackup = createSyncBackup({ backupStore: createInMemoryBackupStore() });
  const backend = {
    async syncBackup({ since, changes }) {
      const { cursor, records } = parseSyncRequest(
        JSON.parse(JSON.stringify({ since, changes: toWireChanges(changes) })),
      );
      const response = JSON.parse(JSON.stringify(toSyncResponse(await syncBackup({ userId: 'ana', cursor, records }))));
      return { cursor: response.cursor, hasMore: response.hasMore, changes: fromWireChanges(response.changes) };
    },
  };
  const phoneA = createTestApp({ backend });
  const phoneB = createTestApp({ backend });
  const sync = (phone) => phone.services.backup.syncNow(TOKEN);
  return { phoneA, phoneB, sync };
}

/** Un movimiento leído en A y ya copiado en B: el punto de partida de cada conflicto. */
async function sharedMovement() {
  const phones = twoPhones();
  const { transaction } = at(1_000, () =>
    phones.phoneA.services.readMail(
      buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'CAFE CORDILLERA', amount: 2900 }),
    ),
  );
  await phones.sync(phones.phoneA);
  await phones.sync(phones.phoneB);
  return { ...phones, id: transaction.id };
}

const categoryIn = (phone, id) => phone.queries.getTransaction(id).category;

test('los dos editan el mismo movimiento sin conexión: gana el último cambio aunque sincronice primero', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  at(2_000, () => phoneA.services.recategorize(id, 'super')); // A cambia antes
  at(3_000, () => phoneB.services.recategorize(id, 'ocio')); // B cambia después

  await sync(phoneB); // el último cambio llega primero al servidor
  await sync(phoneA); // el cambio viejo de A no lo pisa, y A recibe el de B
  await sync(phoneB);

  assert.equal(categoryIn(phoneA, id), 'ocio');
  assert.equal(categoryIn(phoneB, id), 'ocio');
  assert.equal(phoneA.services.backup.pendingCount(), 0, 'A no queda con cambios por subir');
});

test('lo mismo si el cambio viejo llega primero al servidor', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  at(2_000, () => phoneA.services.recategorize(id, 'super'));
  at(3_000, () => phoneB.services.recategorize(id, 'ocio'));

  await sync(phoneA);
  await sync(phoneB);
  await sync(phoneA);

  assert.equal(categoryIn(phoneA, id), 'ocio');
  assert.equal(categoryIn(phoneB, id), 'ocio');
});

test('eliminar después de editar: el movimiento queda eliminado en los dos', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  at(2_000, () => phoneA.services.recategorize(id, 'super'));
  at(3_000, () => phoneB.services.deleteTransaction(id));

  await sync(phoneA);
  await sync(phoneB);
  await sync(phoneA);

  assert.equal(phoneA.queries.countTransactions(), 0);
  assert.equal(phoneB.queries.countTransactions(), 0);
});

test('editar después de eliminar: el movimiento vuelve en los dos, con el cambio', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  at(2_000, () => phoneB.services.deleteTransaction(id));
  at(3_000, () => phoneA.services.recategorize(id, 'super'));

  await sync(phoneB);
  await sync(phoneA);
  await sync(phoneB);

  assert.equal(categoryIn(phoneA, id), 'super');
  assert.equal(phoneB.queries.countTransactions(), 1);
  assert.equal(categoryIn(phoneB, id), 'super');
});

test('cambios en movimientos distintos no chocan: se conservan los dos', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  const second = at(1_500, () =>
    phoneA.services.readMail(
      buildBankMail({ bank: 'BN', type: 'sinpe', counterparty: 'SODA DONA ROSA', amount: 1500 }),
    ),
  ).transaction.id;
  await sync(phoneA);
  await sync(phoneB);

  at(2_000, () => phoneA.services.setDirection(second, 'self'));
  at(3_000, () => phoneB.services.recategorize(id, 'ocio'));
  await sync(phoneA);
  await sync(phoneB);
  await sync(phoneA);

  for (const phone of [phoneA, phoneB]) {
    assert.equal(categoryIn(phone, id), 'ocio');
    assert.equal(phone.queries.getTransaction(second).direction, 'self');
  }
});

test('el presupuesto también: gana el último que se cambió', async () => {
  const { phoneA, phoneB, sync } = twoPhones();
  at(2_000, () => phoneA.services.preferences.setBudgetCents(40_000_000));
  at(3_000, () => phoneB.services.preferences.setBudgetCents(25_000_000));

  await sync(phoneB);
  await sync(phoneA);

  assert.equal(phoneA.services.preferences.budgetCents(), 25_000_000);
  assert.equal(phoneB.services.preferences.budgetCents(), 25_000_000);
});

test('empate exacto de hora: los dos terminan con la versión que llegó primero al servidor', async () => {
  const { phoneA, phoneB, sync, id } = await sharedMovement();
  at(2_000, () => phoneA.services.recategorize(id, 'super'));
  at(2_000, () => phoneB.services.recategorize(id, 'ocio')); // el mismo milisegundo

  await sync(phoneA); // llega primero
  await sync(phoneB); // el servidor no lo cambia, y B adopta la versión guardada
  await sync(phoneA);

  assert.equal(categoryIn(phoneA, id), 'super');
  assert.equal(categoryIn(phoneB, id), 'super', 'sin esto, los teléfonos quedarían distintos para siempre');
});

test('recibir de vuelta lo que uno mismo subió no cuenta como recibido', async () => {
  const { phoneA, sync } = twoPhones();
  at(1_000, () =>
    phoneA.services.readMail(
      buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'CAFE CORDILLERA', amount: 2900 }),
    ),
  );
  const { pushed, pulled } = await sync(phoneA);
  assert.equal(pushed, 1);
  assert.equal(pulled, 0);
});
