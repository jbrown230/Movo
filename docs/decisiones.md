# Decisiones técnicas

Las decisiones que dan forma a Movo, reunidas en un solo lugar: qué se decidió, qué alternativas había y por qué. Salen de [`ARQUITECTURA.md`](ARQUITECTURA.md), [`MEDICIONES.md`](MEDICIONES.md) y la sección 6 de cada bitácora ([S1](seguimientos/S1.md), [S2](seguimientos/S2.md), [S3](seguimientos/S3.md) y [S4](seguimientos/S4.md)). Cuando una decisión tiene más detalle, se enlaza su fuente.

| # | Decisión | Área | Seguimiento |
|---|---|---|---|
| 1 | El teléfono hace el trabajo; el servidor es opcional | Arquitectura | S1 |
| 2 | Leer Gmail desde el teléfono, no con un worker en el servidor | Arquitectura | S1 |
| 3 | SQLite en el navegador como motor principal, una base por usuario | SQLite | S1 |
| 4 | Montos en céntimos enteros | SQLite | S1 |
| 5 | Lectura idempotente: el id sale del Message-ID | SQLite, lector | S1 |
| 6 | Redis solo para datos efímeros, con caché de respaldo en memoria | Redis | S1 |
| 7 | Mantener Redis aunque una caché en memoria rinde igual | Redis | S2 |
| 8 | MongoDB solo como respaldo opcional | MongoDB | S1 |
| 9 | Un documento por registro, con el contenido embebido | MongoDB | S1 |
| 10 | Validar dos veces: en la API y con `$jsonSchema` | MongoDB | S2 |
| 11 | Conflictos: gana la última escritura, registro por registro | Sincronización | S2 |
| 12 | La marca de tiempo de un movimiento leído es la fecha de la compra | Sincronización | S2 |
| 13 | Si un motor del servidor cae, la app sigue con SQLite | Fallos | S2 |
| 14 | Un correo solo se lee si coincide con una plantilla oficial | Lector | S1 |
| 15 | Una moneda desconocida no se cuenta como colones | Lector | S3 |
| 16 | Banco Popular: no leer los avisos de movimiento en la cuenta | Lector | S3 |
| 17 | Releer el historial cuando cambia la búsqueda de Gmail | Lector | S4 |
| 18 | Tipo de cambio del día de la compra | Tipo de cambio | S2 |
| 19 | El córdoba se convierte pasando por el dólar, con la tasa del BCN | Tipo de cambio | S3 |
| 20 | Excel con ExcelJS, cargado solo al exportar | Funciones | S3 |
| 21 | Exportación protegida contra fórmulas | Funciones | S2 |
| 22 | Movimientos en su propia pestaña | Funciones | S2, S3 |
| 23 | Metas: lo ahorrado es lo que entra menos lo que se gasta | Funciones | S3 |
| 24 | Alertas de presupuesto con el porcentaje redondeado hacia abajo | Funciones | S3 |
| 25 | Las reglas se hacen cumplir con pruebas, no con disciplina | Calidad | S1 |
| 26 | Sin datos reales ni infraestructura en el repositorio | Privacidad | S1, S4 |
| 27 | El landing es un sitio aparte, en otro hostname | Despliegue | S4 |
| 28 | Se mantienen los tres índices de SQLite | SQLite | Entrega final |
| 29 | Límite por minuto con ventana deslizante en un sorted set | Redis | Entrega final |
| 30 | Resumen del respaldo en un hash, invalidado al cambiar el respaldo | Redis, MongoDB | Entrega final |
| 31 | El resumen del respaldo lo calcula MongoDB con un aggregation pipeline | MongoDB | Entrega final |

## Arquitectura

### 1. El teléfono hace el trabajo; el servidor es opcional

- **Qué se decidió.** La lectura de correos, el análisis, la categorización y los totales ocurren en el teléfono. Sin servidor, el modo demo y el registro manual funcionan igual.
- **Por qué.** Movo es código abierto y cualquiera debería poder alojarlo: tiene que servir a muchos usuarios con un servidor pequeño y barato.
- **Costo.** La lógica pesada vive en la app, así que el teléfono necesita su propia base de datos (decisión 3).
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Principio: el teléfono hace el trabajo".

### 2. Leer Gmail desde el teléfono, no con un worker en el servidor

