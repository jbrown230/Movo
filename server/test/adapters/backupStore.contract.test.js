// Prueba de contrato del almacén de respaldo: la MISMA batería corre contra la versión en memoria
// y contra MongoDB real (si MONGO_URL está definido, como en GitHub Actions y docker compose).
// Así se garantiza que las dos se comportan igual.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryBackupStore } from '../../src/adapters/memory/InMemoryBackupStore.js';
import { MongoClient } from 'mongodb';
import { createMongoBackupStore } from '../../src/adapters/mongo/MongoBackupStore.js';

const mongoUrl = process.env.MONGO_URL;

let testDatabaseCount = 0;
/** Una base de datos de prueba distinta en cada llamada. */
function freshMongoUrl() {
  const url = new URL(mongoUrl);
  url.pathname = `/movo_test_${Date.now()}_${++testDatabaseCount}`;
  return url.toString();
}
const freshMongoStore = () => createMongoBackupStore(freshMongoUrl(), {});

/** Un movimiento completo, tal como lo deja la API después de validarlo. */
const transactionData = (category) => ({
  date: '2026-10-15T15:00:00.000Z',
  amountCents: 290000,
  currency: 'CRC',
  crcCents: 290000,
  exchangeRate: null,
  counterparty: 'CAFE CORDILLERA',
  category,
  categoryOrigin: null,
  type: 'tarjeta',
  direction: 'out',
  bank: 'BAC',
  mailKey: null,
  note: null,
});

const record = (id, updatedAt, category) => ({
  kind: 'transaction',
  id,
  updatedAt,
  isDeleted: false,
  data: transactionData(category),
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

describe('validador $jsonSchema de MongoDB', { skip: !mongoUrl && 'MONGO_URL no definido' }, () => {
  /** Conecta el almacén (que pone el validador) y devuelve la colección cruda, sin pasar por la API. */
  async function rawCollection(url = freshMongoUrl()) {
    const store = createMongoBackupStore(url, {});
    assert.equal(await store.ping(), true);
    const client = await new MongoClient(url).connect();
    const close = async () => {
      await client.db().dropDatabase();
      await Promise.all([client.close(), store.close()]);
    };
    return { collection: client.db().collection('backup_records'), close };
  }
  const document = (overrides) => ({
    userId: 'ana',
    kind: 'transaction',
    id: 'm1',
    updatedAt: 1,
    serverSequence: 1,
    isDeleted: false,
    data: transactionData('super'),
    ...overrides,
  });
  const rejected = { code: 121 }; // Document failed validation

  test('acepta un registro bien formado', async () => {
    const { collection, close } = await rawCollection();
    await collection.insertOne(document({}));
    await collection.insertOne(document({ kind: 'setting', id: 'budget', data: { value: 40000000 } }));
    await collection.insertOne(
      document({ kind: 'category_rule', id: 'CAFE', data: { counterpartyKey: 'CAFE', category: 'comida' } }),
    );
    assert.equal(await collection.countDocuments(), 3);
    await close();
  });

  test('rechaza lo mal formado aunque no pase por la API', async () => {
    const { collection, close } = await rawCollection();
    const invalidDocuments = [
      document({ data: { category: 'super' } }), // faltan campos del movimiento
      document({ data: { ...transactionData('super'), currency: 'BTC' } }), // moneda no permitida
      document({ data: { ...transactionData('super'), $where: 'x' } }), // campo de más
      document({ kind: 'cualquiera' }),
      document({ id: 'id/con/barras' }),
      document({ updatedAt: 'ayer' }),
      document({ kind: 'setting', id: 'clave_secreta', data: { value: 1 } }), // ajuste que no se sincroniza
      { ...document({}), extra: true },
    ];
    for (const invalid of invalidDocuments) await assert.rejects(collection.insertOne(invalid), rejected);
    assert.equal(await collection.countDocuments(), 0);
    await close();
  });

  test('también se aplica a una colección que ya existía sin validador', async () => {
    const url = freshMongoUrl();
    const setup = await new MongoClient(url).connect();
    await setup.db().createCollection('backup_records');
    await setup.close();

    const { collection, close } = await rawCollection(url);
    await assert.rejects(collection.insertOne(document({ data: {} })), rejected);
    await close();
  });
});
