# Backlog

Plan de trabajo del equipo. Incluye lo que ya está hecho (para registrarlo como issues cerrados) y lo pendiente, repartido por peso.

Etiquetas: `parser`, `frontend`, `backend`, `tests`, `docs`, `investigación`, `bug`, `infra`.

Peso en puntos: **1** = unas pocas horas, **2** = un día, **3** = varios días.

## Reparto de lo pendiente

Lo ya hecho (issues 1 a 14) lo hizo Jordy y suma 34 puntos. Por eso Jordy lleva menos trabajo pendiente: entre lo hecho y lo que queda, la carga total del equipo queda parecida.

Los bancos se reparten uno por persona, para que nadie cargue con toda la lógica de lectura de comprobantes: **BCR** (Jordy, hecho), **BN** (Dylan), **BAC** (Jose), **Davivienda y Promerica** (Yader).

| Integrante | GitHub | Hecho | Pendiente | Issues pendientes |
|---|---|---|---|---|
| Jordy Palacios | @jbrown230 | 34 pts (issues 1–14, cerrados) | **6 pts** | 15, 16, 17 |
| Dylan Mejía Ruiz | @DylanMR08 | — | **21 pts** | 18, 19, 20, 21, 32, 33, 34, 35, 36, 37, 38 |
| Jose Meza Álvarez | @devJosemeza | — | **11 pts** | 22, 23, 24, 25, 26 |
| Yader Barahona Villarreal | @YaderBarahona | — | **11 pts** | 27, 28, 29, 30, 31 |

Reglas:
- Cada issue se trabaja en una rama `tipo/numero-descripcion` (ej. `feat/18-plantilla-bn`) y entra a `main` por pull request.
- Revisión cruzada: Jordy revisa a Dylan, Dylan a Jose, Jose a Yader y Yader a Jordy.
- Para cada banco, Jordy explica a quien lo tome cómo se escribió la plantilla del BCR (`web/src/domain/emailParser/templates/bcrSinpe.js` y `bcrCard.js`, `tests/fixtures/bcr-html/`): ese es el modelo a seguir.
- Si alguien termina antes, toma un issue de otra persona de acuerdo con ella, sin dejar la carga desigual.

---

## Ya hecho (cerrados) · Jordy Palacios · 34 pts

Estos issues se crean y se cierran de una vez, para que el historial del proyecto muestre el trabajo. Todo esto está en la versión v0.1.0 (ver `CHANGELOG.md`).

| # | Issue | Pts | Etiquetas | Versión |
|---|---|---|---|---|
| 1 | PWA instalable con modo sin conexión, service worker y modo oscuro | 3 | `frontend` | v0.1.0 |
| 2 | SQLite en el navegador (sql.js): una base por usuario e ingesta idempotente por Message-ID | 3 | `frontend` | v0.1.0 |
| 3 | Lectura de Gmail de solo lectura, limitada a remitentes bancarios | 2 | `frontend` | v0.1.0 |
| 4 | Lector de correos base: plantillas sintéticas BAC, BN y BCR | 3 | `parser` | v0.1.0 |
| 5 | Plantillas reales del BCR: SINPE Móvil enviado y recibido, tarjeta, y compras negadas | 3 | `parser` | v0.1.0 |
| 6 | SINPE entre cuentas propias: detección del titular y control "¿Cómo contarlo?" | 2 | `parser`, `frontend` | v0.1.0 |
| 7 | API Node mínima: configuración, validación de token de Google y tipo de cambio del BCCR | 3 | `backend` | v0.1.0 |
| 8 | Redis: caché de tokens y tipo de cambio, y límite de solicitudes, con tolerancia a caída | 2 | `backend` | v0.1.0 |
| 9 | MongoDB: respaldo opcional por usuario y borrado de datos | 2 | `backend` | v0.1.0 |
| 10 | Categorías automáticas, reglas del usuario y presupuesto mensual | 2 | `frontend` | v0.1.0 |
| 11 | Modo demo con simulador de banco y datos sintéticos | 2 | `frontend` | v0.1.0 |
| 12 | Pruebas automáticas, benchmark del lector, dataset sintético y CI en GitHub Actions | 3 | `tests` | v0.1.0 |
| 13 | Despliegue con Docker, Caddy y guía para un VPS | 2 | `infra`, `docs` | v0.1.0 |
| 14 | README, documento de arquitectura, capturas y renombre del proyecto a Movo | 2 | `docs` | v0.1.0 |

---