- **Qué se decidió.** El teléfono lee Gmail con permiso de solo lectura, limitado a los remitentes de los bancos.
- **Alternativa descartada.** La propuesta inicial: un worker en el servidor que leyera los correos con un stream de Redis.
- **Por qué.** Privacidad (el servidor nunca ve correos ni guarda tokens de larga duración), costo (la carga se reparte entre los teléfonos) y simplicidad (no hay colas ni workers que mantener en el VPS).
- **Costo.** Solo se lee con la app abierta, porque el token dura una hora. La lectura en segundo plano queda en la hoja de ruta.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Decisión: leer Gmail desde el teléfono".

## SQLite

### 3. SQLite en el navegador como motor principal, una base por usuario

- **Qué se decidió.** sql.js (SQLite compilado a WebAssembly), con la base guardada en IndexedDB. Cada cuenta de Google tiene su propio archivo, y el modo demo otro.
- **Por qué.** Consecuencia de la decisión 1: la app guarda y consulta todo en el teléfono, con SQL real (índices, transacciones y migraciones), y funciona sin conexión.
- **Costo.** La base corre en memoria y se guarda completa en IndexedDB: no tiene archivo en disco ni modo WAL, y el respaldo con `.backup` no aplica tal cual (S3, tareas por motor).
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Modelo de datos local" y "Separación por usuario".

### 4. Montos en céntimos enteros

- **Qué se decidió.** Todos los montos se guardan como enteros en céntimos (`amount_cents`, `amount_crc_cents`).
- **Por qué.** Evita los errores de redondeo de los números de punto flotante al sumar dinero.

### 5. Lectura idempotente: el id sale del Message-ID

- **Qué se decidió.** El id de un movimiento leído de un correo se deriva del Message-ID (`'m' + hash`), y `mails_by_message_id` es un índice único.
- **Por qué.** Volver a leer el mismo correo no lo duplica, y dos teléfonos de la misma persona generan el mismo id, así que el respaldo tampoco duplica.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Modelo de datos local".

## Redis

### 6. Redis solo para datos efímeros, con caché de respaldo en memoria

- **Qué se decidió.** Redis guarda solo lo que se puede reconstruir: el tipo de cambio, los tokens ya validados (un resumen, nunca el token), el límite de solicitudes y, desde la entrega final, el resumen del respaldo. Si Redis no está o se cae, las mismas claves pasan a la memoria del proceso.
- **Por qué.** Ningún dato de los movimientos depende de Redis, así que una caída no puede perder nada: la API sigue respondiendo y solo se pierde la caché al reiniciar.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Claves en Redis".

### 7. Mantener Redis aunque una caché en memoria rinde igual

- **Qué se decidió.** Se mantiene Redis como caché principal.
- **Alternativa.** Usar solo la caché en memoria del proceso.
- **Por qué.** La medición mostró que por latencia no hace falta Redis: sin caché la mediana es de 694 ms, con Redis de 2,0 ms y con memoria de 0,8 ms. Pero Redis sobrevive a los reinicios, se comparte entre procesos y cuenta el límite de solicitudes en un solo lugar, a bajo costo.
- **Fuente.** [`MEDICIONES.md`](MEDICIONES.md).

## MongoDB y sincronización

### 8. MongoDB solo como respaldo opcional

- **Qué se decidió.** MongoDB guarda una copia por usuario de los movimientos, las reglas, los ajustes y las metas. Está apagado salvo que se active con `CLOUD_SYNC=true`, y cada persona decide si enciende el respaldo.
- **Por qué.** El teléfono es la fuente de la verdad (decisión 1). El respaldo sirve para usar varios teléfonos o no perder datos, y los correos nunca se suben.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Modelo en MongoDB" y "Sincronización".

### 9. Un documento por registro, con el contenido embebido

- **Qué se decidió.** Cada movimiento, regla o ajuste es un documento propio, con el contenido en `data` y la persona en `userId`.
- **Alternativas descartadas.** Un documento por persona con todos sus movimientos en un arreglo (crece sin límite y no permite pedir "lo que cambió después del cursor" con un índice). Colecciones separadas con referencias y `$lookup` (el servidor nunca cruza datos).
- **Por qué.** "Gana el más reciente" en una sola operación atómica, sincronización incremental con el índice `{ userId, serverSequence }`, borrado por persona con un `deleteMany`, y un tipo de registro nuevo no exige otra colección.
- **Costo.** `userId` y `kind` se repiten en cada documento y la forma de `data` cambia según el tipo (por eso la decisión 10).
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Decisión: un documento por registro".

