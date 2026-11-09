// Carga de datos SINTÉTICOS en el respaldo de MongoDB, escrita para mongosh.
// No se corre sola: la lanza scripts/seed-mongosh.mjs (npm run seed:mongosh), que lee la URI de
// MONGO_URL en el .env y antepone `const CONFIG = { count, seed, userId, schema }`.
//
// Hace lo mismo que la API al conectarse (validador $jsonSchema e índices) y después carga, para una
// persona de prueba, movimientos, reglas y el presupuesto. Antes borra lo que esa persona tenía, así
// la misma semilla deja siempre los mismos datos. Al final muestra el resumen con un aggregation pipeline.
/* global db, print, CONFIG */

const COLLECTION = 'backup_records';
const DAY_MS = 86400e3;
const MERCHANTS = ['SUPER DEMO', 'SODA DEMO', 'FARMACIA DEMO', 'GASOLINERA DEMO', 'CINE DEMO', 'TIENDA DEMO'];
const CATEGORIES = ['super', 'comida', 'salud', 'transporte', 'ocio', 'otros']; // las de web/src/domain/categories.js

// 1. El validador $jsonSchema (el mismo de la API) y los índices.
const validation = { validator: { $jsonSchema: CONFIG.schema }, validationLevel: 'strict' };
if (db.getCollectionNames().includes(COLLECTION)) db.runCommand({ collMod: COLLECTION, ...validation });
else db.createCollection(COLLECTION, validation);
const records = db.getCollection(COLLECTION);
records.createIndex({ userId: 1, kind: 1, id: 1 }, { unique: true });
records.createIndex({ userId: 1, serverSequence: 1 });

// 2. Datos de prueba reproducibles: generador con semilla fija.
let state = CONFIG.seed;
const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
let sequence = Date.now() * 1000;

const envelope = (kind, id, updatedAt, data) => ({
  userId: CONFIG.userId,
  kind,
  id,
  updatedAt,
  serverSequence: ++sequence,
  isDeleted: false,
  data,
});

const documents = [];
for (let index = 0; index < CONFIG.count; index++) {
  const merchant = Math.floor(random() * MERCHANTS.length);
  const isIncome = random() < 0.15;
  const amountCents = Math.round((1000 + random() * 60000) * 100);
  const date = new Date(today - Math.floor(random() * 45) * DAY_MS + Math.floor(random() * DAY_MS));
  documents.push(
    envelope('transaction', `mongosh-${CONFIG.seed}-${index}`, date.getTime(), {
      date: date.toISOString(),
      amountCents,
      currency: 'CRC',
      crcCents: amountCents,
      exchangeRate: null,
      counterparty: isIncome ? 'PERSONA DE PRUEBA' : MERCHANTS[merchant],
      category: isIncome ? 'ingreso' : CATEGORIES[merchant],
      categoryOrigin: null,
      type: isIncome ? 'sinpe' : 'tarjeta',
      direction: isIncome ? 'in' : 'out',
      bank: ['BCR', 'BN', 'BAC'][Math.floor(random() * 3)],
      mailKey: null,
      note: null,
    }),
  );
}
MERCHANTS.forEach((merchant, index) =>
  documents.push(
    envelope('category_rule', merchant, today, { counterpartyKey: merchant, category: CATEGORIES[index] }),
  ),
);
documents.push(envelope('setting', 'budget', today, { value: 40000000 }));

// 3. Carga: se borra lo de esa persona y se insertan los documentos (MongoDB los valida uno por uno).
const removed = records.deleteMany({ userId: CONFIG.userId }).deletedCount;
const inserted = Object.keys(records.insertMany(documents).insertedIds).length;

// 4. Resumen con un aggregation pipeline, igual al de GET /api/backup/summary.
const summary = records
  .aggregate([
    { $match: { userId: CONFIG.userId } },
    { $group: { _id: '$kind', registros: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  .toArray();

print(`Movo · carga con mongosh (semilla ${CONFIG.seed}, persona "${CONFIG.userId}")`);
print(`  borrados antes  ${removed}`);
print(`  insertados      ${inserted}`);
summary.forEach((row) => print(`  ${row._id.padEnd(15)} ${row.registros}`));
