# API de Movo

La API (`server/`) es pequeña y **opcional**: la app funciona sin ella (modo demo, lectura de correos y todo lo local). Sirve para tres cosas: decir cómo está configurado el servidor, dar el tipo de cambio y guardar un respaldo en la nube.

Todas las rutas empiezan con `/api`, responden JSON y nunca se guardan en caché (`Cache-Control: no-store`).

Los nombres y los valores permitidos viven en un solo archivo que usan la app y el servidor: [`shared/backupContract.js`](../shared/backupContract.js). Si cambias algo ahí, actualiza este documento; las pruebas de `tests/contract` fallan si la app y el servidor dejan de entenderse.

## Resumen

| Método y ruta | Necesita token | Qué hace |
|---|---|---|
| `GET /api/health` | No | Estado del servidor, para monitoreo |
| `GET /api/config` | No | Cómo está configurado el servidor |
| `GET /api/fx` | No | Tipo de cambio del dólar |
| `POST /api/sync` | Sí | Sincroniza el respaldo de la persona |
| `DELETE /api/me` | Sí | Borra todo el respaldo de la persona |

**Token:** es el token de acceso de Google que ya tiene la app. Se envía así: `Authorization: Bearer <token>`. El servidor lo valida una sola vez con Google y guarda el resultado en la caché hasta que venza. No hay contraseñas ni sesiones propias.

## Errores

Todos los errores tienen la forma `{ "error": "Mensaje en español" }`.

| Código | Cuándo |
|---|---|
| 400 | La petición está mal formada (cuerpo, ids, listas, demasiados cambios, JSON roto) |
| 401 | Falta el token, es inválido o vencido, o es de otra aplicación |
| 404 | La ruta no existe, o el respaldo está apagado en este servidor |
| 413 | El cuerpo pasa de 1 MB |
| 429 | Demasiadas solicitudes en un minuto (por persona, o por dirección IP en `/api/fx`) |
| 503 | No se pudo consultar a Google, o MongoDB no responde |
| 500 | Error inesperado (el detalle no se muestra) |

## `GET /api/health`

```json
{ "ok": true, "redis": true, "mongo": true }
```

`redis` dice si Redis responde (si no, se usa memoria del proceso). `mongo` es `null` si el respaldo está apagado.

## `GET /api/config`

```json
{ "googleClientId": "123-abc.apps.googleusercontent.com", "cloudSync": true }
```

`googleClientId` es `null` si el servidor no tiene inicio de sesión con Google. `cloudSync` dice si el respaldo está disponible; la app oculta toda la sección de respaldo y no sincroniza cuando es `false`.

## `GET /api/fx`

```json
{ "rate": 505.55, "date": "2026-01-15", "source": "BCCR, tipo de cambio de venta" }
```

Se consulta al BCCR como máximo cada 6 horas. Si el BCCR no está configurado o falla, se devuelve el último valor conocido o el valor de referencia (`FX_FALLBACK`), con `"date": null`.

## `POST /api/sync`

Sube los cambios del teléfono y baja lo que cambió desde la última vez.

**Petición** (`SyncRequest`):

```json
{
  "since": 0,
  "changes": {
    "transactions": [],
    "categoryRules": [],
    "settings": []
  }
}
```

- `since`: el cursor que devolvió el servidor la vez anterior (`0` la primera vez).
- `changes`: tres listas, todas opcionales. Máximo **500 registros** en total.

**Respuesta** (`SyncResponse`):

```json
{
  "cursor": 1767000000000123,
  "hasMore": false,
  "changes": { "transactions": [], "categoryRules": [], "settings": [] }
}
```

- `cursor`: se usa como `since` en la próxima petición.
- `hasMore`: si es `true`, hay más cambios: se pide otra vez con el nuevo cursor.
- `changes`: lo que cambió después de `since` (hasta **1000 registros** por respuesta).

### Un registro

Los tres tipos tienen la misma envoltura:

```json
{ "id": "m1abc", "updatedAt": 1767000000000, "isDeleted": false, "data": {} }
```

| Campo | Significado |
|---|---|
| `id` | Id del movimiento o de la regla, o nombre del ajuste |
| `updatedAt` | Milisegundos. **Gana el más reciente**: un cambio solo reemplaza al guardado si su `updatedAt` es mayor |
| `isDeleted` | Borrado lógico: el registro queda marcado para que los demás teléfonos también lo borren |
| `data` | El contenido, según el tipo |

### `data` de un movimiento (`transactions`)

Los mismos nombres que la entidad `Transaction` de la app.

| Campo | Tipo | Valores permitidos |
|---|---|---|
| `date` | texto ISO | máximo 40 caracteres |
| `amountCents` | entero | monto original en céntimos |
| `currency` | texto | `CRC`, `USD` (otro valor se cambia por `CRC`) |
| `crcCents` | entero | monto en colones, en céntimos |
| `exchangeRate` | número o `null` | tipo de cambio usado |
| `counterparty` | texto | comercio o persona, máximo 120 |
| `category` | texto | máximo 30 (por defecto `otros`) |
| `categoryOrigin` | texto o `null` | quién decidió la categoría |
| `type` | texto | `sinpe`, `tarjeta`, `transferencia`, `efectivo` (otro valor se cambia por `transferencia`) |
| `direction` | texto | `out` gasto, `in` ingreso, `self` entre mis cuentas (otro valor se cambia por `out`) |
| `bank` | texto o `null` | máximo 20 |
| `mailKey` | texto o `null` | Message-ID del correo de origen |
| `note` | texto o `null` | máximo 300 |

### `data` de una regla de categoría (`categoryRules`)

```json
{ "counterpartyKey": "NETFLIX.COM", "category": "ocio" }
```

### `data` de un ajuste (`settings`)

```json
{ "value": 40000000 }
```

Solo se sincronizan los ajustes `budget` y `gmail_query`. El `id` es el nombre del ajuste. Cualquier otro se ignora sin dar error.

### Qué valida el servidor

El servidor **no confía** en lo que llega: solo acepta los campos de arriba (el resto se descarta), recorta los textos al máximo, reemplaza los valores fuera de lo permitido por uno seguro y rechaza con `400` ids que no cumplan `^[A-Za-z0-9_\- .*:@]{1,120}$`, listas que no sean listas, `updatedAt` inválido o más de 500 cambios.

## `DELETE /api/me`

Borra todo lo que el servidor guarda de la persona del token. No toca lo que hay en el teléfono.

```json
{ "deleted": 42 }
```

`deleted` es cuántos registros se eliminaron.

## Cómo se guardan los datos en el servidor

En MongoDB, una colección `backup_records`:

```json
{
  "userId": "id de Google",
  "kind": "transaction",
  "id": "m1abc",
  "updatedAt": 1767000000000,
  "serverSequence": 1767000000000123,
  "isDeleted": false,
  "data": {}
}
```

- `kind` es `transaction`, `category_rule` o `setting`.
- `serverSequence` es el número creciente que se usa de cursor.
- Toda consulta lleva `userId` en el filtro: los datos de cada persona están separados.
- Índices: único en `{ userId, kind, id }` y otro en `{ userId, serverSequence }`.

## Cómo se prueba

- `tests/contract/backupContract.test.js`: dos teléfonos simulados se sincronizan a través del código real del servidor.
- `server/test/adapters/http.api.test.js`: la API completa con peticiones HTTP.
- `server/test/adapters/backupStore.contract.test.js`: la misma batería contra el almacén en memoria y contra MongoDB real.