### 10. Validar dos veces: en la API y con `$jsonSchema`

- **Qué se decidió.** La capa HTTP limpia cada campo con una lista blanca (`shared/backupContract.js`), y la colección tiene un validador `$jsonSchema` que exige la envoltura completa y la forma de `data` según el tipo.
- **Por qué.** MongoDB rechaza un documento mal formado aunque se escriba sin pasar por la API.
- **Fuente.** [S2](seguimientos/S2.md), tareas por motor; [`PRUEBAS.md`](PRUEBAS.md), "Datos inválidos".

### 11. Conflictos: gana la última escritura, registro por registro

- **Qué se decidió.** Si dos teléfonos cambian lo mismo, queda el cambio con el `updatedAt` mayor, sincronice primero quien sincronice. En un empate exacto se queda lo que llegó primero al servidor y el otro teléfono adopta esa versión.
- **Por qué.** Es una regla simple de explicar y de probar, que deja los dos teléfonos iguales. El empate se agregó porque la prueba encontró que dos cambios en el mismo milisegundo dejaban los teléfonos distintos para siempre.
- **Límites aceptados.** Se compara el registro completo, no cada campo; manda el reloj del teléfono; y como eliminar es un borrado lógico, un cambio posterior en otro teléfono hace volver el movimiento.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Conflictos entre teléfonos".

### 12. La marca de tiempo de un movimiento leído es la fecha de la compra

- **Qué se decidió.** Un movimiento creado al leer un correo lleva como `updatedAt` la fecha de la compra, nunca más que la hora actual.
- **Alternativa descartada.** La hora de lectura, que era lo que se usaba antes.
- **Por qué.** Con la hora de lectura, un teléfono limpio que releía Gmail antes de encender el respaldo pisaba las ediciones guardadas en el servidor. Con la fecha de la compra, releer el mismo correo da la misma marca y cualquier edición, que siempre es posterior, le gana.
- **Fuente.** [S2](seguimientos/S2.md), decisiones.

### 13. Si un motor del servidor cae, la app sigue con SQLite

- **Qué se decidió.** Si Redis cae, la caché pasa a la memoria. Si MongoDB cae, el respaldo responde 503 "Respaldo no disponible por ahora." y se reconecta solo; la app sigue con SQLite y guarda los cambios para después.
- **Alternativa descartada.** Lo que pasaba antes: 500 "Error interno." y, si MongoDB estaba caído al arrancar, la API no se recuperaba sin reiniciarla.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Escenarios de falla".

## Lector de notificaciones

### 14. Un correo solo se lee si coincide con una plantilla oficial

- **Qué se decidió.** Cada banco tiene plantillas escritas con correos reales. Un correo que no coincide queda como "Sin movimiento", visible en la bandeja y registrable a mano; cuando el lector mejora, la app vuelve a leer esos correos.
- **Alternativa descartada.** Un lector genérico por etiquetas para cualquier correo con un monto.
- **Por qué.** La publicidad de los bancos trae montos, y el lector genérico la registraba como gasto.
- **Fuente.** [`CHANGELOG.md`](../CHANGELOG.md), v0.1.0.

### 15. Una moneda desconocida no se cuenta como colones

- **Qué se decidió.** En las tarjetas del BCR, una moneda que Movo no sabe convertir hace que esa fila no se lea y el correo quede como "Sin movimiento".
- **Por qué.** Antes cualquier moneda no reconocida se leía como colones, y 300 córdobas quedaban como ₡300. Los lectores de BAC, BN y Davivienda todavía no lo hacen.
- **Fuente.** [S3](seguimientos/S3.md), decisiones.

### 16. Banco Popular: no leer los avisos de movimiento en la cuenta

- **Qué se decidió.** De Banco Popular se leen la compra con tarjeta y el comprobante de SINPE; los avisos de movimiento en la cuenta y los de débito en tiempo real se ignoran.
- **Por qué.** Esos avisos repiten el mismo dinero que ya trae la compra o el SINPE, y se contaría dos veces.
- **Fuente.** [S3](seguimientos/S3.md), decisiones.

### 17. Releer el historial cuando cambia la búsqueda de Gmail

