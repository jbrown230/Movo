# Mediciones

## Efecto de Redis en el tipo de cambio

Issue 17 del [backlog](BACKLOG.md): comparar la latencia de `GET /api/fx` con Redis y sin Redis, con al menos 200 solicitudes, y decidir si Redis justifica su costo operativo.

- Script: [`scripts/bench-fx.mjs`](../scripts/bench-fx.mjs).
- Qué se mide: el tiempo de cada solicitud a la API, desde el cliente, con la API real levantada en el mismo proceso.

```bash
npm run bench:fx            # 200 solicitudes por escenario
npm run bench:fx -- 500     # otra cantidad
```

Necesita `BCCR_TOKEN` en el `.env` y Redis corriendo en `REDIS_URL` (por defecto `redis://localhost:6379`; en local, el contenedor `movo-redis`).

### Escenarios

| Escenario | Qué hace cada solicitud |
|---|---|
| Sin caché (BCCR directo) | Consulta al BCCR cada vez: dos llamadas, dólar (indicador 318) y euro (333), con 67 días de historial. |
| Caché en memoria | Lee el tipo de cambio de la memoria del proceso. Es lo que usa la API cuando no hay Redis. |
| Redis | Lee el tipo de cambio de Redis. Es lo que usa la API en producción. |

En los tres casos la API también suma la solicitud al contador del límite por minuto, igual que en producción, pero sin tope, para que las 200 solicitudes no terminen en 429. La primera solicitud de cada escenario se reporta aparte: con la caché vacía, consulta al BCCR.

### Primer hallazgo: sin caché, el BCCR rechaza las ráfagas

La primera corrida hizo las 200 solicitudes sin caché una tras otra, sin pausa. El BCCR rechazó **181 de 200** con `429 Rate limit is exceeded. Try again in 6 seconds`. Su límite ronda las 40 consultas por minuto, y cada solicitud sin caché le hace dos.

En esos 181 casos la API respondió rápido (mediana de 84 ms), pero con el **valor de reserva** (`FX_FALLBACK` = ₡510) en lugar del tipo de cambio real. Para la persona eso es peor que una respuesta lenta: ve un número equivocado sin saberlo.

Por eso la medición de latencia sin caché espera 3,5 s entre solicitudes, para quedar por debajo del límite y medir lo que de verdad tarda el BCCR.

### Resultados

200 solicitudes seguidas por escenario, el 20 de octubre de 2026, en una computadora con Windows 11, Node 22 y Redis 7 en Docker Desktop. Tiempos en milisegundos.

| Escenario | 1.ª solicitud (caché vacía) | Mediana | p95 | Media | Mín. | Máx. | Falló el BCCR |
|---|---|---|---|---|---|---|---|
| Sin caché (BCCR directo) | 676,9 | **693,9** | **845,6** | 749,7 | 435,5 | 6010,4 | 1 de 200 |
| Caché en memoria | 893,7 | **0,78** | **1,52** | 0,91 | 0,60 | 4,23 | 0 |
| Redis | 662,1 | **2,04** | **2,82** | 2,15 | 1,61 | 4,89 | 0 |

No hubo errores HTTP en ningún escenario. La falla del BCCR sin caché es la solicitud de 6 s: llegó al tiempo máximo de espera de la API y respondió con el valor de reserva.

### Interpretación

- **Lo que cambia la latencia es tener caché, no que sea Redis.** Con cualquier caché, la mediana baja de 694 ms a menos de 3 ms (unas 340 veces menos con Redis) y el p95 baja de 846 ms a menos de 3 ms.
- **Redis es un poco más lento que la memoria:** 2,0 ms contra 0,8 ms de mediana. Leer de la memoria del proceso no sale de él; leer de Redis es un viaje por la red local, aunque sea dentro de la misma máquina. Esa diferencia de 1,3 ms no se nota frente a lo que tarda la conexión entre el teléfono y el servidor.
- **Sin caché, la API depende del BCCR en cada solicitud:** tarda lo que tarde el BCCR (hasta 6 s cuando no responde) y, con más de unas 20 solicitudes por minuto en total, el BCCR empieza a rechazarlas y las personas ven el valor de reserva (ver el primer hallazgo).
- **La primera solicitud** tras vaciar la caché tarda lo mismo en los tres escenarios (unos 0,7–0,9 s), porque las tres consultan al BCCR. Con caché, eso pasa una vez cada 6 horas.

