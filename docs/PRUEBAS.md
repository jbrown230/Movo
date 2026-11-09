# Pruebas

Movo tiene 346 pruebas automáticas que corren en el CI en cada pull request. Este documento las agrupa en los tres casos que pide el enunciado: **caso normal**, **error de conexión** y **datos inválidos**. Para cada uno dice en qué archivo están las pruebas y qué comprueban.

## Cómo correrlas

```bash
npm test               # todo: núcleo, interfaz y servidor
npm run test:core      # dominio, aplicación, contrato, infraestructura, arquitectura y privacidad (node --test)
npm run test:ui        # interfaz (Vitest con un navegador simulado)
npm --prefix server test
npm run check          # lint, formato, pruebas y compilación: lo mismo que corre el CI
```

| Grupo | Carpeta | Pruebas | Con qué corre |
|---|---|---|---|
| Núcleo de la app | `tests/` (sin `presentation`) | 235 | `node --test`, con SQLite real (sql.js) y el servidor y Gmail simulados |
| Interfaz | `tests/presentation/` | 35 | Vitest y Testing Library sobre la app completa |
| Servidor | `server/test/` | 76 | `node --test`, con los casos de uso reales y Redis, MongoDB y Google simulados |

Las pruebas que usan **Redis y MongoDB de verdad** corren solo si existen `REDIS_URL` y `MONGO_URL`. El CI (`.github/workflows/ci.yml`) los levanta como servicios (`redis:7-alpine` y `mongo:7`), así que en cada pull request corren todas. En local, `docker compose up -d redis mongo` y esas dos variables las activan; sin ellas, esos grupos se saltan y avisan por qué.

La base SQLite de las pruebas es real: `tests/helpers/createTestApp.js` arma la app completa sobre una base de sql.js en memoria, con los mismos casos de uso que usa el teléfono.

## 1. Caso normal

El flujo principal de punta a punta, y cada caso de uso con datos correctos.

| Qué se prueba | Archivo | Qué comprueba |
|---|---|---|
| Leer un correo y registrar el movimiento | `tests/application/ingestMail.test.js` | El mismo correo no se registra dos veces; dos teléfonos generan el mismo id para el mismo correo; una compra en dólares se convierte; una tabla con varias transacciones registra las aprobadas; el resumen del mes separa gastos e ingresos; la base guardada se vuelve a abrir con los mismos datos. |
| Plantillas de cada banco con correos reales anonimizados | `tests/domain/parseMail.test.js`, `davivienda.test.js`, `popular.test.js` y `tests/infrastructure/*Html.test.js` | BCR (SINPE y tarjeta), BN (voucher), BAC (tarjeta y SINPE), Davivienda (débito, crédito, tarjeta y transferencia) y Banco Popular (tarjeta y SINPE), desde el HTML real hasta el movimiento guardado. |
| Buscar correos en Gmail | `tests/application/backupAndNetwork.test.js` | Registra los correos nuevos, recuerda la última búsqueda y no descarga otra vez los ya leídos. Si cambia la búsqueda (un banco nuevo), vuelve a revisar los últimos 45 días. |
| Editar, crear y eliminar movimientos | `tests/application/transactionActions.test.js` | Cambiar la categoría crea una regla y la aplica al mismo comercio; cambiar cómo se cuenta; gasto en efectivo; eliminar un movimiento no lo hace reaparecer al releer el correo. |
| Búsqueda y filtros | `tests/application/searchTransactions.test.js` | Fechas como días completos, categoría, tipo, banco, montos, texto sin distinguir mayúsculas, y filtros combinados. |
| Exportar | `tests/application/exportTransactions.test.js` | El CSV en los dos formatos de Excel y el .xlsx con el diseño de Movo, los totales y los mismos filtros que la lista. |
| Presupuestos y metas | `tests/application/budgetPreferences.test.js`, `savingsGoals.test.js` y `tests/domain/budget.test.js`, `savingsGoals.test.js` | Alertas al 80 % y al 100 %, presupuestos por categoría y avance de las metas de ahorro. |
| Tipo de cambio | `tests/application/backupAndNetwork.test.js` y `server/test/application/getExchangeRate.test.js` | Cada compra en dólares, euros o córdobas se convierte con el tipo de cambio del día en que se hizo; el servidor consulta la fuente una vez y lo demás sale de la caché. |
| Respaldo en MongoDB | `tests/contract/backupContract.test.js` y `server/test/adapters/backupStore.contract.test.js` | Dos teléfonos se sincronizan a través del código real del servidor; reactivar el respaldo después de borrarlo vuelve a subir todo; el almacén guarda, devuelve por cursor y borra solo lo de cada persona, en memoria y en MongoDB real. |
| Conflictos entre teléfonos | `tests/contract/syncConflicts.test.js` | Gana la última escritura por registro, sincronice primero quien sincronice; editar contra eliminar; empate exacto. |
| API HTTP | `server/test/adapters/http.api.test.js` | Configuración, salud, sincronización con token válido y separación por persona. |
| Caché | `server/test/adapters/cache.test.js` | La misma batería en memoria y en Redis real: valores con vencimiento, la ventana deslizante del límite por minuto (sorted set), que olvida las solicitudes viejas, y el hash del resumen, que se reemplaza completo y se invalida al borrarlo. |
| Resumen del respaldo | `server/test/application/getBackupSummary.test.js`, `backupStore.contract.test.js` y `http.api.test.js` | El aggregation pipeline cuenta por tipo y separa los eliminados (en memoria y en MongoDB real); el resumen sale de la caché la segunda vez; sincronizar un cambio o borrar el respaldo lo invalida, y una sincronización sin cambios no. |
| Interfaz | `tests/presentation/app.test.jsx` | Navegación entre pestañas, filtros, confirmaciones (una acción cancelada no se ejecuta), modo demo y Ajustes. |
| Migraciones de SQLite | `tests/infrastructure/schemaMigration.test.js` | Una base nueva queda con todas las tablas; migrar dos veces no hace nada; una base de la versión 1 se actualiza sin perder datos. |