## Pendiente · Jordy Palacios · 6 pts

### 15. Publicar el release con etiqueta y notas · 2 pts
`docs` · Hito: Publicación
El `CHANGELOG.md` describe la v0.1.0 pero el repositorio no tiene tags ni releases.
- [ ] Crear el tag `v0.1.0` sobre el commit actual de `main`.
- [ ] Publicar el release en GitHub con las notas tomadas del changelog.
- [ ] Verificar que el repositorio es público y que el CI pasa en `main`.
- [ ] Crear las etiquetas e hitos para el resto del equipo.

### 16. Endurecer el servidor ante caídas de Redis y Mongo · 2 pts
`backend`, `tests` · Hito: Publicación
Estado: hecho, issue de GitHub #18 (rama `18-endurecer-el-servidor-ante-caidas-de-redis-y-mongo`). Tomada por Dylan.
- [x] Prueba de que la API responde (sin caché) si Redis se cae a mitad de ejecución (`server/test/adapters/outages.test.js`, con un intermediario TCP que corta la conexión real).
- [x] Prueba de que el respaldo falla con mensaje claro y la app local sigue funcionando si Mongo no responde. La prueba encontró dos fallas que se corrigieron: con Mongo caído a mitad de ejecución el respaldo respondía 500 "Error interno." (ahora 503 "Respaldo no disponible por ahora."), y si Mongo estaba caído al arrancar no se recuperaba sin reiniciar la API (ahora se reconecta solo).
- [x] Registrar los resultados en la tabla de fallas de `docs/ARQUITECTURA.md`.

### 17. Medir el efecto de Redis en el tipo de cambio · 2 pts
`tests`, `investigación` · Hito: Mediciones
Estado: hecho, issue de GitHub #19 (rama `19-medir-el-efecto-de-redis-en-el-tipo-de-cambio`). Tomada por Dylan.
- [x] Comparar latencia de la API con Redis y sin Redis (consulta directa al BCCR). También con la caché en memoria que la API usa cuando no hay Redis (`scripts/bench-fx.mjs`, `npm run bench:fx`).
- [x] Reportar mediana y p95 con al menos 200 solicitudes. Sin caché: 694 / 846 ms; memoria: 0,8 / 1,5 ms; Redis: 2,0 / 2,8 ms. Sin pausas, el BCCR rechazó 181 de 200 consultas (límite de unas 40 por minuto).
- [x] Conclusión escrita en `docs/MEDICIONES.md`: por latencia no hace falta Redis (basta cualquier caché); se mantiene por robustez a bajo costo (sobrevive reinicios, se comparte entre procesos, cuenta el límite en un solo lugar).

---

## Pendiente · Dylan Mejía Ruiz · 21 pts

### 18. Plantilla real de Banco Nacional (BN) · 3 pts
`parser` · Hito: Más bancos
Estado: hecho, issue de GitHub #20 (rama `20-plantilla-real-de-banco-nacional-bn`).
Nota: el Banco Nacional no notifica los SINPE Móvil por correo, así que no hay plantilla real de SINPE para este banco. Lo único que envía por correo es el comprobante de compra con tarjeta, con el asunto "Voucher Digital". El SINPE del BN que aparece en la demo es sintético.
- [x] Descargar con "Mostrar original" notificaciones reales de BN: voucher de una compra con tarjeta (de SINPE no hay).
- [x] Anonimizar (ver `docs/CONTRIBUIR.md`) y guardar en `tests/fixtures/bn-html/`.
- [x] Escribir la plantilla en `web/src/domain/emailParser/templates/` (`bnVoucher.js`) y sus pruebas en `tests/domain`, siguiendo el modelo del BCR.
- [x] Reemplazar las plantillas sintéticas de BN en la demo y el benchmark: hecho para la compra con tarjeta.
- [x] Traer de Gmail solo los correos del BN con asunto "Voucher Digital".

### 19. Cobertura de estados y casos raros del lector · 3 pts
`parser`, `tests` · Hito: Más bancos
Estado: hecho, issue de GitHub #21 (rama `21-cobertura-de-estados-y-casos-raros-del-lector`).
- [x] Reversiones y reembolsos, cuotas, y comercios internacionales con otras monedas. Reversiones, reembolsos y cuotas no aplican (decisión del equipo). Para comercios internacionales, además del dólar se lee, convierte y muestra el **euro**.
- [x] Correos con varias transacciones y estados mixtos. Ya cubierto: tabla del BCR con varias filas aprobadas y negadas (`tests/infrastructure/bcrHtml.test.js`).
- [x] Todo correo no reconocido debe quedar como "Sin movimiento", nunca perderse. Ya cubierto desde el PR #41.
- [x] Convertir cada compra en dólares o euros con el tipo de cambio del día en que se hizo, no con el del día en que se leyó el correo. Se detectó durante esta tarea; el servidor devuelve el tipo de cambio de los últimos 60 días y la app corrige las compras de esos días.

