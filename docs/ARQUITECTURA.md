# Arquitectura

## Principio: el teléfono hace el trabajo

Movo está pensada para muchos usuarios con un servidor pequeño y barato, porque es código abierto y cualquiera debería poder alojarlo. Por eso la lectura de correos, el análisis, la categorización y las agregaciones ocurren en el teléfono. El servidor es opcional para usar la app: sin él, el modo demo y el registro manual funcionan igual.

## Componentes

### La app del teléfono (`web/src`)

Es una PWA hecha con **React** y compilada con **Vite**. El código está dividido en capas para que cada parte se pueda leer, probar y cambiar sin romper las demás.

```
web/src/
  domain/           Reglas del negocio. Funciones puras: sin pantalla, sin base de datos, sin red.
    emailParser/      Lee un correo del banco (una plantilla por formato, en templates/)
    categories.js     Categorías y cómo se asignan automáticamente
    names.js, money.js, ids.js, period.js, banks.js, types.js
  application/      Casos de uso: lo que la app puede hacer. Solo conocen el dominio y "puertos".
    ingestMail.js     Lee un correo y registra sus movimientos
    reparseMails.js   Vuelve a leer correos cuando mejora el lector
    transactionActions.js  Cambiar categoría o cómo se cuenta, agregar a mano, eliminar
    scanInbox.js, backupSync.js, refreshExchangeRate.js, seedDemoData.js
    queries.js, preferences.js, ports.js, createServices.js
  infrastructure/   Conexión con el exterior. Implementa los puertos.
    sqlite/           Esquema, migraciones y un repositorio por tabla (sql.js)
    gmail/            Inicio de sesión con Google, API de Gmail, conversión de HTML a texto
    backend/          Cliente de la API de Movo
    browser/          IndexedDB y almacenamiento del perfil
  presentation/     Interfaz React.
    screens/          Inicio, Bandeja, Ajustes, Bienvenida
    modals/           Las hojas que suben desde abajo
    components/       Piezas pequeñas: íconos, campos de formulario
    state/            Proveedores: sesión, navegación, avisos, Gmail
    hooks/, format/, styles/
  composition/      Arma las capas entre sí (openSession.js) y expone lo del navegador (platform.js)
  demo/             Correos sintéticos para el modo demo, las pruebas y el benchmark
```

**Regla de dependencias:** cada capa solo puede usar las que están "debajo".

| Capa | Puede usar | No puede usar |
|---|---|---|
| `domain` | nada más (ni React, ni SQL, ni `fetch`) | todo lo demás |
| `application` | `domain` y los puertos de `ports.js` | React, SQLite, Gmail directamente |
| `infrastructure` | `domain` | `application`, `presentation` |
| `presentation` | `domain`, `application` y `composition` | `infrastructure` directamente |
| `composition` | todas | |

Por eso los casos de uso se prueban en Node con una base SQLite real en memoria y un correo y un servidor simulados (`tests/helpers/createTestApp.js`), y la interfaz se prueba con Vitest y Testing Library.

Un movimiento recorre las capas así: la persona pega un aviso en `PasteModal` (presentation) -> `services.readMail` (application, `ingestMail`) -> `parseMail` lee el texto (domain) -> `transactions.insert` guarda en SQLite (infrastructure) -> `refresh()` hace que las pantallas vuelvan a leer.

### El servidor (`server/`)

Una API Express pequeña y opcional. Tiene las mismas capas que la app, con otros nombres. Las rutas están en [API.md](API.md).

```
server/src/
  domain/           Reglas puras: "gana el cambio más reciente", el cursor del respaldo.
  application/      Casos de uso (authenticateUser, syncBackup, getExchangeRate, deleteUserBackup...),
                    los errores de la aplicación y los puertos (ports.js).
  adapters/         Todo lo que toca el exterior; cada carpeta implementa un puerto:
    http/             Express: rutas, validación de lo que llega, traducción de errores a códigos HTTP
    mongo/            Respaldo en MongoDB
    memory/           Respaldo en memoria (pruebas)
    cache/            Redis, memoria del proceso, y una caché que usa Redis si responde y memoria si no
    bccr/             Tipo de cambio del Banco Central
    google/           Validación del token de Google
  config.js         Lee las variables de entorno
  index.js          Arranque: elige las piezas reales y las conecta
```

