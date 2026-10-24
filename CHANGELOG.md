# Cambios

## Sin publicar

### Funciones de la app

- **Metas de ahorro.** El botón "Metas" del inicio abre su propia pantalla (sin agregar una pestaña a la barra de abajo), donde se crea una meta con nombre, monto y fecha límite. Lo ahorrado es lo que entra menos lo que se gasta (los movimientos entre cuentas propias no cuentan), desde el primer día del mes en que se crea la meta hasta su fecha límite. Cada meta muestra lo ahorrado, el porcentaje y cuánto hay que ahorrar al mes para llegar a tiempo, o si ya se logró o venció; arriba se ve cuánto se lleva ahorrado este mes. Las metas se pueden cambiar y eliminar, con confirmación. Se guardan en una tabla nueva de SQLite (`savings_goals`, migración 2) y en el respaldo como un tipo de registro nuevo (`savingsGoals` / `savings_goal`), validado por la API y por MongoDB.
- **Alertas de presupuesto.** El inicio avisa cuando lo gastado en el mes llega al 80 % del presupuesto ("Cerca del límite") y cuando llega al 100 % ("Presupuesto agotado"), y la barra del presupuesto cambia de color. En Ajustes se puede dar un presupuesto propio a cada categoría de gasto (las que quedan en blanco no tienen límite): avisan igual que el global y su tarjeta en el inicio muestra cuánto llevan de él. El umbral del aviso se elige en Ajustes ("Avisar al llegar al": 50 %, 60 %, 70 %, 80 % o 90 %) y vale para todos los presupuestos. El porcentaje se redondea hacia abajo, así el 79,9 % no avisa del 80 % ni el 99,9 % del 100 %. Los presupuestos por categoría y el umbral se sincronizan con el respaldo (`category_budgets` y `budget_alert_percent`).

## v0.2.0

Núcleo funcional: más bancos reales, funciones para revisar y exportar los movimientos, y un respaldo que resiste caídas y conflictos entre teléfonos.

### Lector de notificaciones