## 2. Error de conexión

Qué pasa cuando un motor o un servicio externo no responde. Las pruebas marcadas con **(real)** cortan la conexión a un Redis o MongoDB de verdad a mitad de la prueba, con un intermediario TCP (`server/test/helpers/tcpProxy.js`).

| Qué falla | Archivo | Qué pasa |
|---|---|---|
| Redis se cae a mitad de ejecución **(real)** | `server/test/adapters/outages.test.js` | La API sigue respondiendo el tipo de cambio, con la caché en la memoria del proceso. |
| Redis no responde desde el inicio | `server/test/adapters/cache.test.js` | Con una dirección que no responde, el servidor sigue funcionando en memoria. |
| Redis cae y vuelve con un resumen guardado | `server/test/adapters/cache.test.js` | Invalidar borra también la copia que quedó en memoria mientras Redis estuvo caído, así no reaparece un resumen viejo. |
| MongoDB se cae a mitad de ejecución **(real)** | `server/test/adapters/outages.test.js` | El respaldo responde 503 "Respaldo no disponible por ahora." en vez de 500. |
| MongoDB caído al arrancar **(real)** | `server/test/adapters/outages.test.js` | El respaldo se recupera solo cuando MongoDB vuelve, sin reiniciar la API. |
| El servidor no responde (desde el teléfono) | `tests/application/backupAndNetwork.test.js` | La app local sigue funcionando y los cambios quedan pendientes para el próximo intento. |
| MongoDB no responde (desde el teléfono) | `tests/application/backupAndNetwork.test.js` | El respaldo falla con el mensaje del servidor, la app sigue leyendo correos y, cuando MongoDB vuelve, sube todo lo pendiente. |
| El BCCR no responde | `server/test/application/getExchangeRate.test.js` y `server/test/adapters/bccrExchangeRateSource.test.js` | Se usa el último valor conocido o el de reserva; si falla solo el euro, se responde el dólar. |
| El servicio del Banco Central de Nicaragua no responde | `server/test/adapters/bccrExchangeRateSource.test.js` y `bcnNioRate.test.js` | Se usa la tasa oficial fija (`NIO_PER_USD`); un mes anterior que falla no impide devolver los demás; sin ninguna fuente no se inventa un tipo de cambio. |
| El teléfono no tiene tipo de cambio del servidor | `tests/application/backupAndNetwork.test.js` | Se usa el de reserva; una compra en euros queda sin convertir y se convierte sola cuando llega el valor. |
| No se puede consultar a Google | `server/test/application/authenticateUser.test.js` | La API avisa que el servicio no está disponible (503), sin confundirlo con un token inválido. |
| El token de Gmail venció | `tests/application/backupAndNetwork.test.js` | La búsqueda falla con un error de autenticación y no se marca como leída. |

