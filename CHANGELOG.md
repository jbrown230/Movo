# Cambios

## v2.0.0

La app pasó a React con una arquitectura por capas. El aspecto y el funcionamiento para quien la usa son los mismos.

- **React y Vite.** La interfaz se reescribió en componentes React (pantallas, ventanas y proveedores de estado) conservando los estilos. La app se compila con Vite.
- **Arquitectura por capas.** El código se separó en `domain` (reglas puras), `application` (casos de uso), `infrastructure` (SQLite, Gmail, API, navegador), `presentation` (React) y `composition`. Ver `docs/ARQUITECTURA.md`.
- **Código más legible.** Nombres completos en lugar de abreviaturas, una plantilla del lector por archivo, un repositorio por tabla, constantes con nombre y el vocabulario del negocio en un solo lugar (`domain/types.js`).
- **Sin cambios en los datos.** Las bases SQLite ya guardadas y el respaldo del servidor siguen funcionando: no cambiaron columnas ni formato de red.
- **Pruebas por capa** (dominio, aplicación, infraestructura, interfaz y privacidad). Se agregaron casos de error de conexión, datos inválidos, correos vacíos y fallos a mitad de una escritura.
- **Privacidad de los datos de prueba.** Los correos de ejemplo se anonimizaron por completo (comercios, fechas, referencias y enlaces de WhatsApp incluidos). Una prueba automática (`tests/privacy`) revisa que no se cuele ningún dato real. Nueva guía en `docs/CONTRIBUIR.md`.
- **Despliegue.** La imagen de Docker compila la app con Vite; los archivos llevan un código en el nombre y se guardan en caché por un año.
- **Arreglos.** El número de gasto del inicio ya no puede animarse hacia valores negativos en el primer cuadro; el autofoco de las ventanas ya no le quita el cursor a quien está escribiendo; al cerrar sesión o borrar datos no se vuelve a guardar la base borrada.
- El nombre del almacenamiento local pasó de `pp:` a `movo:`: se pide iniciar sesión otra vez una sola vez.
- Capturas de pantalla nuevas.

## v1.3.0

- Validado con el HTML real de cuatro notificaciones del BCR (SINPE enviado, SINPE entre cuentas propias, tarjeta aprobada y tarjeta negada). Quedan como pruebas automáticas anonimizadas en `tests/fixtures/bcr-html/`.
- Conversión de HTML a texto que colapsa los espacios como un navegador: el BCR parte etiquetas con saltos de línea ("Estimado\r\n(a):") y pone tabuladores entre celdas.
- Las horas de los correos se interpretan en hora de Costa Rica (UTC−6), aunque el teléfono esté en otra zona horaria.
- Nombres de comercio limpios para mostrar ("Servicio Digital Sub" en vez de "SERVICIO DIGITAL SUB 00000000000 US").

## v1.2.0

- SINPE entre cuentas propias: si el titular del correo ("Estimado (a)") es la misma persona que el origen o destino, el movimiento se marca como "Entre mis cuentas" y no suma a gastos ni a ingresos. La comparación de nombres tolera orden distinto, tildes y nombres recortados, y exige tres palabras en común para no confundir familiares.
- Control "¿Cómo contarlo?" en cada movimiento: gasto, ingreso o entre mis cuentas.
- El resumen del mes muestra aparte lo movido entre tus cuentas.
- Al actualizar, los SINPE propios que la versión anterior registró como ingreso se corrigen solos (sin tocar lo que cambiaste a mano).

## v1.1.0

- Plantillas con el formato real del BCR: SINPE Móvil enviado (débito) y recibido (crédito), y la tabla "Notificación de Transacciones BCR" de tarjeta.
- Las transacciones con estado "Negada" (o rechazada, anulada…) no se registran como gasto; el correo aparece en la bandeja como "Negada por el banco".
- Un correo puede generar varios movimientos (tabla de tarjeta con varias filas).
- Montos sin cero inicial (`Monto: .15`) y horas con AM/PM.
- Conversión de HTML a texto que conserva las columnas de las tablas y los saltos `<br>` dentro de celdas.
- Al actualizarse el lector, la app vuelve a leer automáticamente los correos que antes no reconocía. Botón "Leer de nuevo" en la bandeja.
- Los movimientos eliminados no reaparecen al volver a leer.
- La demo usa la estructura real del BCR e incluye una compra negada.

## v1.0.0

- PWA instalable con modo sin conexión (service worker) y modo oscuro.
- Lectura de Gmail desde el teléfono con permiso de solo lectura.
- Lector con plantillas sintéticas para BAC, BN y BCR, más un lector genérico por etiquetas para formatos desconocidos.
- Detección de SINPE enviado y recibido, compras con tarjeta en colones y dólares.
- SQLite en el navegador (sql.js) con una base por usuario e ingesta idempotente por Message-ID.
- Categorías automáticas y reglas del usuario. Presupuesto mensual.
- Modo demo con simulador de banco.
- API mínima: configuración, tipo de cambio del BCCR con caché en Redis, respaldo opcional por usuario en MongoDB y borrado de datos.
- Pruebas del lector, de la base local, de la API, de la separación por usuario y de las fallas de Redis. Benchmark reproducible.