La capa HTTP **no tiene reglas de negocio**: lee la petición, llama a un caso de uso y devuelve la respuesta. Los casos de uso no saben si el respaldo está en MongoDB o en memoria, ni si la caché es Redis: solo conocen los puertos, y por eso se prueban con versiones simples en memoria.

### Lo que comparten la app y el servidor

Solo comparten [`shared/backupContract.js`](../shared/backupContract.js): nombres de las listas, valores permitidos y límites del respaldo. Es un archivo de constantes, sin dependencias. La app lo usa en `infrastructure/backend` (donde traduce sus entidades al formato de red) y el servidor en su validación y en la respuesta.

### Cómo se hacen cumplir las reglas

Las reglas de este documento no dependen de la disciplina de nadie:

- **`tests/architecture`** falla si una capa importa de otra que no le toca (en la app y en el servidor), si un paquete externo aparece donde no debe (React fuera de `presentation`, `express` fuera de `adapters/http`...), o si la app y el servidor se importan entre sí.
- **`tests/contract`** simula dos teléfonos sincronizándose con el código real del servidor, y comprueba que los valores del contrato coincidan con el vocabulario de la app.
- **ESLint** (`npm run lint`) limita el tamaño y la complejidad de las funciones (70 líneas, complejidad 12, 4 parámetros), prohíbe los nombres de una letra y las ternarias anidadas, y detecta código sin usar.
- **Prettier** (`npm run format:check`) deja un solo estilo de formato.

Todo esto corre en el CI en cada cambio.

### Service worker

`web/public/sw.js` hace que la app abra sin Internet: guarda las páginas y los archivos de la app la primera vez que se piden. Nunca guarda `/api` ni lo de Google.

## Decisión: leer Gmail desde el teléfono y no con un worker en el servidor

La propuesta inicial contemplaba un worker en el servidor con un stream de Redis. Lo cambiamos por estas razones:

- Privacidad: el servidor nunca guarda tokens de larga duración ni ve correos.
- Costo: con N usuarios, la carga de leer y analizar correos se reparte en N teléfonos.
- Simplicidad: no hay colas ni workers que mantener en el VPS.

El costo es que la lectura ocurre solo con la app abierta, porque el token dura una hora. Lo aceptamos para el MVP; la lectura en segundo plano queda en el roadmap.

## Modelo de datos local (SQLite)

Cinco tablas, con nombres completos (el esquema está documentado también al inicio de `infrastructure/sqlite/migrations.js`):

| Tabla | Qué guarda |
|---|---|
| `transactions` | Cada movimiento de dinero |
| `mails` | Cada correo del banco que Movo leyó |
| `category_rules` | Reglas de la persona: "este comercio va en Comida" |
| `settings` | Ajustes que se sincronizan con el respaldo (presupuesto, búsqueda de Gmail) |
| `local_state` | Estado que solo importa en este teléfono: cursores, caché del tipo de cambio |

**`transactions`**

| Columna | Significado |
|---|---|
| `occurred_at` | Fecha y hora del movimiento |
| `amount_cents`, `currency` | Monto original en céntimos y su moneda (`CRC`, `USD` o `EUR`) |
| `amount_crc_cents`, `exchange_rate` | Monto convertido a colones y el tipo de cambio usado (si fue en dólares o euros). Se usa el tipo de cambio del día de la compra (en hora de Costa Rica), no el del día en que se leyó el correo; cada vez que llega el tipo de cambio del servidor se corrigen las compras de los últimos 60 días. Una compra en euros leída sin tipo de cambio queda con `exchange_rate` 0 hasta que llega uno |
| `counterparty` | Comercio o persona con quien fue el movimiento |
| `category`, `category_origin` | Categoría y quién la decidió (regla automática, tu regla, elegida por ti) |
| `type` | `sinpe`, `tarjeta`, `transferencia` o `efectivo` |
| `direction` | `out` es gasto, `in` es ingreso y `self` es entre mis cuentas |
| `mail_key` | Message-ID del correo del que salió (vacío si lo escribió la persona) |
| `updated_at`, `is_deleted`, `needs_backup` | Sincronización: cuándo cambió, si se eliminó ("borrado lógico") y si falta subirlo al respaldo |

