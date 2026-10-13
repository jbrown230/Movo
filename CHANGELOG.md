# Cambios

## Sin publicar

- **Tipo de cambio.** El servidor consulta la API del Sistema de Divulgación de Datos Económicos (SDDE) del BCCR, que responde en JSON y se autentica con un token en el encabezado. Reemplaza al servicio web anterior (XML, con correo y token en la dirección). Ya no se usa `BCCR_EMAIL`: basta con `BCCR_TOKEN`.

## v0.1.0

Primera versión pública de Movo.

- **App del teléfono (PWA).** Hecha con React y Vite, instalable, con modo sin conexión (service worker) y modo claro u oscuro. En Ajustes se elige la apariencia: automática (sigue al teléfono), clara u oscura. El código está separado en capas (`domain`, `application`, `infrastructure`, `presentation` y `composition`): ver `docs/ARQUITECTURA.md`.
- **Logo propio:** una M cuyo trazo derecho es una flecha verde que sube ("money" + movimiento), en los colores del degradado de la app. Reemplaza el símbolo ₡ genérico de los íconos y la letra M de texto de la pantalla. Se genera con `scripts/generate-icons.mjs`.
- **Servidor con las mismas capas** (`domain`, `application` y `adapters`). La capa HTTP solo traduce; las reglas viven en casos de uso que se prueban sin Express, MongoDB ni Redis. API documentada en `docs/API.md`.
- **Contrato compartido** (`shared/backupContract.js`): un solo lugar para los nombres y valores permitidos del respaldo, con pruebas de contrato que sincronizan dos teléfonos simulados a través del código real del servidor.
- **Lectura de correos.** Gmail se lee desde el teléfono con permiso de solo lectura, limitado a remitentes bancarios. Los correos nunca se envían al servidor.
- **Lector de notificaciones.**
  - Plantillas con el formato real del BCR: SINPE Móvil enviado y recibido, y la tabla de transacciones con tarjeta (incluida la compra "Negada", que no se registra como gasto).
  - Plantillas sintéticas para BAC y BN (hasta tener correos reales).
  - Un correo puede generar varios movimientos. Las horas se interpretan en hora de Costa Rica (UTC−6).
  - SINPE entre cuentas propias: si el titular es la misma persona en origen y destino, no cuenta como gasto ni como ingreso. Cada movimiento tiene el control "¿Cómo contarlo?".
  - Si el lector mejora, la app vuelve a leer sola los correos que antes no reconocía.
- **Base local.** SQLite en el navegador (sql.js), una base por usuario, con lectura idempotente por Message-ID. Los movimientos eliminados no reaparecen.
- **Categorías y presupuesto.** Categorías automáticas, reglas propias (al corregir una categoría se guarda como regla) y presupuesto mensual. Nombres de comercio limpios para mostrar.
- **Modo demo.** Datos de ejemplo y un simulador de banco: haces un SINPE o una compra y Movo lee el correo que llega.
- **API mínima (Node).** Configuración, tipo de cambio del BCCR con caché en Redis, respaldo opcional por usuario en MongoDB y borrado de datos. Si Redis se cae, sigue funcionando con caché en memoria.
- **Calidad del código vigilada por herramientas.** ESLint (funciones cortas, complejidad limitada, nombres claros, sin código muerto), Prettier y pruebas de arquitectura que fallan si una capa importa lo que no debe. Todo corre en el CI.
- **Pruebas por capa** (dominio, aplicación, infraestructura, interfaz, contrato, arquitectura y API), con casos de error de conexión, datos inválidos y fallos a mitad de una escritura, más un benchmark reproducible (`npm run bench`) y un dataset sintético (`npm run dataset`).
- **Privacidad de los datos de prueba.** Los correos de ejemplo están anonimizados por completo, y una prueba automática (`tests/privacy`) revisa que no se cuele ningún dato real. Guía en `docs/CONTRIBUIR.md`.
- **Despliegue.** Docker Compose con Caddy (HTTPS automático), API, Redis y MongoDB; la imagen compila la app con Vite. Guía en `docs/DESPLIEGUE.md`.
