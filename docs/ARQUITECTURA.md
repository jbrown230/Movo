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

Es una API Express con cuatro rutas:

- `GET /api/config` entrega el client id de Google y dice si hay respaldo.
- `GET /api/fx` entrega el tipo de cambio del BCCR, cacheado en Redis.
- `POST /api/sync` sincroniza el respaldo por usuario.
- `DELETE /api/me` borra los datos del usuario.

En producción, Caddy sirve la app compilada (`web/dist`) con HTTPS automático, sin pasar por Node, y reenvía `/api` a la API.

### Service worker

`web/public/sw.js` hace que la app abra sin Internet: guarda las páginas y los archivos de la app la primera vez que se piden. Nunca guarda `/api` ni lo de Google.

## Decisión: leer Gmail desde el teléfono y no con un worker en el servidor

La propuesta inicial contemplaba un worker en el servidor con un stream de Redis. Lo cambiamos por estas razones:

- Privacidad: el servidor nunca guarda tokens de larga duración ni ve correos.
- Costo: con N usuarios, la carga de leer y analizar correos se reparte en N teléfonos.
- Simplicidad: no hay colas ni workers que mantener en el VPS.

El costo es que la lectura ocurre solo con la app abierta, porque el token dura una hora. Lo aceptamos para el MVP; la lectura en segundo plano queda en el roadmap.

## Modelo de datos local (SQLite)

`tx` guarda cada movimiento:

- Los montos van en céntimos (`amount_cents`, `crc_cents`), sin decimales flotantes.
- También guarda moneda, tipo de cambio usado, comercio o persona, categoría y su origen, y tipo: `sinpe`, `tarjeta`, `transferencia` o `efectivo`.
- `dir` indica la dirección: `out` es gasto e `in` es ingreso.
- `updated_at`, `deleted` y `dirty` sirven para la sincronización.

`mail` guarda el correo leído: `message_id` con índice único, cuerpo, estado (`registrado`, `sin_movimiento`, `negada` o `descartado`), la plantilla usada y una nota con el resultado. Un correo puede producir varios movimientos (tabla de tarjeta del BCR); el id de cada uno se deriva del Message-ID y la posición de la fila.

En el código, las filas se traducen a entidades con nombres claros (por ejemplo `crc_cents` es `crcCents` y `who` es `counterparty`): ver `infrastructure/sqlite/*Repository.js` y los tipos en `domain/types.js`. Los nombres de las columnas no cambian, para no romper las bases ya guardadas.

`rule` guarda las reglas de categoría del usuario. `setting` guarda los ajustes que se sincronizan (presupuesto, búsqueda de Gmail). `meta` guarda estado solo local: cursores y caché del tipo de cambio.

El id de un movimiento leído de un correo se deriva del Message-ID (`'m' + hash`). Así, dos teléfonos del mismo usuario que leen el mismo correo generan el mismo id, y el respaldo no duplica.

## Modelo en MongoDB

Una colección `records` con documentos de la forma `{ userId, kind, id, updatedAt, srvAt, deleted, data }`, donde `kind` es `tx`, `rule` o `setting`. Tiene dos índices: uno único en `{userId, kind, id}` y otro en `{userId, srvAt}` para el pull incremental. `data` es flexible y conserva campos distintos según el tipo y el banco.

## Sincronización

1. El teléfono envía lo marcado como `dirty` (máximo 500 registros por solicitud) junto con su cursor `since`.
2. El servidor valida cada campo con una lista blanca y escribe con "gana el más reciente": solo reemplaza si `updatedAt` es mayor.
3. El servidor responde con lo que cambió para ese usuario después del cursor, y un cursor nuevo (`srvAt`).
4. El teléfono aplica esos cambios con la misma regla y guarda el cursor.

## Separación por usuario

En el teléfono, cada cuenta de Google tiene su propio archivo SQLite en IndexedDB, y el modo demo tiene otro.

En el servidor, el usuario sale únicamente del token de Google, validado contra Google y con verificación de que pertenece a esta app (`aud`). Todas las consultas a MongoDB incluyen `userId`. Las pruebas `los datos quedan separados por usuario` y la de MongoDB lo verifican.

## Escenarios de falla

| Escenario | Qué pasa |
|---|---|
| Redis se cae | La caché pasa a memoria del proceso; todo sigue funcionando, con más consultas a Google y al BCCR |
| MongoDB no responde | `/api/sync` responde 503; la app sigue con SQLite y reintenta después |
| Sin Internet | La PWA abre desde el service worker; se puede registrar efectivo y ver todo lo leído |
| Correo con formato desconocido | Queda como "Sin movimiento", visible en la bandeja, y se puede registrar a mano; se relee solo cuando sube `PARSER_VERSION` |
| Transacción negada por el banco | No se registra; el correo queda como "Negada por el banco" con el detalle |
| Vence el token de Google | La app muestra "Reconectar Gmail"; la reconexión es silenciosa si la sesión de Google sigue activa |
| BCCR no responde | Se usa el último valor conocido o `FX_FALLBACK` |

## Qué medimos

`npm run bench` mide la precisión del lector por campo, el tiempo de lectura por correo, el tiempo de ingesta en SQLite, el tiempo del resumen mensual y el costo de descartar duplicados. Con `node scripts/bench-parser.mjs 10000` se ve el comportamiento al escalar.