### 20. Sincronización entre varios teléfonos con conflictos · 3 pts
`backend`, `frontend` · Hito: Más bancos
Hoy el respaldo en MongoDB sincroniza, pero no hay política explícita si dos teléfonos editan el mismo movimiento.
Estado: hecho, issue de GitHub #22 (rama `22-sincronizacion-entre-varios-telefonos-con-conflictos`).
- [x] Documentar y probar la regla de resolución (última escritura por movimiento, con marca de tiempo). La prueba encontró un caso que dejaba los teléfonos distintos para siempre (dos cambios en el mismo milisegundo) y se corrigió: en un empate, el teléfono adopta la versión del servidor.
- [x] Prueba automática con dos clientes simulados (`tests/contract/syncConflicts.test.js`): ediciones cruzadas en los dos órdenes, editar contra eliminar, movimientos distintos, presupuesto y empate.
- [x] Documentar el comportamiento en `docs/ARQUITECTURA.md` (sección "Conflictos entre teléfonos", con sus límites).

### 21. Exportar movimientos a CSV · 2 pts
`frontend` · Hito: Funciones de usuario
Estado: hecho, issue de GitHub #23 (rama `23-exportar-movimientos-a-csv`).
- [x] Botón en Ajustes que descarga los movimientos del rango elegido (por defecto, lo que va del mes; una fecha vacía no pone límite). El archivo se arma en el teléfono.
- [x] Columnas: fecha, comercio, monto, moneda, categoría, tipo, banco. Se agregaron "Monto en colones" (para compras en dólares o euros) y "Medio" (SINPE, tarjeta, transferencia o efectivo).
- [x] Compatible con Excel (UTF-8 con BOM, separador configurable) y prueba del formato (comillas, comas y tildes): punto y coma con coma decimal o coma con punto decimal; un comercio que parece fórmula se escribe con un apóstrofo delante (`tests/domain/csv.test.js` y `tests/application/exportTransactions.test.js`).

### 32. Ocultar el aviso "Modo demo: simula a tu banco" · 1 pt
`frontend` · Hito: Funciones de usuario
- [ ] Aplicar `display: none` al aviso "Modo demo: simula a tu banco" del inicio (`web/src/presentation/screens/HomeScreen.jsx`).
- [ ] Ajustar la prueba que hoy espera ese texto (`tests/presentation/app.test.jsx`).

### 33. Diálogos de confirmación para las acciones de las cards · 2 pts
`frontend` · Hito: Funciones de usuario
Estado: hecho, issue de GitHub #35 (rama `35-dialogos-de-confirmacion-para-las-acciones-de-las-cards`).
- [x] Listar las acciones de las cards que cambian o borran datos: en el detalle del movimiento, cambiar cómo se cuenta, cambiar la categoría y eliminar. Se sumaron las de Ajustes: presupuesto, bancos que se leen, activar, desactivar y sincronizar el respaldo, y salir del modo demo; y las que crean movimientos: gasto en efectivo, pegar un aviso, registrar a mano un correo y leerlo de nuevo.
- [x] Mostrar un diálogo de confirmación antes de ejecutarlas, con opción de cancelar. Al cancelar se vuelve a la hoja de donde se vino, con lo escrito.
- [x] Prueba de que la acción no se ejecuta si se cancela (`tests/presentation/app.test.jsx`).

### 34. Revisar el tipo de cambio · 1 pt
`backend`, `frontend`, `bug` · Hito: Funciones de usuario
Estado: hecho, issue de GitHub #36 (rama `36-revisar-el-tipo-de-cambio`).
- [x] Verificar que el valor que muestra la app coincide con el del BCCR para la fecha. El servidor consultaba un servicio web anterior; se migró a la API nueva del BCCR (SDDE, JSON con token en el encabezado) y se comprobó con un token real (₡455,60 el 2026-10-12).
- [x] Revisar la conversión de montos en dólares y qué pasa si la API o la caché no responden. La conversión es correcta y, desde la tarea 19, cada movimiento usa el tipo de cambio del día de la compra; si la API no responde, la app usa el último valor conocido o el de reserva (510).
- [x] Corregir lo que falle y dejarlo cubierto con una prueba.