Los montos van siempre en céntimos, sin decimales flotantes.

**`mails`** guarda el correo leído: `message_id` con índice único, cuerpo, estado (`registrado`, `sin_movimiento`, `negada` o `descartado`), la plantilla usada (`template`), el movimiento resultante (`transaction_id`) y una nota con el resultado. Un correo puede producir varios movimientos (tabla de tarjeta del BCR).

**`category_rules`** relaciona el nombre de un comercio ya normalizado (`counterparty_key`) con una `category`.

En el código, las filas se traducen a entidades con nombres claros (por ejemplo `amount_crc_cents` es `crcCents` y `mail_key` es `mailKey`): ver `infrastructure/sqlite/*Repository.js` y los tipos en `domain/types.js`. Las claves de `local_state` están en `application/localStateKeys.js`.

### Cambios al esquema

El esquema se crea con migraciones numeradas (`migrations.js`). Una instalación nueva las ejecuta todas desde la 1. Al cambiar el esquema después de publicar una versión, no se edita una migración existente: se agrega una nueva al final.

El formato con el que el teléfono y el servidor intercambian el respaldo (`amountCents`, `cat`, `dir`...) es un contrato aparte del esquema local.


El id de un movimiento leído de un correo se deriva del Message-ID (`'m' + hash`). Así, dos teléfonos del mismo usuario que leen el mismo correo generan el mismo id, y el respaldo no duplica.

## Modelo en MongoDB

Una colección `backup_records` con documentos `{ userId, kind, id, updatedAt, serverSequence, isDeleted, data }`. Los detalles y el formato de red están en [API.md](API.md).

- `kind` dice qué es el registro: `transaction`, `category_rule` o `setting`.
- `data` trae el contenido del registro tal como lo envió el teléfono, ya validado contra una lista blanca.
- Índices: único en `{ userId, kind, id }` y otro en `{ userId, serverSequence }`, que es el cursor de la sincronización.

### Decisión: un documento por registro, con el contenido embebido

Cada movimiento, regla o ajuste es un documento propio. El contenido va embebido en `data` y la persona se identifica con el campo `userId`; no hay una colección de usuarios ni referencias entre documentos.

Alternativas descartadas:

| Alternativa | Por qué no |
|---|---|
| Un documento por persona, con todos sus movimientos embebidos en un arreglo | El documento crece sin límite y cada cambio obligaría a modificar el arreglo completo. Tampoco se podría pedir "solo lo que cambió después del cursor" con un índice. |
| Colecciones separadas con referencias (movimientos, reglas, usuarios) y `$lookup` | El servidor nunca cruza datos: las consultas y los totales se hacen en el teléfono, con SQLite. Las referencias agregarían consultas sin dar nada a cambio. |

Lo que se gana con un documento por registro:

- **"Gana el más reciente" en una sola operación.** Cada registro se guarda con un `updateOne` condicionado a que `updatedAt` sea menor; al ser un solo documento, la operación es atómica y no necesita transacciones.
- **Sincronización incremental.** Pedir los cambios de una persona es un recorrido del índice `{ userId, serverSequence }` a partir del cursor.
- **Separación por usuario simple.** Toda consulta filtra por `userId`, y borrar los datos de una persona es un `deleteMany` con ese filtro.
- **Esquema flexible donde conviene.** Los tres tipos de registro comparten la misma envoltura y solo cambia `data`, así que agregar un tipo no exige otra colección.

El costo es que `userId` y `kind` se repiten en cada documento, y que MongoDB no valida la forma de `data`: esa validación la hace la capa HTTP antes de guardar.

### Local o Atlas

En desarrollo y en el despliegue con Docker se usa un MongoDB local (el servicio `mongo` del `docker-compose.yml`). La conexión sale únicamente de la variable `MONGO_URL`, así que apuntar a MongoDB Atlas no requiere cambios de código. El respaldo está apagado salvo que se active con `CLOUD_SYNC=true`.

