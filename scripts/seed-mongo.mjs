// Carga datos de prueba SINTÉTICOS en el respaldo de MongoDB, de forma reproducible.
// Uso: npm run seed:mongo                                  (200 correos, semilla 7, persona "persona-de-prueba")
//      npm run seed:mongo -- 500 42                        (500 correos con la semilla 42)
//      npm run seed:mongo -- 200 7 <sub de tu cuenta>      (para verlos en la app al encender el respaldo)
//
// La URI sale solo de MONGO_URL en el .env. Los datos hacen el mismo camino que los reales: los correos
// del dataset (scripts/dataset.mjs) los lee el lector de la app en una base SQLite, la app los sincroniza
// y el servidor los valida (parseSyncRequest) y los guarda con su caso de uso en MongoDB, que además
// los revisa con su validador $jsonSchema. Antes de cargar se borra lo que esa persona tenía, así que
// la misma semilla y la misma cantidad dejan siempre los mismos movimientos.
import initSqlJs from 'sql.js';
import { buildDataset } from './dataset.mjs';
import { createServices } from '../web/src/application/createServices.js';
import { createSqliteStorage } from '../web/src/infrastructure/sqlite/createSqliteStorage.js';
import { fromWireChanges, toWireChanges } from '../web/src/infrastructure/backend/backupWireFormat.js';
import { createMongoBackupStore } from '../server/src/adapters/mongo/MongoBackupStore.js';
import { parseSyncRequest } from '../server/src/adapters/http/parseSyncRequest.js';
import { toSyncResponse } from '../server/src/adapters/http/toSyncResponse.js';
import { createSyncBackup } from '../server/src/application/syncBackup.js';

const [count = 200, seed = 7] = process.argv.slice(2, 4).map(Number);
const userId = process.argv[4] || 'persona-de-prueba';
const DAYS = 45; // lo mismo que revisa la primera lectura de Gmail
const DAY_MS = 86400e3;

/** El teléfono habla con el servidor en proceso, pero todo viaja como JSON, igual que por la red. */
function serverFor(backupStore) {
  const syncBackup = createSyncBackup({ backupStore });
  const asJson = (value) => JSON.parse(JSON.stringify(value));
  return {
    getExchangeRate: async () => ({}),
    async syncBackup({ since, changes }) {
      const { cursor, records } = parseSyncRequest(asJson({ since, changes: toWireChanges(changes) }));
      const response = asJson(toSyncResponse(await syncBackup({ userId, cursor, records })));
      return { cursor: response.cursor, hasMore: response.hasMore, changes: fromWireChanges(response.changes) };
    },
  };
}

/** Correos del dataset con ids fijos: la misma semilla da los mismos movimientos (sus ids salen del Message-ID). */
function datasetMails() {
  const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS); // medianoche UTC: igual durante todo el día
  return buildDataset({ count, seed, days: DAYS, now: today }).map(({ mail }, index) => ({
    ...mail,
    id: `dataset-${seed}-${index}`,
    messageId: `<dataset-${seed}-${index}@movo.dataset>`,
  }));
}

async function loadIntoMongo() {
  if (!process.env.MONGO_URL) throw new Error('Falta MONGO_URL en el .env (ver .env.example).');
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(seed)) {
    throw new Error('Uso: npm run seed:mongo -- <cantidad> <semilla> [usuario]');
  }

  const store = createMongoBackupStore(process.env.MONGO_URL, {});
  try {
    const startedAt = performance.now();
    const removed = await store.deleteAll(userId);

    const SQL = await initSqlJs();
    const phone = createServices({
      storage: createSqliteStorage(new SQL.Database()),
      mailSource: { listNewMailIds: async () => [], fetchMail: async () => ({}) },
      backend: serverFor(store),
      buildDemoMails: () => [],
    });
    for (const mail of datasetMails()) phone.readMail(mail);
    const { pushed } = await phone.backup.syncNow('token-del-script');
    const stored = await store.findChangesAfter(userId, 0, count * 2);

    console.log(`Movo · carga en MongoDB (semilla ${seed}, ${count} correos, persona "${userId}")`);
    console.log(`  borrados antes     ${removed} registros`);
    console.log(`  movimientos leídos ${phone.queries.countTransactions()}`);
    console.log(`  subidos            ${pushed} registros`);
    console.log(`  en MongoDB         ${stored.length} registros`);
    console.log(`  tiempo             ${((performance.now() - startedAt) / 1000).toFixed(1)} s`);
  } finally {
    await store.close();
  }
}

await loadIntoMongo();