Límites de la medición: el cliente y la API corren en la misma máquina, así que los tiempos no incluyen la red entre el teléfono y el servidor; y las solicitudes van una tras otra, no al mismo tiempo.

### Conclusión: ¿justifica Redis el costo operativo?

**Por latencia, no.** La caché en memoria que la API ya tiene como respaldo es igual de efectiva, incluso un poco más rápida. Lo que no se puede quitar es la caché: sin ella la API es unas 340 veces más lenta y, peor, el límite del BCCR hace que la gente vea un tipo de cambio falso.

**Por robustez, sí, porque cuesta poco.** Redis aporta lo que la memoria no:

- La caché sobrevive a reinicios y despliegues de la API. Con solo memoria, cada reinicio vuelve a consultar al BCCR.
- Si la API corre en más de un proceso o servidor, todos comparten el mismo tipo de cambio y una sola consulta al BCCR cada 6 horas, en vez de una por proceso.
- El límite de solicitudes por minuto y la validación de tokens de Google se cuentan en un solo lugar. Con memoria, cada proceso lleva su propia cuenta y el límite real se multiplica.

Y su costo es bajo: un contenedor más en el `docker-compose.yml`, con la memoria limitada a 64 MB y sin guardar nada en disco. Si Redis se cae, la API sigue funcionando con la memoria (`ResilientCache`), así que no es un punto único de falla.

**Decisión: mantener Redis.** Para un solo servidor con un solo proceso de la API, la caché en memoria bastaría para el tipo de cambio; Redis se justifica por compartir el estado entre reinicios y procesos, no por velocidad.

## SQLite: consultas con y sin índices, y respaldo de la base

Tarea de SQLite del enunciado: revisar con `EXPLAIN QUERY PLAN` que las consultas principales usan los índices, medirlas con y sin ellos, y medir el respaldo de la base.

- Script: [`scripts/bench-sqlite.mjs`](../scripts/bench-sqlite.mjs).
- Qué se mide: las consultas que la app hace más seguido, con el mismo SQL de `web/src/infrastructure/sqlite/*Repository.js`, sobre una base llenada con el lector real de la app.

```bash
npm run bench:sqlite            # 10.000 correos repartidos en un año
npm run bench:sqlite -- 50000   # otra cantidad
```

No necesita nada más que Node: la base es sql.js en memoria, igual que en el teléfono.

### Cómo se mide

1. Se leen 10.000 correos sintéticos (semilla fija) con `readMail`, el mismo caso de uso de la app. Quedan 10.000 movimientos repartidos en 365 días.
2. Se guarda una copia exacta de la base con `db.export()`. Cada escenario abre su propia copia, así los dos parten de los mismos datos:
   - **Con los índices de la app:** `transactions_by_date`, `transactions_by_mail_key` y `mails_by_message_id` (`migrations.js`).
   - **Sin índices:** los mismos datos después de `DROP INDEX` de los tres. Las claves primarias quedan, porque son la tabla misma.
3. Cada consulta se repite durante al menos 200 ms y se toma el tiempo por consulta. Eso se hace **5 veces** y se reporta la mediana. El script se corrió **3 veces**; la tabla da la mediana de las tres corridas.
4. Al final de cada escenario se leen 500 correos nuevos, para ver lo que cuestan los índices al escribir.

### Plan de cada consulta (`EXPLAIN QUERY PLAN`)