- **Qué se decidió.** La app anota con qué búsqueda hizo cada lectura (`last_scan_query`). Si cambia, vuelve a revisar los últimos 45 días; los correos ya leídos no se descargan otra vez.
- **Por qué.** Cuando una versión agregaba un banco a la búsqueda, los teléfonos que ya habían leído antes nunca pedían los correos viejos de ese banco.
- **Fuente.** [S4](seguimientos/S4.md), decisiones.

## Tipo de cambio

### 18. Tipo de cambio del día de la compra

- **Qué se decidió.** Cada compra en dólares, euros o córdobas se convierte con el tipo de cambio del día en que se hizo. El servidor devuelve el de cada uno de los últimos 60 días y la app corrige las compras de esos días cuando llega.
- **Alternativa descartada.** El tipo de cambio del día en que se leyó el correo.
- **Por qué.** Un correo leído días después quedaba con un monto en colones distinto al real.
- **Fuente.** [S2](seguimientos/S2.md), decisiones.

### 19. El córdoba se convierte pasando por el dólar, con la tasa del BCN

- **Qué se decidió.** Colones por dólar del BCCR entre los córdobas por dólar de cada día, leídos del servicio web del Banco Central de Nicaragua. Si no responde, se usa la tasa oficial fija de 2026 (`NIO_PER_USD`).
- **Alternativa descartada.** Un servicio público de mercado (ExchangeRate-API): más fácil de llamar, pero ~0,5 % por encima de la tasa oficial y sin historial por día.
- **Costo.** El BCN solo acepta TLS 1.0. Se permite únicamente para esa conexión, con el certificado verificado y descartando valores fuera de 20–100 córdobas por dólar.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Decisión: el córdoba se lee del servicio web del Banco Central de Nicaragua".

## Funciones de la app

### 20. Excel con ExcelJS, cargado solo al exportar

- **Qué se decidió.** El reporte principal es un .xlsx con el diseño de Movo, dibujado con ExcelJS. Se importa en el momento de exportar, así que queda en una pieza aparte y la app no cambia de peso. El CSV sigue como segunda opción.
- **Alternativas descartadas.** Armar el .xlsx a mano (no daba para ese nivel de diseño), un PDF (jsPDF pesa más y no se puede editar) y solo CSV (no admite diseño).
- **Costo.** ExcelJS pesa unos 938 KB, y la primera exportación necesita conexión.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Decisión: el Excel se dibuja con ExcelJS".

### 21. Exportación protegida contra fórmulas

- **Qué se decidió.** En el CSV, un texto que empieza con `=`, `+`, `-` o `@` se escribe con un apóstrofo delante; en el Excel, el comercio siempre es texto.
- **Por qué.** El nombre de un comercio viene de un correo, y no debe ejecutarse como fórmula al abrir el archivo.
- **Fuente.** [S2](seguimientos/S2.md), decisiones.

### 22. Movimientos en su propia pestaña

- **Qué se decidió.** Los movimientos tienen su propia pestaña, con búsqueda en SQLite y una hoja de filtros; el inicio muestra los últimos 5.
- **Historia.** En S2 el equipo prefirió los filtros sobre la lista del inicio, por ser más claro. En S3 se retomó la pestaña propia, cuando se sumaron la búsqueda de texto y la exportación con los mismos filtros.
- **Fuente.** [S2](seguimientos/S2.md) y [S3](seguimientos/S3.md), decisiones.

### 23. Metas: lo ahorrado es lo que entra menos lo que se gasta

- **Qué se decidió.** Desde el mes en que se crea la meta hasta su fecha límite, sin contar los movimientos entre cuentas propias.
- **Por qué.** Mover dinero entre cuentas propias no es ahorrar ni gastar.
- **Fuente.** [S3](seguimientos/S3.md), decisiones.

### 24. Alertas de presupuesto con el porcentaje redondeado hacia abajo

- **Qué se decidió.** El porcentaje gastado se redondea hacia abajo antes de compararlo con el umbral.
- **Por qué.** Así el 79,9 % no avisa del 80 % ni el 99,9 % del 100 %.
- **Fuente.** [S3](seguimientos/S3.md), decisiones.

## Calidad, privacidad y despliegue

### 25. Las reglas se hacen cumplir con pruebas, no con disciplina

- **Qué se decidió.** Capas separadas en la app y en el servidor, vigiladas por `tests/architecture`; la app y el servidor solo comparten el contrato (`shared/backupContract.js`), vigilado por `tests/contract`; ESLint limita el tamaño y la complejidad de las funciones y Prettier deja un solo estilo. Todo corre en el CI.
- **Por qué.** Que las reglas de la arquitectura no dependan de la disciplina de nadie: un cambio que las rompe no pasa el CI.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Cómo se hacen cumplir las reglas".

