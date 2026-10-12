// Prueba de contrato del almacén de respaldo: la MISMA batería corre contra la versión en memoria
// y contra MongoDB real (si MONGO_URL está definido, como en GitHub Actions y docker compose).
// Así se garantiza que las dos se comportan igual.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryBackupStore } from '../../src/adapters/memory/InMemoryBackupStore.js';
import { createMongoBackupStore } from '../../src/adapters/mongo/MongoBackupStore.js';

const mongoUrl = process.env.MONGO_URL;

function freshMongoStore() {
  const url = new URL(mongoUrl);
  url.pathname = '/movo_test_' + Date.now(); // una base de datos de prueba distinta en cada corrida
  return createMongoBackupStore(url.toString(), {});
}

const record = (id, updatedAt, category) => ({
  kind: 'transaction',
  id,
  updatedAt,
  isDeleted: false,
  data: { category },
});

function runContract(createStore) {
  test('guarda y devuelve los registros de una persona', async () => {
    const store = createStore();
    assert.equal(await store.saveChanges('ana', [record('m1', 2, 'super'), record('m2', 1, 'ocio')]), 2);

    const found = await store.findChangesAfter('ana', 0, 100);
    assert.deepEqual(found.map((item) => item.id).sort(), ['m1', 'm2']);
    assert.ok(found.every((item) => item.serverSequence > 0));
    await store.close();
  });

  test('gana el cambio más reciente: uno viejo no pisa al nuevo', async () => {
    const store = createStore();
    await store.saveChanges('ana', [record('m1', 2, 'super')]);
    await store.saveChanges('ana', [record('m1', 1, 'viejo')]);
    await store.saveChanges('ana', [record('m1', 2, 'igual')]); // igual de reciente: tampoco reemplaza

    const [stored] = await store.findChangesAfter('ana', 0, 100);
    assert.equal(stored.data.category, 'super');
    await store.close();
  });

  test('los datos de cada persona quedan separados', async () => {
    const store = createStore();
    await store.saveChanges('ana', [record('m1', 2, 'de-ana')]);
    await store.saveChanges('beto', [record('m1', 9, 'de-beto')]); // mismo id, otra persona

    assert.equal((await store.findChangesAfter('ana', 0, 100))[0].data.category, 'de-ana');
    assert.equal((await store.findChangesAfter('beto', 0, 100))[0].data.category, 'de-beto');
    await store.close();
  });

  test('el cursor devuelve solo lo posterior y respeta el límite', async () => {
    const store = createStore();
    await store.saveChanges('ana', [record('a', 1, 'x'), record('b', 1, 'x'), record('c', 1, 'x')]);

    const firstPage = await store.findChangesAfter('ana', 0, 2);
    assert.equal(firstPage.length, 2);
    const rest = await store.findChangesAfter('ana', firstPage.at(-1).serverSequence, 2);
    assert.equal(rest.length, 1);
    assert.equal((await store.findChangesAfter('ana', rest[0].serverSequence, 2)).length, 0);
    await store.close();
  });

  test('borrar todo elimina solo lo de esa persona', async () => {
    const store = createStore();
    await store.saveChanges('ana', [record('m1', 2, 'x'), record('m2', 2, 'x')]);
    await store.saveChanges('beto', [record('m1', 2, 'x')]);

    assert.equal(await store.deleteAll('ana'), 2);
    assert.equal((await store.findChangesAfter('ana', 0, 100)).length, 0);
    assert.equal((await store.findChangesAfter('beto', 0, 100)).length, 1);
    await store.close();
  });

  test('guardar una lista vacía no hace nada', async () => {
    const store = createStore();
    assert.equal(await store.saveChanges('ana', []), 0);
    await store.close();
  });
}

describe('almacén en memoria', () => runContract(createInMemoryBackupStore));
describe('almacén MongoDB', { skip: !mongoUrl && 'MONGO_URL no definido' }, () => runContract(freshMongoStore));
