# Lector por reglas contra un modelo de lenguaje

Issue 30 del [backlog](BACKLOG.md), semilla del TFG. La pregunta es si un modelo de lenguaje (Claude) lee las notificaciones bancarias mejor que el lector por reglas de Movo, y a qué costo y con qué tiempo.

**Estado:** el conjunto de evaluación, la calificación y el lector por reglas están medidos. La parte del modelo de lenguaje queda **documentada, sin ejecutar**: por decisión del equipo, en este proyecto el issue se entrega como documentación. El extractor con Claude está escrito y probado sin red, de modo que la medición se puede correr con un solo comando si se retoma en el TFG (sección 6). Correrla necesita créditos de la API de Anthropic, que se pagan aparte de una suscripción a Claude.

- Conjunto de evaluación: [`tests/fixtures/parserEvalSet.js`](../tests/fixtures/parserEvalSet.js).
- Calificación: [`scripts/parser-vs-llm/grade.mjs`](../scripts/parser-vs-llm/grade.mjs).
- Extractor con Claude: [`scripts/parser-vs-llm/llmExtractor.mjs`](../scripts/parser-vs-llm/llmExtractor.mjs).
- Comando: [`scripts/parser-vs-llm.mjs`](../scripts/parser-vs-llm.mjs), que se corre con `npm run comparar-lector`.
- Pruebas (sin red): [`tests/evaluation/parserEvalSet.test.js`](../tests/evaluation/parserEvalSet.test.js).

## 1. Conjunto de evaluación

41 correos con la respuesta correcta escrita a mano. Todos son ficticios o están anonimizados, y la prueba de `tests/privacy` revisa el archivo como a los demás fixtures.

