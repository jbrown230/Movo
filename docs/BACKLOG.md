# Backlog

Plan de trabajo del equipo. Incluye lo que ya está hecho (para registrarlo como issues cerrados) y lo pendiente, repartido por peso.

Etiquetas: `parser`, `frontend`, `backend`, `tests`, `docs`, `investigación`, `bug`, `infra`.

Peso en puntos: **1** = unas pocas horas, **2** = un día, **3** = varios días.

## Reparto de lo pendiente

Lo ya hecho (issues 1 a 14) lo hizo Jordy y suma 34 puntos. Por eso Jordy lleva menos trabajo pendiente: entre lo hecho y lo que queda, la carga total del equipo queda parecida.

Los bancos se reparten uno por persona, para que nadie cargue con toda la lógica de lectura de comprobantes: **BCR** (Jordy, hecho), **BN** (Dylan), **BAC** (Jose), **Davivienda y Promerica** (Yader).

| Integrante | Hecho | Pendiente | Issues pendientes |
|---|---|---|---|
| Jordy Palacios | 34 pts (issues 1–14, cerrados) | **6 pts** | 15, 16, 17 |
| Dylan Mejía Ruiz | — | **11 pts** | 18, 19, 20, 21 |
| Jose Meza Álvarez | — | **11 pts** | 22, 23, 24, 25, 26 |
| Yader Barahona Villarreal | — | **11 pts** | 27, 28, 29, 30, 31 |

Reglas:
- Cada issue se trabaja en una rama `tipo/numero-descripcion` (ej. `feat/18-plantilla-bn`) y entra a `main` por pull request.
- Revisión cruzada: Jordy revisa a Dylan, Dylan a Jose, Jose a Yader y Yader a Jordy.
- Para cada banco, Jordy explica a quien lo tome cómo se escribió la plantilla del BCR (`web/js/parser.js`, `tests/fixtures/bcr-html/`): ese es el modelo a seguir.
- Si alguien termina antes, toma un issue de otra persona de acuerdo con ella, sin dejar la carga desigual.

---

## Ya hecho (cerrados) · Jordy Palacios · 34 pts

Estos issues se crean y se cierran de una vez, para que el historial del proyecto muestre el trabajo. Las versiones corresponden al `CHANGELOG.md`.

| # | Issue | Pts | Etiquetas | Versión |
|---|---|---|---|---|
| 1 | PWA instalable con modo sin conexión, service worker y modo oscuro | 3 | `frontend` | v1.0.0 |
| 2 | SQLite en el navegador (sql.js): una base por usuario e ingesta idempotente por Message-ID | 3 | `frontend` | v1.0.0 |
| 3 | Lectura de Gmail de solo lectura, limitada a remitentes bancarios | 2 | `frontend` | v1.0.0 |
| 4 | Lector de correos base: plantillas sintéticas BAC, BN y BCR, y lector genérico por etiquetas | 3 | `parser` | v1.0.0 |
| 5 | Plantillas reales del BCR: SINPE Móvil enviado y recibido, tarjeta, y compras negadas | 3 | `parser` | v1.1.0 / v1.3.0 |
| 6 | SINPE entre cuentas propias: detección del titular y control "¿Cómo contarlo?" | 2 | `parser`, `frontend` | v1.2.0 |
| 7 | API Node mínima: configuración, validación de token de Google y tipo de cambio del BCCR | 3 | `backend` | v1.0.0 |
| 8 | Redis: caché de tokens y tipo de cambio, y límite de solicitudes, con tolerancia a caída | 2 | `backend` | v1.0.0 |
| 9 | MongoDB: respaldo opcional por usuario y borrado de datos | 2 | `backend` | v1.0.0 |
| 10 | Categorías automáticas, reglas del usuario y presupuesto mensual | 2 | `frontend` | v1.0.0 |
| 11 | Modo demo con simulador de banco y datos sintéticos | 2 | `frontend` | v1.0.0 |
| 12 | Pruebas automáticas, benchmark del lector, dataset sintético y CI en GitHub Actions | 3 | `tests` | v1.0.0 |
| 13 | Despliegue con Docker, Caddy y guía para un VPS | 2 | `infra`, `docs` | v1.0.0 |
| 14 | README, documento de arquitectura, capturas y renombre del proyecto a Movo | 2 | `docs` | v1.0.0 |

---

## Pendiente · Jordy Palacios · 6 pts

### 15. Publicar el release con etiqueta y notas · 2 pts
`docs` · Hito: Publicación
El `CHANGELOG.md` llega a v1.3.0 pero el repositorio no tiene tags ni releases.
- [ ] Crear el tag `v1.3.0` sobre el commit actual de `main`. Las versiones anteriores no tienen commit propio en el historial, así que no se etiquetan.
- [ ] Publicar el release en GitHub con las notas tomadas del changelog.
- [ ] Verificar que el repositorio es público y que el CI pasa en `main`.
- [ ] Crear las etiquetas e hitos para el resto del equipo.

### 16. Endurecer el servidor ante caídas de Redis y Mongo · 2 pts
`backend`, `tests` · Hito: Publicación
- [ ] Prueba de que la API responde (sin caché) si Redis se cae a mitad de ejecución.
- [ ] Prueba de que el respaldo falla con mensaje claro y la app local sigue funcionando si Mongo no responde.
- [ ] Registrar los resultados en la tabla de fallas de `docs/ARQUITECTURA.md`.