La tabla "Escenarios de falla" de [`ARQUITECTURA.md`](ARQUITECTURA.md) resume lo que ve la persona en cada caso.

## 3. Datos inválidos

Lo que llega mal formado, de otra aplicación o con valores fuera de lo permitido.

| Qué llega | Archivo | Qué pasa |
|---|---|---|
| Listas mal formadas, demasiados cambios o un JSON roto | `server/test/adapters/http.api.test.js` | La API responde 400 (nunca 500) y rechaza más registros de los permitidos por solicitud. |
| Campos con valores no permitidos o ids con operadores de MongoDB | `server/test/adapters/http.api.test.js` y `tests/contract/backupContract.test.js` | La API valida y limpia cada campo con una lista blanca; un tipo inventado se corrige a uno válido y la app lo acepta. |
| Documentos mal formados escritos directo en MongoDB **(real)** | `server/test/adapters/backupStore.contract.test.js` | El validador `$jsonSchema` los rechaza aunque no pasen por la API, también en una colección que ya existía sin validador. |
| Una meta de ahorro mal formada | `tests/contract/backupContract.test.js` y `tests/application/savingsGoals.test.js` | El servidor la limpia; en el teléfono no se guarda y explica por qué. |
| Token inválido, vencido o de otra aplicación | `server/test/application/authenticateUser.test.js` y `http.api.test.js` | Se rechaza con 401; el token de otra aplicación también, aunque Google lo reconozca. |
| Demasiadas solicitudes | `server/test/application/authenticateUser.test.js` y `http.api.test.js` | Límite por persona en el último minuto (ventana deslizante); el límite de una persona no afecta a otra. |
| Correos publicitarios, sin plantilla o sin monto | `tests/domain/parseMail.test.js` y `tests/application/ingestMail.test.js` | Quedan como "Sin movimiento" y se pueden ver en la bandeja; la publicidad con montos no se lee como gasto. |
| Compras negadas por el banco | `tests/domain/parseMail.test.js`, `tests/infrastructure/bcrHtml.test.js` y `tests/application/ingestMail.test.js` | No se registran como gasto; en una tabla con varias filas solo se registran las aprobadas. |
| Monedas desconocidas | `tests/domain/parseMail.test.js` | Una moneda que Movo no sabe convertir no se cuenta como colones. |
| Texto vacío, HTML sin estructura o un mensaje de Gmail sin cuerpo | `tests/application/ingestMail.test.js`, `tests/infrastructure/bcrHtml.test.js` y `gmailDecoder.test.js` | La lectura no se rompe. |
| Falla a mitad de guardar un correo | `tests/application/ingestMail.test.js` | La transacción se deshace: no queda nada a medias. |
| Una dirección de movimiento inválida | `tests/application/transactionActions.test.js` | Se rechaza sin cambiar nada. |
| `%` y `_` en la búsqueda de texto | `tests/application/searchTransactions.test.js` | Se buscan como texto, no como comodines de SQL. |
| Un comercio que parece una fórmula | `tests/domain/csv.test.js` y `tests/application/exportTransactions.test.js` | En el CSV se escribe con un apóstrofo delante y en el Excel como texto, para que no se ejecute al abrirlo. |
| Valores dañados en los ajustes | `tests/application/budgetPreferences.test.js` | Un presupuesto dañado se lee como "sin presupuestos" y el umbral solo acepta valores válidos. |
| Tasas del córdoba fuera de rango o respuestas del BCCR sin datos | `server/test/adapters/bcnNioRate.test.js` y `parseBccrResponse.test.js` | Se descartan las tasas fuera de 20–100 córdobas por dólar; una respuesta vacía o rechazada lanza un error claro. |

## Otras pruebas

No entran en los tres casos, pero vigilan reglas del proyecto:

- **Arquitectura** (`tests/architecture/layers.test.js`): falla si una capa importa de otra que no le toca o si la app y el servidor se importan entre sí.
- **Privacidad** (`tests/privacy/noSensitiveData.test.js`): falla si aparece en el repositorio un correo, teléfono, tarjeta, nombre o comercio real, un secreto, o la IP de un servidor.
- **Contrato** (`tests/contract/backupContract.test.js`): los valores permitidos del contrato coinciden con el vocabulario de la app, y el límite del cliente cabe en lo que acepta el servidor.