## Claves en Redis

Redis guarda solo datos efímeros que se pueden reconstruir. Todas las claves son de tipo string y vencen solas; ninguna guarda datos de los movimientos.

| Clave | Qué guarda | Vence en | Dónde se define |
|---|---|---|---|
| `fx:usd` | Tipo de cambio vigente del dólar y del euro, con el de cada uno de los últimos 60 días, como JSON `{ rate, date, source, euro, history }` | 6 horas; 30 minutos si es el valor de reserva, para reintentar pronto | `application/getExchangeRate.js` |
| `fx:usd:last` | Último tipo de cambio obtenido del BCCR, por si la fuente falla | 30 días | `application/getExchangeRate.js` |
| `tok:<sha256 del token>` | Id de la persona dueña de un token de Google ya validado. Se guarda un resumen del token, nunca el token completo | Lo que le quede de vida al token, máximo 1 hora | `application/authenticateUser.js` |
| `rl:<quién>:<minuto>` | Contador de solicitudes de ese minuto. `<quién>` es el id de la persona, o `ip:<dirección>` en las rutas sin sesión | 70 segundos | `application/rateLimiter.js` |

Las claves no llevan prefijo de grupo porque Movo usa su propio Redis (el del `docker-compose.yml`). Para usar un Redis compartido habría que anteponer un prefijo a todas.

Si Redis no está configurado o deja de responder, las mismas claves se guardan en la memoria del proceso (`adapters/cache/ResilientCache.js`): la API sigue funcionando y solo se pierde la caché al reiniciar.

## Sincronización

1. El teléfono envía lo marcado con `needs_backup` (máximo 500 registros por solicitud) junto con su cursor `since`.
2. El servidor valida cada campo con una lista blanca y guarda con "gana el más reciente": solo reemplaza si `updatedAt` es mayor (ver "Conflictos entre teléfonos").
3. El servidor responde con lo que cambió para esa persona después del cursor, y un cursor nuevo. Si hay más de 1000 cambios, `hasMore` es `true` y se pide otra vez.
4. El teléfono aplica esos cambios con la misma regla y guarda el cursor.

Borrar el respaldo (`DELETE /api/me`) vacía lo del servidor, apaga la sincronización y reinicia el cursor en 0. Lo del teléfono no se borra: todos sus movimientos, reglas y ajustes vuelven a quedar con `needs_backup=1`, sin cambiar su `updated_at`. Así, si la persona enciende el respaldo otra vez, la siguiente sincronización sube todo de nuevo y otro teléfono puede recuperarlo.

### Conflictos entre teléfonos

Si dos teléfonos de la misma persona cambian lo mismo antes de sincronizar, la regla es **gana la última escritura, registro por registro**. Cada movimiento, regla de categoría y ajuste se decide por separado, según la marca de tiempo `updatedAt` que pone el teléfono al hacer el cambio. No importa quién sincronice primero.

- **En el servidor** (`server/src/domain/backupRecord.js`, `shouldReplace`): un cambio solo reemplaza al guardado si su `updatedAt` es mayor. En un empate se queda lo que llegó primero.
- **En el teléfono** (`web/src/infrastructure/sqlite/backupRepository.js`, `keepsLocal`): lo que llega reemplaza lo local si es más reciente. Si lo local es más reciente, se queda y se sube en la próxima sincronización. En un empate el teléfono adopta la versión del servidor, salvo que ya sea idéntica a la suya (lo que él mismo acaba de subir, que tampoco cuenta como "recibido").

| Caso | Resultado en los dos teléfonos |
|---|---|
| Los dos editan el mismo movimiento | Queda el último cambio, sincronice primero quien sincronice |
| Uno edita y el otro elimina | Gana lo último: si eliminar fue después, queda eliminado; si editar fue después, el movimiento vuelve con el cambio |
| Editan movimientos distintos | Se conservan los dos cambios: no hay conflicto |
| Los dos cambian el presupuesto | Queda el último valor |
| Los dos cambian lo mismo en el mismo milisegundo | Queda lo que llegó primero al servidor |
| Un teléfono limpio vuelve a leer de Gmail un movimiento que ya se editó en otro | Queda lo editado: el movimiento recién leído lleva como marca la fecha de la compra, no la hora de lectura |