### 17. Medir el efecto de Redis en el tipo de cambio · 2 pts
`tests`, `investigación` · Hito: Mediciones
- [ ] Comparar latencia de la API con Redis y sin Redis (consulta directa al BCCR).
- [ ] Reportar mediana y p95 con al menos 200 solicitudes.
- [ ] Conclusión escrita en `docs/MEDICIONES.md`: ¿justifica Redis el costo operativo?

---

## Pendiente · Dylan Mejía Ruiz · 11 pts

### 18. Plantilla real de Banco Nacional (BN) · 3 pts
`parser` · Hito: Más bancos
- [ ] Descargar con "Mostrar original" notificaciones reales de BN (tarjeta y SINPE).
- [ ] Anonimizar y guardar en `tests/fixtures/bn-html/`.
- [ ] Escribir la plantilla en `web/js/parser.js` y sus pruebas en `tests/client.test.mjs`, siguiendo el modelo del BCR.
- [ ] Reemplazar las plantillas sintéticas de BN en la demo y el benchmark.

### 19. Cobertura de estados y casos raros del lector · 3 pts
`parser`, `tests` · Hito: Más bancos
- [ ] Reversiones y reembolsos, cuotas, y comercios internacionales con otras monedas.
- [ ] Correos con varias transacciones y estados mixtos.
- [ ] Todo correo no reconocido debe quedar como "Sin movimiento", nunca perderse.

### 20. Sincronización entre varios teléfonos con conflictos · 3 pts
`backend`, `frontend` · Hito: Más bancos
Hoy el respaldo en MongoDB sincroniza, pero no hay política explícita si dos teléfonos editan el mismo movimiento.
- [ ] Documentar y probar la regla de resolución (última escritura por movimiento, con marca de tiempo).
- [ ] Prueba automática con dos clientes simulados.
- [ ] Documentar el comportamiento en `docs/ARQUITECTURA.md`.

### 21. Exportar movimientos a CSV · 2 pts
`frontend` · Hito: Funciones de usuario
- [ ] Botón en Ajustes que descarga los movimientos del rango elegido.
- [ ] Columnas: fecha, comercio, monto, moneda, categoría, tipo, banco.
- [ ] Compatible con Excel (UTF-8 con BOM, separador configurable) y prueba del formato (comillas, comas y tildes).

---

## Pendiente · Jose Meza Álvarez · 11 pts

### 22. Plantilla real de BAC · 3 pts
`parser` · Hito: Más bancos
- [ ] Descargar con "Mostrar original" notificaciones reales de BAC (tarjeta y SINPE).
- [ ] Anonimizar y guardar en `tests/fixtures/bac-html/`.
- [ ] Escribir la plantilla en `web/js/parser.js` y sus pruebas en `tests/client.test.mjs`, siguiendo el modelo del BCR.
- [ ] Reemplazar las plantillas sintéticas de BAC en la demo y el benchmark.

### 23. Alertas de presupuesto · 2 pts
`frontend` · Hito: Funciones de usuario
- [ ] Aviso visible al llegar al 80 % y al 100 % del presupuesto mensual (global y por categoría).
- [ ] Umbral configurable en Ajustes.
- [ ] Prueba del cálculo del porcentaje en el cliente.

### 24. Metas de ahorro · 3 pts
`frontend` · Hito: Funciones de usuario
- [ ] Crear una meta con monto y fecha.
- [ ] Mostrar avance según ingresos menos gastos del mes.
- [ ] Guardar en SQLite local y en el respaldo.

### 25. Accesibilidad y revisión en iPhone · 2 pts
`frontend`, `bug` · Hito: Funciones de usuario
- [ ] Revisar contraste, tamaños táctiles y etiquetas en modo claro y oscuro.
- [ ] Documentar o resolver el inicio de sesión en la PWA instalada en iPhone.
- [ ] Actualizar capturas en `docs/capturas/` si cambia la interfaz.

### 26. Probar la instalación desde cero · 1 pt
`docs`, `tests` · Hito: Publicación
- [ ] Clonar en una máquina limpia y seguir solo el README (`npm install`, `npm run dev`).
- [ ] Levantar con `docker compose up` usando `.env.example`.
- [ ] Corregir cualquier paso del README o de `docs/DESPLIEGUE.md` que falle.

---

## Pendiente · Yader Barahona Villarreal · 11 pts

### 27. Plantilla real de Davivienda · 2 pts
`parser` · Hito: Más bancos
- [ ] Notificaciones reales de Davivienda (tarjeta y transferencias) anonimizadas en `tests/fixtures/davivienda-html/`.
- [ ] Plantilla en `web/js/parser.js` con sus pruebas, siguiendo el modelo del BCR.
- [ ] Agregar el remitente en la búsqueda de Gmail (`web/js/gmail.js`).

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
- [ ] Definir qué es una anomalía (monto fuera de rango por comercio o categoría).
- [ ] Prototipo sobre el dataset sintético de `scripts/dataset.mjs`.
- [ ] Medir falsos positivos y documentar límites.

---

## Cómo crearlos en GitHub

Con la CLI `gh` autenticada, crear antes las etiquetas y los hitos ("Más bancos", "Funciones de usuario", "Publicación", "Mediciones", "TFG"). Los issues 1 a 14 se crean asignados a Jordy y se cierran de inmediato (`gh issue close`, motivo "completed"). En el proyecto, agregar un campo numérico "Puntos" para ver la carga por persona. Cada integrante debe tener acceso al repositorio (Settings > Collaborators) para poder ser asignado, y debe tener `user.name` y `user.email` configurados para que sus commits aparezcan en su perfil.

Los números de issue que usa este archivo son de referencia: GitHub los asigna en orden de creación, así que conviene crearlos en el mismo orden.