- **Plantillas reales de BAC.** El lector reconoce la "Notificación de Transacción" con tarjeta y la transferencia SINPE (acreditada es ingreso, debitada es gasto; entre cuentas propias no cuenta). Lee cada valor desde su etiqueta, así funciona aunque la tabla HTML del correo se convierta a texto de formas distintas. La plantilla sintética de BAC queda solo para la demo. (#53)
- **Plantillas reales de Davivienda.** El lector reconoce tres formatos reales de Davivienda: el aviso de débito o crédito en la cuenta ("TRANSACCIÓN DAVIVIENDA"; así llega también un SINPE enviado), la compra con tarjeta y la transferencia recibida ("TRANSFERENCIA REALIZADA"; si el titular de origen y el de destino son la misma persona, cuenta como movimiento entre cuentas propias). Los avisos de inicio de sesión, cambio de dispositivo, solicitud de retiro sin tarjeta y el estado de cuenta no se leen como movimientos. Gmail busca solo el remitente de las notificaciones (`bancavirtual@davivienda.cr`). La conversión de HTML a texto ahora acepta correos que son un fragmento suelto (sin `<html>` ni `<body>`), como los de Davivienda. La prueba de privacidad también revisa el saludo "Estimado(a) Cliente NOMBRE". (#27)
- **Compras en euros.** El lector reconoce montos en euros (`EUR`, `EURO`, `€`) en las plantillas del BCR y del BN, y la demo puede simularlas. El servidor responde también los colones por euro, calculados con el dólar de venta (indicador 318 del BCCR) y los dólares por euro (indicador 333). Una compra en euros leída antes de tener tipo de cambio queda sin convertir y se convierte sola cuando llega; el euro no tiene valor de reserva inventado. Ajustes muestra el tipo de cambio del euro. (#21)
- **Tipo de cambio del día de la compra.** Cada compra en dólares o euros se convierte con el tipo de cambio del día en que se hizo, no con el del día en que se leyó el correo. El servidor devuelve el tipo de cambio de cada uno de los últimos 60 días (`history` en `/api/fx`) y, cada vez que llega, la app corrige las compras de esos días; también las que se guardaron con el valor de reserva por no tener conexión. Las compras más viejas conservan el tipo de cambio con que se guardaron. (#21)

### Funciones de la app

- **Filtros de movimientos en el inicio.** Un botón "Filtros" sobre la lista del inicio abre un panel animado con filtros por fecha (días completos, sin hora), categoría, tipo (gasto, ingreso o entre mis cuentas), banco y monto en colones (desde, hasta o un rango); se aplican al tocar "Aplicar", avisan si un rango está al revés, se resuelven en la consulta a SQLite y se conservan al cambiar de pantalla. La lista del inicio se llama "Movimientos" y muestra todos; con filtros, solo los que cumplen. Tocar una tarjeta de categoría filtra la lista por esa categoría en lo que va del mes. (#37)
- **Exportar movimientos a CSV.** Desde Ajustes se descarga un archivo con los movimientos de un rango de fechas (por defecto, lo que va del mes): fecha, comercio, monto, moneda, monto en colones, categoría, tipo, medio y banco. Se abre bien en Excel (UTF-8 con marca BOM) con separador a elegir: punto y coma con coma decimal (Excel en español) o coma con punto decimal (Excel en inglés y Google Sheets). Los comercios con comillas, comas o tildes quedan bien escritos, y uno que parezca fórmula se escribe con un apóstrofo delante. El archivo se arma en el teléfono, sin pasar por el servidor. (#23)
- **Confirmación antes de cambiar o borrar datos.** El detalle del movimiento pide confirmar antes de cambiar cómo se cuenta, cambiar la categoría (que también recategoriza los demás movimientos del comercio) o eliminarlo; al cancelar se vuelve al detalle. También piden confirmación cambiar el presupuesto, cambiar los bancos que se leen, activar, desactivar o sincronizar el respaldo, salir del modo demo, guardar un gasto en efectivo, leer un aviso pegado, registrar a mano un correo y volver a leerlo. Al cancelar en un formulario, lo escrito se conserva. (#35)

### Respaldo y sincronización

- **Conflictos de sincronización entre teléfonos.** Regla documentada y probada con dos teléfonos simulados: gana la última escritura, registro por registro, sin importar quién sincronice primero. Se corrigió el empate: si dos teléfonos cambiaban lo mismo en el mismo milisegundo, quedaban distintos para siempre; ahora los dos adoptan lo que llegó primero al servidor. Además, lo que un teléfono recibe de vuelta de lo que él mismo subió ya no cuenta como "recibido". (#22)
- **Restaurar el respaldo ya no pierde las ediciones.** En un teléfono limpio o tras borrar los datos del navegador, la app relee Gmail antes de que se encienda el respaldo; esos movimientos llevaban la hora de lectura como marca, le ganaban a la versión del respaldo y la pisaban también en el servidor (se perdían, por ejemplo, las categorías cambiadas). Ahora un movimiento leído de un correo lleva la fecha de la compra, y lo editado gana. (#59)
- **Reactivar el respaldo después de borrarlo vuelve a subir todo.** Antes, al borrar el respaldo y encenderlo otra vez, la sincronización no subía nada y el servidor quedaba vacío aunque el teléfono tuviera datos. Ahora, al borrarlo, los movimientos, reglas y ajustes del teléfono quedan marcados para subirse de nuevo (sin cambiar su fecha de modificación), y otro teléfono limpio los recupera. (#60)

### Servidor y mediciones

- **Validación con JSON Schema en MongoDB.** La colección `backup_records` tiene un validador `$jsonSchema` que se aplica al conectar: exige la envoltura completa y la forma de `data` según el tipo, con los mismos valores permitidos y largos máximos que la API (`shared/backupContract.js`). Un documento mal formado se rechaza aunque no pase por la API.
- **Script de carga en MongoDB.** `npm run seed:mongo -- <cantidad> <semilla> [usuario]` carga correos sintéticos por el mismo camino que los reales: lector, sincronización, validación y caso de uso del servidor. Borra antes lo de esa persona, así la misma semilla deja siempre los mismos movimientos.
- **`.env.example` completo.** Agrega `MONGO_URL`, `REDIS_URL`, `PORT`, `SERVE_STATIC` y `API_URL`, con qué valor usar en Docker, en desarrollo y con Atlas.
- **Servidor más resistente a caídas de MongoDB.** Si MongoDB se cae con la API andando, el respaldo responde 503 "Respaldo no disponible por ahora." en vez de 500 "Error interno.", y la app lo muestra tal cual. Si MongoDB estaba caído al arrancar, el respaldo se reconecta solo cuando vuelve, sin reiniciar la API. Pruebas con caídas reales de Redis y MongoDB a mitad de ejecución (`server/test/adapters/outages.test.js`). (#18)
- **Medición del efecto de Redis en el tipo de cambio.** `npm run bench:fx` (`scripts/bench-fx.mjs`) mide 200 solicitudes a `/api/fx` sin caché, con caché en memoria y con Redis. Resultados y conclusión en `docs/MEDICIONES.md`: la caché baja la mediana de 694 ms a menos de 3 ms, Redis y la memoria rinden casi igual, y sin caché el BCCR rechaza las ráfagas por su límite de unas 40 consultas por minuto. (#19)

### Documentación

- **Bitácora del seguimiento 2** en `docs/seguimientos/S2.md`: qué se hizo, qué no y qué queda pendiente, punto por punto del enunciado y por motor. La bitácora del seguimiento 1 se actualizó con cómo quedó lo que había quedado pendiente. (#63)

### Prototipos

- **Prototipo de detección de cargos anómalos.** `web/src/domain/anomalies.js` marca un gasto si su monto queda muy por encima de lo usual en ese comercio: z robusto (mediana y MAD sobre el logaritmo del monto) mayor que 3,5 y al menos ₡2.000 sobre lo típico, comparando solo con compras anteriores y desde la sexta compra del comercio. `npm run anomalias` lo mide sobre el dataset sintético: 0,8 % de falsos positivos (menos de una alerta falsa por persona al mes) y 87 % de detección de cargos inflados ×4–10 en tarjeta. Comparar con la categoría cuando el comercio no tiene historial quedó como opción apagada, porque casi triplica los falsos positivos. `scripts/dataset.mjs` ahora da a cada comercio un monto típico y una dispersión propios, y acepta semilla. La app todavía no muestra alertas. Definición, resultados y límites en `docs/ANOMALIAS.md`. (#31)

## v0.1.0

Primera versión pública de Movo.

- **App del teléfono (PWA).** Hecha con React y Vite, instalable, con modo sin conexión (service worker) y modo claro u oscuro. En Ajustes se elige la apariencia: automática (sigue al teléfono), clara u oscura. El código está separado en capas (`domain`, `application`, `infrastructure`, `presentation` y `composition`): ver `docs/ARQUITECTURA.md`.
- **Logo propio:** una M cuyo trazo derecho es una flecha verde que sube ("money" + movimiento), en los colores del degradado de la app. Reemplaza el símbolo ₡ genérico de los íconos y la letra M de texto de la pantalla. Se genera con `scripts/generate-icons.mjs`.
- **Servidor con las mismas capas** (`domain`, `application` y `adapters`). La capa HTTP solo traduce; las reglas viven en casos de uso que se prueban sin Express, MongoDB ni Redis. API documentada en `docs/API.md`.
- **Contrato compartido** (`shared/backupContract.js`): un solo lugar para los nombres y valores permitidos del respaldo, con pruebas de contrato que sincronizan dos teléfonos simulados a través del código real del servidor.
- **Lectura de correos.** Gmail se lee desde el teléfono con permiso de solo lectura, limitado a remitentes bancarios. Los correos nunca se envían al servidor.
- **Lector de notificaciones.**
  - Plantillas con el formato real del BCR: SINPE Móvil enviado y recibido, y la tabla de transacciones con tarjeta (incluida la compra "Negada", que no se registra como gasto).
  - Plantilla con el formato real del Banco Nacional: el "Voucher Digital" (comprobante de compra con tarjeta), en colones o dólares. El BN no notifica los SINPE Móvil por correo, y de ese remitente solo se leen los correos con asunto "Voucher Digital". (#44)
  - Plantillas sintéticas para BAC y para el SINPE del BN de la demo (hasta tener correos reales).
  - Un correo solo se lee si coincide con una plantilla oficial; si no, queda como "Sin movimiento". Así la publicidad con montos no se registra como gasto. (#41)
  - Un correo puede generar varios movimientos. Las horas se interpretan en hora de Costa Rica (UTC−6).
  - SINPE entre cuentas propias: si el titular es la misma persona en origen y destino, no cuenta como gasto ni como ingreso. Cada movimiento tiene el control "¿Cómo contarlo?".
  - Si el lector mejora, la app vuelve a leer sola los correos que antes no reconocía.
- **Base local.** SQLite en el navegador (sql.js), una base por usuario, con lectura idempotente por Message-ID. Los movimientos eliminados no reaparecen.
- **Categorías y presupuesto.** Categorías automáticas, reglas propias (al corregir una categoría se guarda como regla) y presupuesto mensual. Nombres de comercio limpios para mostrar.
- **Modo demo.** Datos de ejemplo y un simulador de banco: haces un SINPE o una compra y Movo lee el correo que llega. Las compras del BN se generan con el formato del voucher real. El aviso "Modo demo: simula a tu banco" del inicio queda oculto. (#44, #45)
- **API mínima (Node).** Configuración, tipo de cambio del BCCR con caché en Redis, respaldo opcional por usuario en MongoDB y borrado de datos. Si Redis se cae, sigue funcionando con caché en memoria.
- **Tipo de cambio.** El servidor consulta la API del Sistema de Divulgación de Datos Económicos (SDDE) del BCCR, que responde en JSON y se autentica con `BCCR_TOKEN` en el encabezado. El simulador de compra y la tarjeta del movimiento muestran los céntimos del monto convertido desde dólares. (#43)
- **Respaldo en la nube apagado por defecto.** Solo se activa con `CLOUD_SYNC=true`; apagado, la app oculta esa sección de Ajustes y no sincroniza. (#42)
- **Calidad del código vigilada por herramientas.** ESLint (funciones cortas, complejidad limitada, nombres claros, sin código muerto), Prettier y pruebas de arquitectura que fallan si una capa importa lo que no debe. Todo corre en el CI; un cambio que solo toca documentación (`.md`, `docs/` o `LICENSE`) corre únicamente la guardia de privacidad. (#14)
- **Pruebas por capa** (dominio, aplicación, infraestructura, interfaz, contrato, arquitectura y API), con casos de error de conexión, datos inválidos y fallos a mitad de una escritura, más un benchmark reproducible (`npm run bench`) y un dataset sintético (`npm run dataset`).
- **Privacidad de los datos de prueba.** Los correos de ejemplo están anonimizados por completo, y una prueba automática (`tests/privacy`) revisa que no se cuele ningún dato real. Guía en `docs/CONTRIBUIR.md`.
- **Despliegue.** Docker Compose con Caddy (HTTPS automático), API, Redis y MongoDB; la imagen compila la app con Vite. Guía en `docs/DESPLIEGUE.md`, con la configuración de Google Cloud paso a paso. En desarrollo, `npm run dev --prefix server` carga el `.env` de la raíz si existe. (#40, #43)
- **Documentación de los datos.** `docs/ARQUITECTURA.md` describe el modelo de SQLite, las claves de Redis con su vencimiento y la decisión de MongoDB (un documento por registro, con el contenido embebido). Bitácora del primer seguimiento en `docs/seguimientos/S1.md`. (#46)
- **Backlog e issues.** `docs/BACKLOG.md` reparte las tareas por integrante, y `npm run issues` (`scripts/create-issues.mjs`) crea en GitHub las etiquetas, los hitos y los issues a partir de ese archivo, sin duplicar al volver a ejecutarlo. (#14, #39)
