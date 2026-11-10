# Cambios

## Sin publicar

### Corregido

- **BN y Davivienda ya no cuentan una moneda desconocida como colones.** Un voucher del BN con `TOTAL: GBP 15.00`, o un aviso de Davivienda con `Monto: 15.00 GBP`, se registraba como ₡15; ahora queda como "Sin movimiento" para registrarlo a mano, como ya pasaba en el BCR, BAC y Banco Popular. Sale del roadmap a 1 mes. (#105)
- **Exportar a Excel funciona sin conexión** desde la primera vez. ExcelJS es una pieza aparte que el service worker solo guardaba al usarla con Internet; ahora la compilación escribe en `sw.js` la lista de todos los archivos de la app (`scripts/precache.mjs`) y el service worker los guarda al instalarse, y borra los de versiones anteriores. (#101)
- **Al refrescar, la app se queda en la misma pestaña.** La pestaña va en la dirección (`#movimientos`, `#bandeja`, `#ajustes`, `#metas`), así que refrescar la conserva y el botón Atrás del navegador o del teléfono vuelve a la anterior. (#102)

### Agregado

- **Roadmap a 1 mes** en el README, como pide el enunciado (1 mes, 6 meses y TFG), y la documentación de MongoDB incluye las metas de ahorro entre lo que se respalda. (#99)
- **Ficha del portal** `portal.yml` en la raíz, con los datos del grupo para el portal de proyectos del curso. (#99)
- **Carga con mongosh:** `npm run seed:mongosh` corre `scripts/mongo/cargar.mongosh.js` contra `MONGO_URL` del `.env`: pone el validador `$jsonSchema` y los índices, carga datos sintéticos reproducibles y muestra el resumen con un aggregation pipeline. (#99)
- **Script para recrear la base SQLite:** `npm run db:sqlite` aplica las migraciones de la app y lee correos sintéticos en `data/movo.sqlite`. Los `.sqlite` y `.db` ya no se pueden versionar por error (`.gitignore`). (#99)
- **Resumen del respaldo** en `GET /api/backup/summary`: cuántos movimientos, reglas, ajustes y metas guarda la persona, cuántos están eliminados y cuándo fue el último cambio. Lo calcula MongoDB con un aggregation pipeline (`$match` por `userId` → `$group` por `kind`) y se guarda en Redis como un hash que se invalida en cuanto una sincronización guarda algún cambio o la persona borra su respaldo. (#96)
- **Mediciones de SQLite y MongoDB** con `npm run bench:sqlite` y `npm run bench:mongo`: el plan de cada consulta (`EXPLAIN QUERY PLAN` y `explain("executionStats")`) y sus tiempos con y sin índices, el respaldo de la base local con `db.export()` y el resumen con y sin Redis. Mediana de 3 corridas de 5 ejecuciones; resultados en `docs/MEDICIONES.md`. (#96)

### Cambiado

- **El límite de solicitudes por minuto usa una ventana deslizante** en un sorted set de Redis, en vez de un contador por minuto del reloj: ya no se puede hacer el doble del límite entre el final de un minuto y el inicio del siguiente. (#96)

### Documentación

- **SQLite a 100, 10.000 y 100.000 correos** en `docs/MEDICIONES.md`: ingesta, resumen del mes, consultas y tamaño de la base a tres escalas, con y sin índices, para responder qué cambia al crecer. (#31)
- **Promerica descartado:** sin correos reales no se puede escribir su plantilla. El README ya no lo anuncia para el próximo mes y dice que no se lee. (#30)
- **Tareas por motor** en `docs/ARQUITECTURA.md` (las tres estructuras de Redis y la invalidación de la caché) y cuatro decisiones nuevas en `docs/decisiones.md`. (#96)

- **Pruebas documentadas por caso** en `docs/PRUEBAS.md`: cómo correrlas y las 336 pruebas agrupadas en caso normal, error de conexión y datos inválidos, con el archivo de cada una y qué comprueba. Incluye cuáles usan Redis y MongoDB de verdad y cómo activarlas en local. (#94)
- **Decisiones técnicas en un solo lugar** en `docs/decisiones.md`: 27 decisiones reunidas de `docs/ARQUITECTURA.md`, `docs/MEDICIONES.md` y las bitácoras S1 a S4, cada una con qué se decidió, las alternativas descartadas, por qué y su costo. (#94)

## v0.9.0

Release candidate: la app publicada en su dominio con un landing propio, la guía de despliegue completa y una corrección de la lectura de Gmail para los bancos nuevos.

### Lector de notificaciones

- **La lectura de Gmail vuelve a revisar el historial cuando cambia la búsqueda.** Cada lectura pide a Gmail solo los correos posteriores a la última lectura del dispositivo, pero no recordaba con qué búsqueda leyó. Cuando una versión nueva agregaba un banco a la búsqueda por defecto (como pasó con Banco Popular), los dispositivos que ya habían leído antes nunca pedían los correos viejos de ese banco, y la única salida era borrar los datos del dispositivo. Ahora la app anota con qué búsqueda hizo cada lectura (`last_scan_query`) y, si es otra, vuelve a revisar los últimos 45 días; los correos ya leídos no se descargan otra vez. Editar "Bancos que se leen" ya lo hacía; esto cubre también los cambios de la búsqueda por defecto. La primera lectura después de actualizar revisa los 45 días una vez en cada dispositivo. (#79)

### Landing y despliegue

- **Landing de Movo** (`landing/`). Sitio estático aparte de la app, sin código compartido con `web/`: portada con una escena 3D (Three.js) del logo y avisos bancarios que orbitan y caen hacia él, "Cómo funciona" con el teléfono que pasa por Recibido, Leído, Extraído y Registrado al desplazarse, diagrama de arquitectura (los correos se quedan en el teléfono; al servidor solo pasan el token y el respaldo), capturas de la app con marco de iPhone, tecnología, equipo y enlaces a la demo. Respeta `prefers-reduced-motion` y sin JavaScript el texto se lee igual. Los datos que muestra son ficticios. `npm run landing` y `npm run landing:build`. Se corrigieron las letras cortadas de los titulares, los avisos que quedaban al revés, los enlaces del pie que no se podían tocar y la cantidad de avisos en el teléfono (6 en vez de 22).
- **Despliegue en `movocr.xyz`.** `deploy/update.sh` compila también el landing, y `deploy/nginx-movo-landing.conf.example` lo sirve en un hostname aparte: el landing en `movocr.xyz` y la app en `app.movocr.xyz`, adonde apuntan los enlaces a la demo.
- **Guía de despliegue completa** (`docs/DESPLIEGUE.md`), también como sección "Despliegue" del landing: la consola de Google Cloud paso a paso (Gmail API, pantalla de consentimiento, ID y secreto del cliente, problemas comunes), cómo sacar el token del BCCR, el `.env` completo (`CLOUD_SYNC`, `RATE_LIMIT_PER_MIN`, `FX_FALLBACK`, `NIO_PER_USD`), la variante para un VPS que ya usa Nginx y la actualización con git.

### Privacidad

- **La guardia de privacidad también busca IPs de servidores.** `tests/privacy/noSensitiveData.test.js` falla si aparece una dirección IPv4 (salvo localhost y los rangos de documentación) o un hostname de sslip.io o nip.io con una IP. Corre en el CI en cada pull request.

### Documentación

- **Bitácora del seguimiento 4** en `docs/seguimientos/S4.md`: estado del release candidate, lo completado después de `v0.3.0`, lo que sigue pendiente del enunciado y por motor, decisiones y responsables.
- **Banco Popular en el backlog y en el README.** La plantilla entró en `v0.3.0` (#77) sin issue propio; ahora tiene su issue cerrado (#91), su tarea en `docs/BACKLOG.md` y aparece en la hoja de ruta del README. El backlog marca como hechas la publicación de releases (#17) y el aviso oculto del modo demo (#34).

## v0.3.0

Integración: un banco más (Banco Popular) y el córdoba, la pestaña Movimientos con exportación a Excel, alertas de presupuesto y metas de ahorro, todo respaldado en MongoDB.

### Lector de notificaciones

- **Plantillas reales de Banco Popular.** El lector reconoce la compra con tarjeta de crédito (en colones, dólares o córdobas; el comercio trae la ciudad y el país, y el nombre que se muestra quita el país, también "NI") y el comprobante de SINPE enviado o recibido (débito = gasto, crédito = ingreso; mismo titular = entre mis cuentas; quita los "_" con que el banco escribe los nombres). Los avisos de movimiento en la cuenta y de débito en tiempo real (DTR) no se leen para no contar dos veces el mismo dinero. Gmail busca también `bpdc.fi.cr` y `bancopopularinforma.fi.cr`. Las ayudas para leer "Etiqueta: valor" se comparten entre Davivienda y Banco Popular (`labeledFields.js`). La prueba de privacidad revisa también los nombres de los comprobantes de Banco Popular.
- **Compras en córdobas nicaragüenses.** Una compra con tarjeta del BCR cuya moneda decía "CORDOBA ORO" se registraba como colones (el lector devolvía colones para cualquier moneda que no reconocía), así que 300 córdobas quedaban como ₡300. Ahora hay una moneda nueva, `NIO` (símbolo C$), que se detecta por "CORDOBA ORO", córdobas, NIO o C$. El BCCR no publica el córdoba: el servidor lo convierte pasando por el dólar (colones por dólar del BCCR entre los córdobas por dólar de ese día), con la tasa oficial de cada día que lee del servicio web del Banco Central de Nicaragua, sin que nadie tenga que actualizar nada a mano. Si ese servicio no responde, usa la tasa oficial fija de 2026 (`NIO_PER_USD`, 36,6243). `/api/fx` devuelve `nio` (con su fuente) y el valor de cada día, para convertir cada compra con el tipo de cambio de su día. En las tarjetas del BCR, una moneda que Movo no sabe convertir (libra, peso, etc.) ya no se cuenta como colones: esa fila no se lee y el correo queda como "Sin movimiento". Los lectores de BAC, BN y Davivienda todavía leen una moneda desconocida como colones. (#71)

### Funciones de la app

- **Pestaña Movimientos con búsqueda y hoja de filtros.** Los movimientos pasan del final del inicio a su propia pestaña en la barra de abajo (que ahora muestra solo el nombre de la pestaña activa, para que las cuatro quepan en un teléfono angosto). Trae un buscador por comercio o persona (en SQLite, sin distinguir mayúsculas), un selector de tipo (Todos, Gastos, Ingresos y Mis cuentas) y un botón de filtros con el número de filtros puestos. La hoja de filtros sube desde abajo: período (este mes, mes pasado, este año o un rango propio), categoría y, plegados en "Más filtros", banco y monto; un botón fijo dice cuántos movimientos quedan y "Limpiar" restablece los filtros. Las listas son un selector propio (`Dropdown`) con el diseño de la app, y las categorías llevan su ícono. El inicio muestra los últimos 5 movimientos y "Ver todos"; tocar una categoría del inicio abre Movimientos filtrada por ella en el mes. Reemplaza el panel de filtros del inicio de la v0.2.0 (#37). (#72)
- **Exportar a un Excel con el diseño de Movo.** La exportación sale de Ajustes y pasa a la pestaña Movimientos, y exporta lo que se ve en la lista, con los mismos filtros. El formato principal es un Excel (.xlsx) con la estructura de los reportes de billardOS en los colores de Movo: título y franja morada, cuatro tarjetas de resumen (gastos, ingresos, entre mis cuentas y balance), tabla con encabezado oscuro y filas alternadas, ingresos en verde, fecha y montos como valores reales, y una franja final con el balance; la hoja es horizontal y se ajusta a la página al imprimir. El CSV de la v0.2.0 (#23) sigue como segunda opción. ExcelJS (938 KB) va en una pieza aparte que solo se descarga al exportar, así que la app no cambia de peso; la primera exportación necesita conexión. (#73)
- **Alertas de presupuesto.** El inicio avisa cuando lo gastado en el mes llega al 80 % del presupuesto ("Cerca del límite") y cuando llega al 100 % ("Presupuesto agotado"), y la barra del presupuesto cambia de color. En Ajustes se puede dar un presupuesto propio a cada categoría de gasto (las que quedan en blanco no tienen límite): avisan igual que el global y su tarjeta en el inicio muestra cuánto llevan de él. El umbral del aviso se elige en Ajustes ("Avisar al llegar al": 50 %, 60 %, 70 %, 80 % o 90 %) y vale para todos los presupuestos. El porcentaje se redondea hacia abajo, así el 79,9 % no avisa del 80 % ni el 99,9 % del 100 %. Los presupuestos por categoría y el umbral se sincronizan con el respaldo (`category_budgets` y `budget_alert_percent`).
- **Metas de ahorro.** El botón "Metas" del inicio abre su propia pantalla (sin agregar una pestaña a la barra de abajo), donde se crea una meta con nombre, monto y fecha límite. Lo ahorrado es lo que entra menos lo que se gasta (los movimientos entre cuentas propias no cuentan), desde el primer día del mes en que se crea la meta hasta su fecha límite. Cada meta muestra lo ahorrado, el porcentaje y cuánto hay que ahorrar al mes para llegar a tiempo, o si ya se logró o venció; arriba se ve cuánto se lleva ahorrado este mes. Las metas se pueden cambiar y eliminar, con confirmación. Se guardan en una tabla nueva de SQLite (`savings_goals`, migración 2) y en el respaldo como un tipo de registro nuevo (`savingsGoals` / `savings_goal`), validado por la API y por MongoDB.
- **Interfaz del celular sin recortes ni zoom.** El buscador cabe con su placeholder completo (el botón de filtros es redondo), el tipo de movimiento es un control segmentado que siempre cabe, y las tarjetas de categoría del inicio quedan dentro del recuadro y se detienen alineadas. La app ya no hace zoom con los dedos ni por doble toque (viewport sin escala, `touch-action` y el gesto de pellizcar cancelado en Safari de iPhone), no muestra barra de desplazamiento, tiene un solo scroll en la hoja de filtros y más espacio entre el título, el buscador y la lista. (#74)

### Documentación

- **Bitácora del seguimiento 3** en `docs/seguimientos/S3.md`: qué se hizo, qué no y qué queda pendiente, punto por punto del enunciado y por motor.

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