### 26. Sin datos reales ni infraestructura en el repositorio

- **Qué se decidió.** Todo correo de ejemplo se anonimiza (nombres, teléfonos, tarjetas, referencias y comercios ficticios), y `tests/privacy` falla si aparece un dato real, un secreto o, desde S4, la IP de un servidor o un hostname de sslip.io o nip.io.
- **Por qué.** El repositorio es público y las plantillas se escriben a partir de correos reales.
- **Fuente.** [`CONTRIBUIR.md`](CONTRIBUIR.md) y [S4](seguimientos/S4.md), decisiones.

### 27. El landing es un sitio aparte, en otro hostname

- **Qué se decidió.** El landing (`landing/`) no comparte código con la app y se sirve en `movocr.xyz`; la app, en `app.movocr.xyz`, desde el mismo Nginx del VPS.
- **Por qué.** La app no carga Three.js ni las animaciones del landing, cada uno se compila y se publica por su cuenta, y la app conserva su propio origen para el inicio de sesión de Google y el service worker.
- **Fuente.** [S4](seguimientos/S4.md), decisiones.

## Tareas por motor (entrega final)

### 28. Se mantienen los tres índices de SQLite

- **Qué se decidió.** Se conservan `transactions_by_date`, `transactions_by_mail_key` y `mails_by_message_id`.
- **Alternativa.** Quitar alguno para escribir más rápido.
- **Por qué.** `EXPLAIN QUERY PLAN` muestra que cada uno lo usa al menos una consulta frecuente. Con 10.000 movimientos, sin ellos las consultas son de 2 a 200 veces más lentas. Además, leer un correo es casi 7 veces más lento sin índices: antes de guardar hay que saber si el correo ya se leyó, y esa búsqueda recorre toda la tabla `mails`.
- **Fuente.** [`MEDICIONES.md`](MEDICIONES.md), "SQLite".

### 29. Límite por minuto con ventana deslizante en un sorted set

- **Qué se decidió.** El límite de solicitudes guarda cada solicitud en un sorted set de Redis, con su hora como puntaje, y cuenta las de los últimos 60 segundos.
- **Alternativa descartada.** El contador con `INCR` en una clave por minuto del reloj, que era lo que había.
- **Por qué.** Con la ventana fija, alguien podía hacer el doble del límite en dos segundos, entre el final de un minuto y el inicio del siguiente.
- **Costo.** Un miembro por solicitud en vez de un número: como máximo el límite (60 por persona) más las rechazadas de ese minuto.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Límite por minuto: ventana deslizante".

### 30. Resumen del respaldo en un hash, invalidado al cambiar el respaldo

- **Qué se decidió.** El resumen del respaldo se guarda en Redis como un hash, con un campo por tipo de registro. `syncBackup` lo borra cuando guarda algún cambio y `deleteUserBackup` cuando vacía el respaldo.
- **Alternativas.** Un string con el JSON (no deja ver ni cambiar un campo suelto). Esperar a que venza, como el tipo de cambio.
- **Por qué.** El resumen cambia cada vez que la persona sincroniza, y uno viejo sería un dato falso. El vencimiento de una hora queda solo como red de seguridad. Con el hash en Redis, el resumen tarda 0,41 ms; sin caché, 3,24 ms.
- **Fuente.** [`ARQUITECTURA.md`](ARQUITECTURA.md), "Invalidación de la caché", y [`MEDICIONES.md`](MEDICIONES.md), "El resumen con y sin Redis".

### 31. El resumen del respaldo lo calcula MongoDB con un aggregation pipeline

- **Qué se decidió.** `GET /api/backup/summary` corre un pipeline `$match` por `userId` → `$group` por `kind` → `$project` → `$sort`, que devuelve una fila por tipo.
- **Alternativa descartada.** Traer los documentos de la persona y contarlos en Node.
- **Por qué.** MongoDB agrupa sin mandar los documentos por la red y devuelve tres o cuatro filas. Al ir el `$match` primero, `explain()` muestra que usa el índice y lee solo los documentos de esa persona: 1,6 ms con índice y 33 ms recorriendo los 100.000 documentos de la medición.
- **Fuente.** [`MEDICIONES.md`](MEDICIONES.md), "MongoDB".