| Consulta | Dónde está | Con índices | Sin índices |
|---|---|---|---|
| Resumen del mes | `transactionRepository.summarizeMonth` | `SEARCH transactions USING INDEX transactions_by_date (occurred_at>? AND occurred_at<?)`, y un B-tree temporal para el `GROUP BY` y el `ORDER BY` | `SCAN transactions` |
| Lista de movimientos (sin filtros) | `transactionRepository.list` | `SCAN transactions USING INDEX transactions_by_date`: recorre el índice ya ordenado y para en 400, sin ordenar | `SCAN transactions` y `USE TEMP B-TREE FOR ORDER BY`: lee todo y lo ordena |
| Lista de la última semana | `transactionRepository.list` con fechas | `SEARCH … USING INDEX transactions_by_date (occurred_at>? AND occurred_at<?)` | `SCAN transactions` y ordena |
| Movimientos de un correo | `transactionRepository.listForMail` | `SEARCH … USING INDEX transactions_by_mail_key (mail_key=?)` | `SCAN transactions` |
| ¿Ya se leyó este correo? | `mailRepository`, antes de leer cada correo | `MULTI-INDEX OR`: busca por la clave primaria (`id=?`) y por `mails_by_message_id` (`message_id=?`) | `SCAN mails` |

Todas las consultas usan su índice. La única que sigue recorriendo un índice entero es la lista sin filtros, y es a propósito: lo recorre en orden y se detiene en los 400 primeros.

### Resultados

10.000 correos, el 9 de noviembre de 2026, en una computadora con Windows 11 y Node 22. Mediana de 3 corridas, en milisegundos por consulta.

| Consulta | Con índices | Sin índices | Veces más lenta sin índices |
|---|---|---|---|
| Resumen del mes | **0,151** | 1,221 | 8,1 |
| Lista de movimientos (400) | **1,783** | 5,399 | 3,0 |
| Lista de la última semana | **0,876** | 1,951 | 2,2 |
| Movimientos de un correo | **0,016** | 0,773 | 48 |
| ¿Ya se leyó este correo? | **0,009** | 1,794 | 199 |
| Leer un correo nuevo (de 500) | **0,318** | 2,134 | 6,7 |

Con índices, la ejecución más lenta de cada medición quedó a menos del 10 % de la más rápida. Sin índices hubo más variación (hasta un 30 % en la primera corrida), pero la mediana cambió poco de una corrida a otra.

### Interpretación

- **Donde más pesan los índices es en las búsquedas de un solo valor:** saber si un correo ya se leyó es unas 200 veces más rápido con `mails_by_message_id`, y los movimientos de un correo, unas 50 veces con `transactions_by_mail_key`. Sin índice, las dos recorren la tabla completa.
- **Los índices no hacen más lenta la escritura, la hacen más rápida.** Se esperaba lo contrario, porque cada índice hay que mantenerlo al insertar. Pero leer un correo primero pregunta si ya se leyó, y sin índice esa pregunta recorre toda la tabla `mails`. Por eso leer un correo tarda 0,32 ms con índices y 2,1 ms sin ellos.
- **En las listas la diferencia es menor (2–3 veces),** porque gran parte del tiempo se va en armar las 400 filas que se devuelven, no en encontrarlas.
- **Con 10.000 movimientos todo sigue por debajo de 2 ms,** incluso sin índices. La diferencia crece con la tabla: un recorrido completo crece con el número de filas y una búsqueda por índice casi no. Cuánto crece está medido en "SQLite a 100, 10.000 y 100.000 correos", más abajo.

**Decisión: se mantienen los tres índices.** Ninguno sobra: cada uno lo usa al menos una consulta frecuente, y no frenan la escritura.

### Respaldo de la base: el equivalente a `.backup`

En el teléfono, SQLite corre con sql.js, compilado a WebAssembly y en memoria. No hay archivo en disco, así que no existen el modo WAL ni el comando `.backup` de la consola de SQLite. Su equivalente es `db.export()`, que devuelve la base completa como bytes (un archivo SQLite válido). La app lo guarda en IndexedDB un momento después de cada cambio (`web/src/infrastructure/sqlite/openUserDatabase.js`) y lo vuelve a abrir con `new SQL.Database(bytes)`.