Cada caso tiene su prueba con dos teléfonos simulados (la app real con SQLite) y el código real del servidor, con el reloj controlado: `tests/contract/syncConflicts.test.js`.

Límites que se aceptan para el MVP:

- **Se compara el registro completo, no cada campo.** Si un teléfono cambia la categoría y el otro la dirección del mismo movimiento, queda solo el último de los dos cambios.
- **Un movimiento leído de un correo lleva como `updatedAt` la fecha de la compra** (nunca más que la hora actual), no la hora en que se leyó. Así, releer el mismo correo en otro teléfono, o tras borrar los datos del navegador, da la misma marca y no pisa las ediciones del respaldo, que siempre son posteriores (#59).
- **Manda el reloj del teléfono.** Si un teléfono tiene la hora adelantada, sus cambios ganan aunque se hayan hecho antes.
- **Eliminar es un borrado lógico** (`is_deleted`), así que un cambio posterior en otro teléfono lo hace volver.

## Separación por usuario

En el teléfono, cada cuenta de Google tiene su propio archivo SQLite en IndexedDB, y el modo demo tiene otro.

En el servidor, el usuario sale únicamente del token de Google, validado contra Google y con verificación de que pertenece a esta app (`aud`). Todas las consultas a MongoDB incluyen `userId`. La prueba de contrato del almacén (`backupStore.contract.test.js`) lo verifica contra el almacén en memoria y contra MongoDB real.

## Escenarios de falla

| Escenario | Qué pasa |
|---|---|
| Redis se cae a mitad de ejecución | La caché pasa a la memoria del proceso y la API sigue respondiendo sin esperas: en la prueba, cinco solicitudes seguidas al tipo de cambio respondieron bien en menos de 1 s cada una, consultando la fuente una sola vez más. `/api/health` pasa a decir `redis: false`. Se pierden la caché compartida y el conteo del límite por minuto entre procesos hasta que Redis vuelve |
| MongoDB se cae a mitad de ejecución | `/api/sync` y `DELETE /api/me` responden 503 con "Respaldo no disponible por ahora." después de unos 4 s (el tiempo de espera del controlador); antes respondían 500 "Error interno." `/api/health` dice `mongo: false` y el resto de la API sigue funcionando. La app muestra "No se pudo sincronizar: Respaldo no disponible por ahora.", sigue con SQLite y deja los cambios pendientes para el próximo intento |
| MongoDB caído al arrancar la API | El respaldo responde 503 mientras no esté, y se reconecta solo cuando vuelve, sin reiniciar la API. Antes quedaba sin respaldo hasta reiniciarla |
| Sin Internet | La PWA abre desde el service worker; se puede registrar efectivo y ver todo lo leído |
| Correo con formato desconocido | Queda como "Sin movimiento", visible en la bandeja, y se puede registrar a mano; se relee solo cuando sube `PARSER_VERSION` |
| Transacción negada por el banco | No se registra; el correo queda como "Negada por el banco" con el detalle |
| Vence el token de Google | La app muestra "Reconectar Gmail"; la reconexión es silenciosa si la sesión de Google sigue activa |
| BCCR no responde | Se usa el último valor conocido o `FX_FALLBACK` |

Las caídas de Redis y MongoDB se prueban de verdad, no con dobles: `server/test/adapters/outages.test.js` pone un intermediario TCP entre la API y el servicio real y lo corta a mitad de la prueba (corre en el CI, que tiene Redis y MongoDB). Lo que pasa en la app está en `tests/application/backupAndNetwork.test.js`.

## Qué medimos

`npm run bench:fx` mide la latencia de `/api/fx` sin caché, con caché en memoria y con Redis; los resultados y la conclusión están en [MEDICIONES.md](MEDICIONES.md).

`npm run bench` mide la precisión del lector por campo, el tiempo de lectura por correo, el tiempo de ingesta en SQLite, el tiempo del resumen mensual y el costo de descartar duplicados. Con `node scripts/bench-parser.mjs 10000` se ve el comportamiento al escalar.