### 35. Vista propia para el filtrado de movimientos · 2 pts
`frontend` · Hito: Funciones de usuario
Estado: hecho, issue de GitHub #37 (rama `37-vista-propia-para-el-filtrado-de-movimientos`).
- [x] Mover el filtrado de movimientos a una vista distinta a la del inicio. No había filtros. Se probó una pestaña "Movimientos" aparte, pero el equipo decidió dejar los filtros en el propio inicio: un botón "Filtros" abre un panel con fecha (días completos), categoría, tipo, banco y monto (desde, hasta o un rango), que se aplican con "Aplicar" y se resuelven en la consulta a SQLite. La lista del inicio ("Movimientos") muestra todos los movimientos, o los que cumplen los filtros; tocar una tarjeta de categoría filtra la lista por ella en el mes.
- [x] Mantener los filtros elegidos al entrar y salir de la vista: se conservan al cambiar de pantalla mientras la app está abierta.
- [x] Prueba de la navegación y de los filtros (`tests/application/searchTransactions.test.js` y `tests/presentation/app.test.jsx`).

### 36. Script para crear los issues con `gh` · 2 pts
`infra`, `docs` · Hito: Publicación
Estado: hecho, issue de GitHub #38 (rama `38-script-para-crear-los-issues-con-gh`).
- [x] Script en `scripts/` que crea etiquetas, hitos e issues de este backlog con la CLI `gh`, en el mismo orden.
- [x] Crear los issues 1 a 14 asignados a Jordy y cerrarlos de inmediato.
- [x] Que se pueda volver a ejecutar sin duplicar issues.
- [x] Documentar su uso en la sección "Cómo crearlos en GitHub".

### 37. Reactivar el respaldo después de borrarlo no vuelve a subir nada · 1 pt
`bug`, `frontend` · Hito: Más bancos
Al borrar el respaldo y encenderlo otra vez, la sincronización no subía nada (los registros locales seguían con `needs_backup=0`) y el servidor quedaba vacío aunque el teléfono tuviera datos.
Estado: hecho, issue de GitHub #60 (rama `60-reactivar-el-respaldo-despues-de-borrarlo`).
- [x] Al borrar el respaldo, marcar para subir todos los movimientos, reglas y ajustes locales, sin cambiar su `updatedAt`.
- [x] Prueba automática: borrar, reactivar y sincronizar; un teléfono limpio recupera todo.
- [x] Documentarlo en `docs/ARQUITECTURA.md`.

### 38. Releer Gmail en un teléfono limpio pisa las ediciones del respaldo · 1 pt
`bug`, `frontend` · Hito: Más bancos
Al restaurar en un teléfono limpio, la app relee Gmail antes de encender el respaldo. Esos movimientos llevaban la hora de lectura como marca, le ganaban a la versión del respaldo y la pisaban también en el servidor (se perdían las categorías cambiadas).
Estado: hecho, issue de GitHub #59 (rama `59-releer-gmail-en-un-telefono-limpio-pisa-las-ediciones-del-respaldo`).
- [x] Un movimiento leído de un correo lleva como `updatedAt` la fecha de la compra (nunca más que la hora actual): releer el mismo correo da la misma marca y lo editado gana.
- [x] Prueba automática: teléfono limpio que relee los correos y luego sincroniza (`tests/contract/syncConflicts.test.js`).
- [x] Documentarlo en `docs/ARQUITECTURA.md` ("Conflictos entre teléfonos").

---

## Pendiente · Jose Meza Álvarez · 11 pts

### 22. Plantilla real de BAC · 3 pts
`parser` · Hito: Más bancos
- [x] Descargar con "Mostrar original" notificaciones reales de BAC (tarjeta y SINPE).
- [x] Anonimizar (ver `docs/CONTRIBUIR.md`) y guardar en `tests/fixtures/bac-html/`.
- [x] Escribir la plantilla en `web/src/domain/emailParser/templates/` y sus pruebas en `tests/domain`, siguiendo el modelo del BCR.
- [x] Reemplazar las plantillas sintéticas de BAC en la demo y el benchmark.

### 23. Alertas de presupuesto · 2 pts
`frontend` · Hito: Funciones de usuario
- [x] Aviso visible al llegar al 80 % y al 100 % del presupuesto mensual (global y por categoría).
- [x] Umbral configurable en Ajustes.
- [x] Prueba del cálculo del porcentaje en el cliente.