| Grupo | Correos | Qué prueba |
|---|---|---|
| Real | 13 | Estructura de correos reales de BAC, BN y BCR: compras en colones y dólares, compras rechazadas, SINPE enviado, recibido y a uno mismo, texto plano y una tabla del BCR con tres filas (una negada). |
| Variación | 10 | El mismo correo real con un cambio que un banco podría hacer en un rediseño: "Importe" en vez de "Monto", fecha 18/10/2026 en vez de Oct 18, 2026, `₡15.000,00`, campos en otro orden, "MONTO TOTAL", voucher en inglés, otra redacción del SINPE y columnas reordenadas. |
| Sin movimiento | 6 | Correos de bancos que traen montos pero no son un movimiento: publicidad, estado de cuenta, recordatorio de pago, código de verificación, cambio de clave y boletín. Lo correcto es no devolver nada. |
| Sin plantilla | 5 | Correos de Davivienda y Promerica con **formatos inventados**, distintos de los que Movo conoce. Cuando se armó el conjunto no había correos reales de esos bancos. Movo ya lee los formatos reales de Davivienda (#27), pero estos dos no se parecen a ellos, así que siguen midiendo lo mismo: qué pasa cuando un banco usa un formato que el lector nunca vio. |
| Demo | 7 | Correos del generador sintético de la demo, en colones, dólares y euros, con ingresos y una compra negada. |

Cada movimiento esperado tiene tipo (`sinpe`, `tarjeta` o `transferencia`), dirección (`out`, `in` o `self`), moneda, monto, contraparte, fecha y si el banco lo negó. Cuando el correo no dice la contraparte, como en el SINPE de BAC, esa contraparte no se califica.

## 2. Cómo se califica

- **Correo bien:** el extractor devuelve exactamente los movimientos esperados, con todos sus campos correctos. Es la métrica principal.
- **Por campo:** porcentaje de movimientos esperados con ese campo correcto. Un correo que no se leyó cuenta como error en todos sus campos.
- **Reglas de comparación:**
  - El monto debe coincidir al céntimo y con la misma moneda.
  - La fecha se compara al minuto, porque unos correos traen segundos y otros no.
  - La contraparte se compara como la muestra la app (`displayName`): sin mayúsculas de por medio, sin tildes, sin código de país y sin números largos.
- **Tres tipos de error:**
  - **Error silencioso:** el extractor devolvió movimientos, pero con algo mal. Es el peor error, porque nadie se entera.
  - **Movimiento inventado:** leyó un movimiento en un correo que no trae ninguno.
  - **Correo sin leer:** el correo traía un movimiento y no devolvió nada. En la app, ese correo queda como "Sin movimiento" y la persona lo puede revisar.

## 3. Cómo lee el modelo

- **Modelo:** `claude-opus-5-5` por defecto. Se puede elegir otro con `--llm`, por ejemplo `claude-haiku-5-5` para comparar costos.
- **Esfuerzo:** `low` por defecto, porque es una extracción corta. Se cambia con `--effort`.
- **Instrucciones:** en español, con las reglas de la sección 1: qué es un movimiento, qué no lo es, los formatos de monto y que la hora es la de Costa Rica. No incluyen ejemplos del conjunto de evaluación.
- **Respuesta:** JSON con esquema fijo (`output_config.format`), con los mismos campos que las etiquetas. Así no hay que interpretar texto libre.
- **Fecha:** el modelo devuelve la hora local tal como la escribe el correo, y el script la pasa a UTC (UTC−6). Así se evita pedirle al modelo que haga la cuenta de la zona horaria.
- **Negativas:** en Opus y Sonnet se activa el reintento del lado del servidor (`fallbacks: "default"`) por si el modelo se niega a responder. Una negativa final, una respuesta cortada o un JSON inválido cuentan como correo sin leer.
- **Resultados guardados:** cada corrida queda en `docs/parser-vs-llm/<modelo>-<esfuerzo>.json`, con la respuesta, los tokens y el tiempo de cada correo. Volver a generar el informe no cuesta nada.

## 4. Resultados: lector por reglas

`npm run comparar-lector`:

| Grupo | Bien |
|---|---|
| Real | 13 / 13 |
| Variación | 6 / 10 |
| Sin movimiento | 6 / 6 |
| Sin plantilla | 0 / 5 |
| Demo | 7 / 7 |
| **Total** | **32 / 41 (78,0 %)** |

| Monto | Dirección | Tipo | Fecha | Contraparte | Negada |
|---|---|---|---|---|---|
| 81,1 % | 83,8 % | 83,8 % | 81,1 % | 76,5 % | 83,8 % |

- **Tiempo:** unos 10 µs por correo en una laptop de desarrollo.
- **Costo:** cero. Corre en el teléfono, sin red.
- **Movimientos inventados:** 0. Ningún correo de publicidad, saldo o código se leyó como gasto.
- **Correos sin leer:** 6. Son cuatro de los cinco con formato desconocido y dos variaciones (`Importe`, voucher en inglés). El quinto, una transferencia de Davivienda, sí se leyó, pero mal (ver abajo).
- **Errores silenciosos:** 3.

| Caso | Qué pasó |
|---|---|
| `bac-sinpe-moneda-codigo` | El SINPE dice "por un monto de CRC 5,000.00" en vez de "5,000.00 Colones". El lector lee **₡5** en vez de ₡5.000. |
| `bac-compra-orden-distinto` | El comercio cambia de etiqueta y de lugar. La plantilla real de BAC ya no lo reconoce y lo toma la plantilla sintética de la demo, que guarda la compra con contraparte "SIN NOMBRE" y **la fecha de hoy**. |
| `davivienda-transferencia-recibida` | Ninguna plantilla de Davivienda reconoce este formato inventado, pero la plantilla sintética del SINPE del BN (de la demo) sí. Acierta el monto, la fecha y la dirección, pero pierde la contraparte. |

Lectura: el lector es exacto y gratis con los formatos que conoce, y nunca inventa movimientos en publicidad. En cambio, es frágil ante cambios pequeños de formato, y a veces falla en silencio en vez de no leer. Dos de los tres errores silenciosos vienen de las plantillas sintéticas de la demo, que aceptan textos que las plantillas reales rechazan. Esa fragilidad es justamente donde se espera que un modelo de lenguaje sea mejor, y es lo que la comparación con el modelo confirmaría o descartaría.

## 5. Resultados: modelo de lenguaje

**No se ejecutó**, por decisión del equipo: en este proyecto la comparación queda documentada. La tabla muestra qué se completaría con la salida de `npm run comparar-lector` si se corre (sección 6):

| | Lector por reglas | Claude Opus 5.5 (low) | Claude Haiku 5.5 (low) |
|---|---|---|---|
| Correos bien | 32 / 41 | — | — |
| Variación | 6 / 10 | — | — |
| Sin plantilla | 0 / 5 | — | — |
| Errores silenciosos | 3 | — | — |
| Movimientos inventados | 0 | — | — |
| Tiempo por correo | 10 µs | — | — |
| Costo por 1.000 correos | US$0 | — | — |

**Costo esperado (estimación, no medición).** Cada correo son unos 900 tokens de entrada: unas 450 palabras de instrucciones más el correo. La salida, contando el razonamiento con esfuerzo bajo, serían unos 300 a 800 tokens. Con los precios de octubre de 2026:

| Modelo | Precio por millón de tokens (entrada / salida) | Estimado por 1.000 correos | Corrida de los 41 correos |
|---|---|---|---|
| Opus 5.5 | US$4 / US$20 | US$10 a 20 | menos de US$1 |
| Haiku 5.5 | US$0,10 / US$0,50 | US$0,25 a 0,50 | unos US$0,02 |

Una persona recibe unas 100 notificaciones al mes. Con Opus serían US$1 a 2 al mes por usuario, y con Haiku, unos 5 céntimos. El tiempo esperado es de 1 a 5 segundos por correo, frente a microsegundos del lector. Son estimaciones: no se midieron.

## 6. Cómo correr la medición si se retoma

1. Crear una cuenta en la consola de desarrolladores de Anthropic (platform.claude.com), cargar saldo prepagado y generar una clave. Una suscripción a Claude (Pro o Max) **no** incluye uso de la API.
2. Correr:

   ```bash
   ANTHROPIC_API_KEY=... npm run comparar-lector -- --llm claude-opus-5-5
   ANTHROPIC_API_KEY=... npm run comparar-lector -- --llm claude-haiku-5-5
   ```

3. Subir al repositorio los JSON de `docs/parser-vs-llm/`, que contienen solo datos ficticios.
4. Completar la sección 5 con el informe y revisar a mano los fallos que lista el comando.

Los correos que se envían a la API son los del conjunto de evaluación, todos ficticios o anonimizados. **Nunca se deben mandar correos reales de usuarios** para esta medición.

## 7. Límites

- **41 correos es poco.** Sirve para ver diferencias grandes, como 0/5 frente a 5/5 en bancos sin plantilla, pero no para afirmar diferencias de pocos puntos. Un correo vale 2,4 puntos del total.
- **El conjunto favorece al lector en "real" y "demo".** El lector se escribió mirando esos mismos correos, así que el 100 % ahí es esperable y no mide cómo generaliza. Los grupos "variación" y "sin plantilla" son los que miden eso.
- **Las variaciones y los formatos desconocidos son inventados.** Imitan cambios plausibles, pero un rediseño real puede ser más grande o más chico. Una prueba más fuerte sería agregar correos reales de un banco que Movo todavía no lee, como Promerica.
- **El modelo no se midió.** Las cifras de costo y tiempo de la sección 5 son estimaciones, no resultados.
- **Las etiquetas son de una sola persona.** Algunas decisiones son discutibles, como si "SUPERMERCADO DE PRUEBA SAN JOSE" incluye la ciudad. Están en el código para que se puedan revisar.
- **Privacidad.** El lector corre en el teléfono y los correos nunca salen de él. Con un modelo en la nube, cada correo bancario de la persona saldría hacia un tercero. Eso cambia la promesa de la app y exigiría consentimiento explícito. Un modelo que corra en el propio teléfono evitaría el problema, pero no entra en esta medición.
- **Sin conexión.** El modelo necesita red. El lector no.

## 8. Siguientes pasos (TFG)

1. Correr la medición (sección 6) y completar la sección 5.
2. Si el modelo gana en "variación" y "sin plantilla", probar un **esquema híbrido**: el lector por reglas primero, y el modelo solo para los correos que el lector no reconoce. El costo bajaría a una fracción, porque casi todos los correos tienen plantilla.
3. Detectar los errores silenciosos del lector, por ejemplo cuando la fecha cae en "hoy" porque no la encontró, o un monto muy distinto al del asunto. Ante esa duda, el correo se manda al modelo o queda para revisión de la persona.
4. Que las plantillas sintéticas de la demo solo lean correos de la demo, para que no tomen correos reales que no entienden.
5. Ampliar el conjunto con correos reales anonimizados de todos los bancos que lee Movo, incluidos Davivienda y Banco Popular.