| Operación | Mediana (3 corridas) |
|---|---|
| Exportar la base (`db.export()`) | 1,35 ms |
| Restaurarla (`new SQL.Database(bytes)`) | 1,37 ms |
| Tamaño de la base | 8,5 MB (10.000 movimientos con sus correos) |

La base restaurada tiene los mismos 10.000 movimientos y pasa `PRAGMA integrity_check`. La mayor parte del tamaño son los cuerpos de los correos guardados en `mails`. Lo que este script no mide es la escritura en IndexedDB, porque solo existe en el navegador.

## SQLite a 100, 10.000 y 100.000 correos

Issue [#31](https://github.com/jbrown230/Movo/issues/31): el enunciado pide responder qué cambia al escalar. Es el mismo script de la sección anterior, corrido con tres cantidades de correos repartidos en un año:

```bash
npm run bench:sqlite -- 100
npm run bench:sqlite -- 10000
npm run bench:sqlite -- 100000
```

Misma metodología: 5 ejecuciones por medición, 3 corridas por escala, y la tabla da la mediana de las tres. Se corrió el 9 de noviembre de 2026 en la misma computadora. Las cifras de 10.000 son de una tanda nueva y difieren de las de la sección anterior en torno al 10 % o menos.

### Resultados con los índices de la app

Milisegundos por consulta (por correo en la ingesta).

| Medición | 100 | 10.000 | 100.000 | Cómo crece de 10.000 a 100.000 |
|---|---|---|---|---|
| Leer un correo nuevo (ingesta) | 0,388 | 0,353 | 0,346 | No crece |
| ¿Ya se leyó este correo? | 0,010 | 0,010 | 0,010 | No crece |
| Movimientos de un correo | 0,016 | 0,015 | 0,015 | No crece |
| Lista de movimientos (400) | 0,455 | 1,737 | 1,810 | No crece |
| Lista de la última semana | 0,031 | 0,870 | 1,772 | 2 veces |
| Resumen del mes | 0,010 | 0,153 | 2,944 | 19 veces |
| Tamaño de la base | 152 KB | 8,5 MB | 86 MB | 10 veces |
| Exportar la base (`db.export()`) | 0,08 | 1,30 | 16,2 | 12 veces |
| Restaurarla | 0,07 | 1,40 | 16,3 | 12 veces |

### Las mismas consultas sin índices

| Medición | 100 | 10.000 | 100.000 | Veces más lenta que con índices, a 100.000 |
|---|---|---|---|---|
| Leer un correo nuevo (ingesta) | 0,362 | 2,095 | 18,131 | 52 |
| ¿Ya se leyó este correo? | 0,017 | 1,652 | 18,238 | 1.800 |
| Movimientos de un correo | 0,018 | 0,725 | 9,852 | 650 |
| Lista de movimientos (400) | 0,513 | 5,376 | 20,745 | 11 |
| Lista de la última semana | 0,036 | 1,856 | 14,825 | 8 |
| Resumen del mes | 0,018 | 1,210 | 14,619 | 5 |

### Qué cambia al escalar

- **Con índices, lo que la app hace con cada correo no depende del tamaño de la base.** Leer un correo, saber si ya se leyó y buscar sus movimientos tardan lo mismo con 100 que con 100.000 correos. Un índice es un árbol B: encontrar un valor cuesta unos pocos pasos aunque la tabla crezca 1.000 veces.
- **Sin índices, todo crece con la tabla.** Leer un correo pasa de 0,36 ms a 18 ms, porque antes de guardarlo hay que recorrer toda la tabla `mails` para saber si ya se leyó. Con 100.000 correos, guardar cada correo cuesta 50 veces más que con índices.
- **La lista no crece porque se detiene en 400.** Con índice, SQLite recorre el índice de fechas ya ordenado y para en las 400 primeras filas, haya 10.000 o 100.000. Sin índice tiene que leerlas y ordenarlas todas.
- **El resumen del mes sí crece, aun con índice.** El índice evita leer los otros once meses, pero los movimientos del mes hay que sumarlos todos, y con 100.000 correos al año el mes tiene unos 8.300. Por eso es lo único que crece con índice: 19 veces de 10.000 a 100.000, un poco más que los movimientos del mes (10 veces), porque los tiene que leer, agrupar y ordenar todos. Aun así son 3 ms.
- **Con 100 correos los índices no hacen diferencia.** Todo tarda menos de medio milisegundo, y leer un correo es hasta un poco más rápido sin índices, porque no hay que mantenerlos. Es la única escala donde cuestan más de lo que ahorran.
- **Lo que de verdad crece es el tamaño.** La base ocupa unos 0,9 KB por correo, casi todo el cuerpo guardado en `mails`, así que 100.000 correos son 86 MB. Exportarla tarda 16 ms, y la app la guarda completa en IndexedDB después de cada cambio, con todo eso en la memoria del teléfono.

### Conclusión

Para una persona, las consultas no son el límite. Unos 60 a 100 avisos del banco al mes son unos 1.000 correos al año: 10.000 correos son casi diez años, y en esa escala todo sigue por debajo de 2 ms. 100.000 correos no le pasarían a una persona; sirven para ver dónde está el límite.

Si la base llegara a crecer tanto, el límite sería el tamaño y no la velocidad: guardar 86 MB completos en IndexedDB después de cada cambio. La mejora sería no guardar el cuerpo completo de los correos viejos, que ya no se necesitan una vez registrados. Con los volúmenes reales no hace falta, así que queda anotado y no se hace.

## MongoDB: sincronización y resumen del respaldo, con y sin índice

Tarea de MongoDB del enunciado: mostrar con `explain()` que las consultas usan los índices, escribir un aggregation pipeline con sentido y medir una consulta representativa.

- Script: [`scripts/bench-mongo.mjs`](../scripts/bench-mongo.mjs).
- Qué se mide:
  - la consulta de la sincronización (`findChangesAfter`), que es lo que más hace el servidor;
  - el aggregation pipeline del resumen del respaldo (`backupSummaryPipeline`), los dos tal como están en `server/src/adapters/mongo/MongoBackupStore.js`.

```bash
npm run bench:mongo                # 200 personas × 500 registros = 100.000 documentos
npm run bench:mongo -- 500 1000    # otra escala
```

Necesita `MONGO_URL` (y `REDIS_URL` para la última parte) en el `.env`. Trabaja en una base aparte, `movo_bench`, y la borra al terminar.

### Cómo se mide

1. Se cargan 200 personas con 500 registros cada una por el almacén real (`saveChanges`). Así la colección tiene su validador y sus índices, `{ userId, kind, id }` (único) y `{ userId, serverSequence }`. Casi todos los registros son movimientos, con algunas reglas, un ajuste y un 5 % eliminados.
2. Se mide una persona con y sin índice. "Sin índice" no borra los índices: fuerza el recorrido de la colección con `hint({ $natural: 1 })`. Así los dos casos usan la misma colección y la misma consulta.
3. Cada consulta se repite durante al menos 300 ms. Eso se hace **5 veces** y se reporta la mediana. El script se corrió **3 veces**; la tabla da la mediana de las tres corridas.

### El aggregation pipeline: resumen del respaldo

`GET /api/backup/summary` responde cuántos movimientos, reglas, ajustes y metas guarda la persona, cuántos están eliminados y cuándo fue el último cambio. Lo calcula MongoDB:

```js
[
  { $match: { userId } }, // primero, para usar el índice y leer solo lo de esa persona
  {
    $group: {
      _id: '$kind',
      active: { $sum: { $cond: ['$isDeleted', 0, 1] } },
      deleted: { $sum: { $cond: ['$isDeleted', 1, 0] } },
      lastUpdatedAt: { $max: '$updatedAt' },
    },
  },
  { $project: { _id: 0, kind: '$_id', active: 1, deleted: 1, lastUpdatedAt: 1 } },
  { $sort: { kind: 1 } },
];
```

Con los datos de la medición devuelve tres filas: 464 movimientos vigentes y 25 eliminados, 10 reglas y 1 ajuste.

### Plan de cada consulta (`explain("executionStats")`)

| Consulta | Con índice | Sin índice |
|---|---|---|
| Sincronización completa (cursor 0) | `IXSCAN (userId_1_serverSequence_1) → FETCH → LIMIT`: 500 claves y 500 documentos leídos para devolver 500. Sin `SORT`: el índice ya da el orden | `COLLSCAN → SORT`: 100.000 documentos leídos y ordenados en memoria para devolver 500 |
| Sincronización a mitad (cursor en el registro del medio) | `IXSCAN`: 249 claves y 249 documentos para devolver 249. El cursor salta directo a su lugar en el índice | `COLLSCAN → SORT`: otra vez 100.000 documentos |
| Resumen del respaldo (pipeline) | `IXSCAN (userId_1_serverSequence_1) → FETCH → $group → $project → $sort`: 500 documentos | `COLLSCAN → $group → …`: 100.000 documentos |

Con índice, MongoDB lee exactamente los documentos que devuelve: ni uno de más. Para el pipeline, el planificador eligió `{ userId, serverSequence }` aunque `{ userId, kind, id }` también empieza por `userId`; con cualquiera de los dos lee solo los documentos de esa persona.

### Resultados

200 personas × 500 registros, el 9 de noviembre de 2026, en una computadora con Windows 11, Node 22 y MongoDB 7 en Docker Desktop. Mediana de 3 corridas, en milisegundos.

| Consulta | Con índice | Sin índice (COLLSCAN) | Veces más lenta sin índice |
|---|---|---|---|
| Sincronización completa (cursor 0) | **4,78** | 37,45 | 7,8 |
| Sincronización a mitad | **2,98** | 36,14 | 12,1 |
| Resumen del respaldo (pipeline) | **1,62** | 33,24 | 20,5 |

### Interpretación

- **Sin índice, el costo depende de cuántos documentos hay en total, no de cuántos tiene la persona.** Cada consulta lee los 100.000 documentos de las 200 personas, aunque devuelva 249. Con índice, el costo depende solo de lo que se devuelve. Por eso la diferencia crece con el número de personas que usan el respaldo.
- **El índice del cursor evita además el ordenamiento.** `{ userId, serverSequence }` entrega los registros ya en el orden que pide la sincronización. Sin él, MongoDB tiene que leer todo y ordenarlo en memoria (`SORT`).
- **La sincronización completa tarda más que el pipeline** porque devuelve los 500 documentos al servidor; el pipeline los agrupa dentro de MongoDB y devuelve solo tres filas.

**Decisión: se mantienen los dos índices.** El de `{ userId, serverSequence }` es el que usan la sincronización y el resumen. El único, `{ userId, kind, id }`, sostiene la regla de "gana el más reciente" (no puede haber dos versiones del mismo registro).

### El resumen con y sin Redis

El resumen se guarda en Redis como un hash (`bk:summary:<persona>`), con un campo por tipo de registro. Se invalida explícitamente: la clave se borra en cuanto una sincronización guarda algún cambio o la persona borra su respaldo. Ver "Claves en Redis" en [ARQUITECTURA.md](ARQUITECTURA.md). Se midió el caso de uso completo (`getBackupSummary`) con Redis 7, con la misma metodología:

| Escenario | Mediana (3 corridas) |
|---|---|
| Sin caché: invalidar, correr el pipeline y guardar el hash | 3,24 ms |
| Con el hash en Redis | **0,41 ms** |

Con la caché, el resumen es unas 8 veces más rápido y no le cuesta nada a MongoDB. Como se invalida en cuanto cambia el respaldo, nunca muestra un resumen viejo; el vencimiento de una hora es solo una red de seguridad.