### 24. Metas de ahorro · 3 pts
`frontend` · Hito: Funciones de usuario
- [ ] Crear una meta con monto y fecha.
- [ ] Mostrar avance según ingresos menos gastos del mes.
- [ ] Guardar en SQLite local y en el respaldo.

### 25. Accesibilidad y revisión en iPhone · 2 pts
`frontend`, `bug` · Hito: Funciones de usuario
- [x] Revisar contraste, tamaños táctiles y etiquetas en modo claro y oscuro.
- [x] Documentar o resolver el inicio de sesión en la PWA instalada en iPhone.
- [x] Actualizar capturas en `docs/capturas/` si cambia la interfaz.

### 26. Probar la instalación desde cero · 1 pt
`docs`, `tests` · Hito: Publicación
- [x] Clonar en una máquina limpia y seguir solo el README (`npm install`, `npm run dev`).
- [x] Levantar con `docker compose up` usando `.env.example`.
- [x] Corregir cualquier paso del README o de `docs/DESPLIEGUE.md` que falle.

---

## Pendiente · Yader Barahona Villarreal · 11 pts

### 27. Plantilla real de Davivienda · 2 pts
`parser` · Hito: Más bancos
- [x] Notificaciones reales de Davivienda (tarjeta y transferencias) anonimizadas en `tests/fixtures/davivienda-html/`.
- [x] Plantilla en `web/src/domain/emailParser/templates/` con sus pruebas, siguiendo el modelo del BCR.
- [x] Agregar el remitente en la búsqueda de Gmail (`web/src/domain/banks.js` y `web/src/application/preferences.js`).

### 28. Plantilla real de Promerica · 2 pts
`parser` · Hito: Más bancos
- [ ] Mismos pasos que el issue 27, con fixtures en `tests/fixtures/promerica-html/`.
- [ ] Actualizar la sección "Limitaciones conocidas" del README con los bancos soportados.

### 29. Benchmark a 100, 10.000 y 100.000 correos · 2 pts
`tests`, `investigación` · Hito: Mediciones
El PDF del curso pide responder qué cambia al escalar.
- [ ] Extender `scripts/bench-parser.mjs` para varias escalas.
- [ ] Medir ingesta, resumen del mes y tamaño de la base SQLite.
- [ ] Tabla de resultados en `docs/MEDICIONES.md`.

### 30. Comparar parser por reglas contra un modelo de lenguaje (semilla de TFG) · 3 pts
`investigación` · Hito: TFG
- [ ] Definir un conjunto de evaluación con correos anonimizados y etiquetas correctas.
- [ ] Probar el parser actual y un modelo de lenguaje sobre el mismo conjunto.
- [ ] Comparar precisión, costo y tiempo; documentar en `docs/`.

### 31. Detección de cargos anómalos (prototipo) · 2 pts
`investigación` · Hito: TFG
- [x] Definir qué es una anomalía (monto fuera de rango por comercio o categoría).
- [x] Prototipo sobre el dataset sintético de `scripts/dataset.mjs`.
- [x] Medir falsos positivos y documentar límites.

Resultado en `docs/ANOMALIAS.md`.

---

## Cómo crearlos en GitHub

Con la CLI `gh` autenticada, crear antes las etiquetas y los hitos ("Más bancos", "Funciones de usuario", "Publicación", "Mediciones", "TFG"). Los issues 1 a 14 se crean asignados a Jordy y se cierran de inmediato (`gh issue close`, motivo "completed"). En el proyecto, agregar un campo numérico "Puntos" para ver la carga por persona. Cada integrante debe tener acceso al repositorio (Settings > Collaborators) para poder ser asignado, y debe tener `user.name` y `user.email` configurados para que sus commits aparezcan en su perfil.

Todo esto lo hace `scripts/create-issues.mjs`, que lee este archivo: crea las etiquetas, los hitos y los issues en orden, cierra los ya hechos y deja los puntos en el cuerpo de cada issue. El usuario de GitHub de cada integrante sale de la columna "GitHub" de la tabla de reparto; quien no tenga recibe sus issues sin asignar.

```bash
npm run issues -- --dry-run   # muestra lo que haría, sin tocar GitHub
npm run issues
```

Se puede volver a ejecutar: salta los issues cuyo título ya existe.

Los números de issue que usa este archivo son de referencia: GitHub los asigna en orden de creación, así que conviene crearlos en el mismo orden.
