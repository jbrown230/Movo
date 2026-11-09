import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryBackupStore } from '../../src/adapters/memory/InMemoryBackupStore.js';
import { createTestUseCases } from '../helpers/fakes.js';

const transaction = (id, updatedAt) => ({ kind: 'transaction', id, updatedAt, isDeleted: false, data: {} });

/** Almacén en memoria que cuenta cuántas veces se corrió el resumen (el aggregation pipeline en MongoDB). */
function createCountingStore() {
  const store = createInMemoryBackupStore();
  const counting = { ...store, summarizeCalls: 0 };
  counting.summarize = (userId) => {
    counting.summarizeCalls++;
    return store.summarize(userId);
  };
  return counting;
}

test('el resumen se calcula una vez y después sale de la caché', async () => {
  const backupStore = createCountingStore();
  const { useCases } = createTestUseCases({ backupStore });
  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m1', 1)] });

  const first = await useCases.getBackupSummary('ana');
  const second = await useCases.getBackupSummary('ana');

  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.deepEqual(second.activeByKind, { transaction: 1 });
  assert.equal(backupStore.summarizeCalls, 1);
});

test('sincronizar un cambio invalida el resumen guardado: el siguiente ya lo incluye', async () => {
  const backupStore = createCountingStore();
  const { useCases } = createTestUseCases({ backupStore });
  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m1', 1)] });
  await useCases.getBackupSummary('ana');

  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m2', 2)] });
  const after = await useCases.getBackupSummary('ana');

  assert.equal(after.fromCache, false);
  assert.deepEqual(after.activeByKind, { transaction: 2 });
  assert.equal(after.lastUpdatedAt, 2);
});

test('una sincronización sin cambios guardados no invalida el resumen', async () => {
  const backupStore = createCountingStore();
  const { useCases } = createTestUseCases({ backupStore });
  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m1', 5)] });
  await useCases.getBackupSummary('ana');

  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [] });
  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m1', 3)] }); // más viejo: no se guarda

  assert.equal((await useCases.getBackupSummary('ana')).fromCache, true);
  assert.equal(backupStore.summarizeCalls, 1);
});

test('borrar el respaldo invalida el resumen de esa persona y no el de otra', async () => {
  const backupStore = createCountingStore();
  const { useCases } = createTestUseCases({ backupStore });
  await useCases.syncBackup({ userId: 'ana', cursor: 0, records: [transaction('m1', 1)] });
  await useCases.syncBackup({ userId: 'beto', cursor: 0, records: [transaction('m1', 1)] });
  await useCases.getBackupSummary('ana');
  await useCases.getBackupSummary('beto');

  await useCases.deleteUserBackup('ana');

  assert.deepEqual((await useCases.getBackupSummary('ana')).activeByKind, {});
  assert.equal((await useCases.getBackupSummary('beto')).fromCache, true);
});
