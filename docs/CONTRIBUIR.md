# Cómo colaborar en Movo

Esta guía es para quien abre el proyecto por primera vez. Si sabes un poco de JavaScript, puedes leer y cambiar casi todo.

## 1. Preparar el equipo

```bash
npm install
npm install --prefix server
npm run dev        # http://localhost:5173
npm test           # todas las pruebas
```

## 2. Dónde está cada cosa

Lee primero [ARQUITECTURA.md](ARQUITECTURA.md). Resumen: la app (`web/src`) y el servidor (`server/src`) están divididos en capas, y cada capa solo puede usar las de abajo. Una prueba automática lo vigila. La API está descrita en [API.md](API.md).

Antes de escribir código, pregunta:

| Quiero... | Voy a... |
|---|---|
| Cambiar una ruta de la API o su validación | `server/src/adapters/http/` |
| Agregar algo que la API puede hacer | un caso de uso nuevo en `server/src/application/` |
| Cambiar lo que viaja en el respaldo | `shared/backupContract.js`, [API.md](API.md) y las pruebas de `tests/contract` |
| Cambiar cómo se lee un correo | `domain/emailParser/` |
| Agregar una categoría o palabra clave | `domain/categories.js` |
| Agregar algo que la app puede hacer | un archivo nuevo en `application/` |
| Guardar un dato nuevo en SQLite | una migración nueva en `infrastructure/sqlite/migrations.js` y su repositorio |
| Cambiar cómo se ve algo | `presentation/` |

## 3. Reglas de código

La meta es que cualquier persona entienda el código sin ayuda.

- **Nombres que se explican solos.** `transactions.listByDirection(direction)` y no `tx.ld(d)`. Los identificadores van en inglés, y los comentarios y textos de pantalla en español.
- **Una cosa por función.** Si necesitas un comentario para separar partes dentro de una función, esas partes probablemente son funciones distintas.
- **Sin números ni textos mágicos.** `const SAVE_DELAY_MS = 250` y no un `250` suelto. Los valores guardados (`'out'`, `'registrado'`) se usan desde `domain/types.js`.
- **Comentarios que explican el porqué**, no repiten lo que dice el código.
- **Dinero siempre en céntimos** (enteros). Nunca decimales.
- **Respeta las capas.** `domain` no importa nada de React ni de SQL. La interfaz no importa de `infrastructure`: usa `composition/platform.js` y los casos de uso. En el servidor, la capa HTTP no tiene reglas de negocio: llama a un caso de uso.
- **Cada cambio con su prueba.** Una regla nueva en el dominio lleva una prueba en `tests/domain`; un caso de uso, en `tests/application`; algo visual, en `tests/presentation`.

Estas reglas no son solo una guía: ESLint y las pruebas de arquitectura las hacen cumplir.

Comandos de calidad (corren también en el CI):

```bash
npm run lint          # reglas de código: funciones cortas, nombres claros, sin código muerto
npm run lint:fix      # arregla lo que se pueda solo
npm run format        # da formato con Prettier
npm run check         # todo junto: lint, formato, pruebas y compilación
```

Límites de ESLint: funciones de hasta 70 líneas, complejidad 12, 4 parámetros, archivos de hasta 300 líneas, sin nombres de una letra ni ternarias anidadas. Si una función no cabe, divídela: casi siempre significa que hace más de una cosa.

Pruebas por capa:

```bash
npm run test:core    # dominio, aplicación, infraestructura, contrato, arquitectura y privacidad (Node)
npm run test:ui      # interfaz (Vitest + Testing Library)
npm test             # todo, incluida la API
```

## 4. Agregar un banco nuevo

Ejemplo: BN (Banco Nacional). Se hace igual para los demás.

