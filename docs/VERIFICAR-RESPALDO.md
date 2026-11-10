# Comprobar el respaldo de MongoDB con mongosh

Comandos para correr **en el VPS** y confirmar que, con `CLOUD_SYNC=true`, el respaldo sí guarda datos. Todo es de lectura, salvo la sección 6, que borra.

Los datos son de personas reales (movimientos, reglas, presupuesto): corre esto solo en tu servidor y no pegues las salidas en chats ni en issues.

## 1. Antes de empezar: ¿está activo el respaldo?

```bash
ssh tu-servidor

curl -s https://app.movocr.xyz/api/health     # "mongo":true  (con el respaldo apagado dice null)
curl -s https://app.movocr.xyz/api/config     # "cloudSync":true
docker logs --tail 20 movo-api-1 | grep -i -E "mongo|respaldo"
# debe decir: "respaldo activo" y "[mongo] conectado"
```

Si `mongo` sale `null` o `cloudSync` sale `false`, revisa que el `.env` tenga `CLOUD_SYNC=true` y recrea la API: `docker compose -f docker-compose.nginx.yml up -d --force-recreate api`.

## 2. Entrar a mongosh

MongoDB no está abierto a Internet: solo se entra por su contenedor.

```bash
docker exec -it movo-mongo-1 mongosh movo
```

Para una consulta suelta, sin abrir la consola:

```bash
docker exec movo-mongo-1 mongosh movo --quiet --eval 'db.backup_records.countDocuments()'
```

La base se llama `movo` y todo el respaldo vive en una sola colección, `backup_records`. Cada documento es `{ userId, kind, id, updatedAt, serverSequence, isDeleted, data }`. `userId` es el identificador de la cuenta de Google (no el correo), `updatedAt` está en milisegundos y `kind` es `transaction`, `category_rule`, `setting` o `savings_goal`.

## 3. La prueba paso a paso

| # | Dónde | Qué hacer | Qué debe pasar |
| --- | --- | --- | --- |
| 1 | mongosh | `db.backup_records.countDocuments()` | `0` si nadie ha activado el respaldo |
| 2 | App | Ajustes → Respaldo en la nube → activar **Respaldar mis movimientos** → **Sincronizar ahora** | "Cambios pendientes" baja a 0 |
| 3 | mongosh | `db.backup_records.countDocuments()` | un número mayor que 0 |
| 4 | App | Cambiar la categoría de un movimiento y volver a sincronizar | el `serverSequence` de ese registro sube (sección 5) |
| 5 | App | **Borrar mi respaldo del servidor** | el conteo vuelve a `0` |

## 4. ¿Qué hay guardado?

Dentro de mongosh:

```js
// La colección existe (la API la crea al conectarse, con su validador)
show collections

// Cuántos registros hay
db.backup_records.countDocuments()

// Cuántos por tipo, vigentes y eliminados
db.backup_records.aggregate([
  { $group: {
      _id: "$kind",
      total: { $sum: 1 },
      vigentes: { $sum: { $cond: ["$isDeleted", 0, 1] } },
      eliminados: { $sum: { $cond: ["$isDeleted", 1, 0] } },
  } },
  { $sort: { _id: 1 } }
])

// Cuántas personas tienen respaldo, sin mostrar sus identificadores completos
db.backup_records.aggregate([
  { $group: { _id: "$userId", registros: { $sum: 1 }, ultimoCambio: { $max: "$updatedAt" } } },
  { $project: {
      _id: 0,
      persona: { $concat: [{ $substrCP: ["$_id", 0, 4] }, "…"] },
      registros: 1,
      ultimoCambio: { $toDate: "$ultimoCambio" },
  } },
  { $sort: { ultimoCambio: -1 } }
])
```

El mismo resumen que da `GET /api/backup/summary`, para la primera persona que encuentre:

```js
const userId = db.backup_records.findOne({}, { userId: 1 }).userId
db.backup_records.aggregate([
  { $match: { userId } },
  { $group: {
      _id: "$kind",
      active: { $sum: { $cond: ["$isDeleted", 0, 1] } },
      deleted: { $sum: { $cond: ["$isDeleted", 1, 0] } },
      lastUpdatedAt: { $max: "$updatedAt" },
  } },
  { $project: { _id: 0, kind: "$_id", active: 1, deleted: 1, lastUpdatedAt: 1 } },
  { $sort: { kind: 1 } }
])
```

## 5. Ver los últimos cambios

```js
// Los 5 cambios más recientes (sin datos personales)
db.backup_records.find(
  {},
  { _id: 0, kind: 1, id: 1, isDeleted: 1, updatedAt: 1, serverSequence: 1 }
).sort({ serverSequence: -1 }).limit(5)

// Los últimos movimientos: sin el comercio ni la nota
db.backup_records.find(
  { kind: "transaction" },
  { _id: 0, id: 1, isDeleted: 1, "data.date": 1, "data.amountCents": 1, "data.currency": 1,
    "data.category": 1, "data.type": 1, "data.bank": 1 }
).sort({ serverSequence: -1 }).limit(5)

// El presupuesto y los demás ajustes que se sincronizan
db.backup_records.find({ kind: "setting" }, { _id: 0, id: 1, "data.value": 1 })

// Un registro completo, por su id (cámbialo por uno que salga arriba)
db.backup_records.findOne({ kind: "transaction", id: "ID_DEL_MOVIMIENTO" }, { _id: 0, userId: 0 })
```

Los montos están en céntimos: `amountCents` es el monto original y `crcCents` el equivalente en colones. Para ver cuándo fue un cambio, `updatedAt` se convierte con `new Date(valor)`.

## 6. Borrar el respaldo de una persona

Es lo mismo que hace el botón **Borrar mi respaldo del servidor** de la app: quita lo guardado en el servidor, no lo que hay en el teléfono.

```js
const userId = db.backup_records.findOne({}, { userId: 1 }).userId   // cuidado: la primera persona que encuentre
db.backup_records.deleteMany({ userId })                              // devuelve deletedCount
db.backup_records.countDocuments({ userId })                          // 0
```

## 7. Cómo está armada la colección

```js
// Índices: único en { userId, kind, id } y otro en { userId, serverSequence }
db.backup_records.getIndexes()

// El validador $jsonSchema (nivel strict)
db.getCollectionInfos({ name: "backup_records" })[0].options

// Tamaño en disco, en bytes
db.backup_records.totalSize()

// La base misma rechaza un documento mal formado (debe fallar con "Document failed validation")
db.backup_records.insertOne({ foo: 1 })
```

## 8. Si no aparece nada

- `docker logs --tail 50 movo-api-1 | grep -i -E "mongo|respaldo|503"`: un `503` o "Respaldo no disponible por ahora" quiere decir que la API no alcanza a MongoDB.
- En la app, **Respaldar mis movimientos** tiene que estar activado y hay que tocar **Sincronizar ahora**. Si "Cambios pendientes" no baja, la sincronización no llegó al servidor.
- Un `429` ("Demasiadas solicitudes") es el límite de `RATE_LIMIT_PER_MIN`; espera un minuto.
- `docker ps | grep movo`: `movo-mongo-1` debe estar arriba.
- No corras `npm run seed:mongosh` en el VPS para probar: carga datos sintéticos en la base que apunte `MONGO_URL`. Sirve para desarrollo, no para comprobar lo que guarda la app de verdad.