1. **Consigue un correo real** de tu banco. En Gmail: menú ⋮ del correo, "Mostrar original", "Descargar".
2. **Anonimízalo** siguiendo la sección 5. Esto es obligatorio antes de guardarlo en el repositorio.
3. Guarda el HTML anonimizado en `tests/fixtures/bn-html/` y una versión en texto en `tests/fixtures/`.
4. **Escribe la plantilla** en `web/src/domain/emailParser/templates/` (un archivo por formato; usa `bcrSinpe.js` y `bcrCard.js` como modelo).
5. **Regístrala** en `templates/index.js`.
6. **Agrega el remitente** del banco en `domain/banks.js` y en `DEFAULT_GMAIL_QUERY` (`application/preferences.js`).
7. **Escribe las pruebas**: lectura correcta, monto y fecha, ingreso contra gasto, y transacción negada.
8. Sube `PARSER_VERSION` en `emailParser/parseMail.js`: así los teléfonos vuelven a leer los correos que antes no entendían.
9. Corre `npm test`.

## 5. Anonimizar un correo (obligatorio)

El repositorio es público. **Nunca** subas un correo real. Reemplaza, en el texto y también dentro de enlaces (`href="..."`), de cada parte del HTML:

| Dato | Reemplázalo por |
|---|---|
| Tu nombre y el de otras personas (`Estimado (a):`, `Nombre cliente ...`) | `CLIENTE DE PRUEBA`, `PERSONA DESTINO PRUEBA`, `PERSONA ORIGEN PRUEBA` |
| Teléfonos | `80000000` (siempre empiezan con 8000) |
| Número de referencia, autorización, comprobante | ceros: `0000000000000000000000001` |
| Tarjeta y cuentas | `****-****-****-0000` |
| Comercio real donde compraste | un nombre genérico: `SERVICIO DIGITAL SUB 00000000000 US` |
| Fecha y hora real de tu compra | una fecha inventada (por ejemplo, de enero) |
| Direcciones de correo personales | borra la línea |
| Motivo o detalle que escribiste | algo genérico: `prueba SINPE` |

Las direcciones públicas del banco (por ejemplo `mensajero@bancobcr.com`) y el WhatsApp público del banco no son datos personales y se pueden dejar.

Mira que no queden datos escondidos en:

- el enlace `wa.me/...` de los botones de WhatsApp (repite el comercio, el monto y la fecha),
- los atributos `alt`, `title` y `href`,
- los comentarios HTML y el `<title>`.

### La prueba de privacidad

`tests/privacy/noSensitiveData.test.js` revisa los ejemplos, la documentación y el código. Falla si encuentra:

- correos que no sean de ejemplo ni públicos del banco,
- teléfonos que no empiecen con `8000`,
- números largos (referencias, cuentas) que no sean ceros,
- tarjetas con últimos dígitos distintos de `0000`,
- llaves, tokens o contraseñas dentro de una dirección,
- nombres de personas que no estén en su lista de nombres ficticios.

Si falla con un dato real, anonimízalo. Si falla con un dato inventado, agrégalo a la lista de permitidos de esa prueba y explica por qué en el pull request.

## 6. Ramas, commits y pull requests

- Una rama por tarea, con el número del issue: `feat/18-plantilla-bn`, `fix/22-redondeo`.
- Commits pequeños, con un mensaje que diga qué cambió y por qué.
- Todo entra a `main` por pull request, y lo revisa otra persona del equipo (ver el reparto de revisiones en [BACKLOG.md](BACKLOG.md)).
- Antes de abrir el pull request: `npm run check` sin errores.
- Escribe `Closes #número` en la descripción para que el issue se cierre solo.

## 7. Cambiar el logo

El logo se dibuja en `scripts/generate-icons.mjs` (figura, colores y tamaños de cada ícono). Para regenerar los PNG y el SVG de `web/public/icons/`:

```bash
npm install --no-save sharp
node scripts/generate-icons.mjs
```

La versión que se ve dentro de la app está en `web/src/presentation/components/Logo.jsx`; si cambias el dibujo, cámbialo en los dos lugares y sube la constante `VERSION` de `web/public/sw.js` y el número `?v=` de los íconos en `web/index.html` y `web/public/manifest.webmanifest`: así ningún navegador usa la copia vieja que tenga guardada.
