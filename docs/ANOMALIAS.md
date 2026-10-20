# Detección de cargos anómalos (prototipo)

Issue 31 del [backlog](BACKLOG.md), semilla del TFG. Es un prototipo: el detector existe y está probado, pero **la app todavía no lo usa** ni muestra alertas.

- Detector: [`web/src/domain/anomalies.js`](../web/src/domain/anomalies.js) (módulo puro del dominio, sin base de datos ni interfaz).
- Pruebas: [`tests/domain/anomalies.test.js`](../tests/domain/anomalies.test.js).
- Medición: [`scripts/anomalies.mjs`](../scripts/anomalies.mjs) sobre el dataset de [`scripts/dataset.mjs`](../scripts/dataset.mjs).

```bash
npm run anomalias                    # 30 personas simuladas × 400 correos en 90 días
node scripts/anomalies.mjs 50 600    # más personas o más correos por persona
```

## 1. Qué es una anomalía

Un **gasto** cuyo monto en colones queda **muy por encima** de lo que la persona suele pagar **en ese mismo comercio**.

- Solo se vigilan los cobros de más. Pagar menos de lo usual no es una alerta.
- Los ingresos y los movimientos entre cuentas propias no se juzgan.
- El comercio se reconoce por su nombre limpio (`displayName`), porque cada banco lo escribe a su modo: el BN agrega `CRI` al final.
- Cada movimiento se compara **solo con los anteriores**, como pasaría en el teléfono al llegar el correo.
- Un comercio necesita al menos **5 compras previas** para opinar. Antes de eso el resultado es "sin historial", no "normal".

### Cómo se mide "muy por encima"

1. Los montos se comparan en escala logarítmica: pasar de ₡3.000 a ₡9.000 pesa lo mismo que pasar de ₡30.000 a ₡90.000.
2. Lo típico es la **mediana** del historial y la dispersión es la **desviación absoluta mediana (MAD)**. Las dos son robustas: un cargo raro que ya está en el historial casi no las mueve, cosa que sí pasaría con la media y la desviación estándar.
3. Puntaje z robusto (Iglewicz y Hoaglin): `z = 0,6745 · (log(monto) − mediana) / MAD`.
4. El cargo es anómalo si **z > 3,5** y además supera lo típico en **al menos ₡2.000**. Ese mínimo evita alertas por un café de ₡1.500 que costó ₡3.000.
5. Un cobro fijo, como una suscripción, tiene MAD 0. Para no dividir entre cero, la dispersión mínima es 0,08 (≈ 8 %). Así, Netflix +10 % no es alerta y Netflix cobrado dos veces sí lo es.

Todos estos valores están en `ANOMALY_DEFAULTS` y se pueden cambiar por parámetro.

### Por categoría (opción apagada)

La idea inicial era comparar con la **categoría** cuando el comercio aún no tiene historial. Se implementó como opción (`categoryFallback: true`), pero la medición la descarta: **da más falsos positivos que aciertos** (ver la sección 3). Una categoría mezcla precios muy distintos. En "comida", Pizza Roma (unos ₡12.500) queda como anómala frente a la soda y el café (₡3.000–4.000). En "transporte", el Servicentro (₡25.000) queda como anómalo frente a Uber (₡3.200).

## 2. Dataset

`scripts/dataset.mjs` ahora da a cada comercio un **monto típico, una dispersión y una frecuencia** propios (`SPENDING_PROFILES`). Antes, todos los montos salían al azar entre ₡100 y ₡50.100, sin relación con el comercio, y con eso no se puede definir lo "normal" de cada uno. Acepta semilla (`npm run dataset -- 50 7`) para que la medición sea reproducible.

| Contraparte | Típico | Dispersión (log) | Frecuencia relativa |
|---|---|---|---|
| Súper La Amistad | ₡28.000 | 0,45 | 8 |
| Uber | ₡3.200 | 0,40 | 8 |
| Café Cordillera | ₡2.800 | 0,25 | 7 |
| Soda Doña Rosa | ₡4.200 | 0,20 | 6 |
| Servicentro La Sabana | ₡25.000 | 0,25 | 4 |
| Pizza Roma | ₡12.500 | 0,30 | 3 |
| Farmacia | ₡7.500 | 0,60 | 2 |
| Kölbi prepago | ₡5.000 | 0,15 | 2 |
| Steam | ₡9.000 | 0,50 | 1 |
| Netflix | ₡7.200 | 0 (fijo) | 1 |
| SINPE a cada una de 4 personas | ₡9.000 | 0,80 | 2 c/u |

Cada persona simulada recibe 400 correos en 90 días (unos 4 por día) de BAC, BN y BCR. Los correos pasan por **el lector y las categorías reales** de la app. Todo es en colones.

La medición corre dos veces con las mismas 30 semillas:

1. **Limpia**: ningún cargo raro. Todo lo que se marque es un falso positivo.
2. **Con cargos inflados**: al 2 % de los gastos se le multiplica el monto, con etiqueta. La mitad son **groseros** (×4 a ×10, como un cobro repetido o un monto con ceros de más) y la mitad **moderados** (×2 a ×3).

## 3. Resultados

`npm run anomalias` (30 personas × 90 días = 90 meses-persona, 12.000 gastos):

**Solo comercio (configuración por defecto)**

| Umbral z | FP en la corrida limpia | Alertas falsas por persona al mes | Precisión | Detección | Groseros | Moderados |
|---|---|---|---|---|---|---|
| 2,5 | 2,1 % | 2,37 | 46,3 % | 60,8 % | 74,8 % | 44,3 % |
| 3 | 1,3 % | 1,43 | 56,7 % | 54,4 % | 68,9 % | 37,4 % |
| **3,5** | **0,8 %** | **0,92** | **67,0 %** | **48,8 %** | **65,9 %** | **28,7 %** |
| 4 | 0,5 % | 0,59 | 71,7 % | 43,6 % | 61,5 % | 22,6 % |
| 5 | 0,2 % | 0,26 | 81,7 % | 34,0 % | 51,9 % | 13,0 % |

**Comercio + categoría (`categoryFallback: true`)**

| Umbral z | FP en la corrida limpia | Alertas falsas por persona al mes | Precisión | Detección |
|---|---|---|---|---|
| 3,5 | 2,0 % | 2,40 | 38,9 % | 51,2 % |

FP = falsos positivos, sobre los gastos que se pudieron juzgar. La precisión y la detección salen de la corrida con cargos inflados.

Con el umbral 3,5 y solo comercio:

- **Falsos positivos:** 83 en 9.907 gastos juzgados (0,8 %), menos de **una alerta falsa por persona al mes**. Salen de comercios con mucha variación (Uber 15, Farmacia 10) y de SINPE a personas (27 entre las cuatro). Kölbi y Netflix casi no dan falsos positivos.
- **Sin historial:** 2.093 de 12.000 gastos (17 %) no se pudieron juzgar, y tampoco 46 de los 250 cargos inflados. Son las primeras cinco compras de cada comercio.
- **Tarjeta con historial**, que es donde el método aplica: se detecta el **86,7 % de los groseros** y el **41,6 % de los moderados**.
- **SINPE: 12,2 % de detección.** A una persona se le manda ₡2.000 o ₡40.000 según el día, así que un SINPE inflado ×5 sigue pareciendo normal.
- **Agregar la categoría** sube la detección solo 2,4 puntos (48,8 % → 51,2 %). A cambio, casi triplica los falsos positivos: 133 de 216 vienen de la categoría. Por eso queda apagada.

Elegimos el umbral 3,5 porque es el valor estándar de Iglewicz y Hoaglin y porque deja menos de una alerta falsa al mes. Si se baja a 3, se detecta un 5,6 % más, con un 55 % más de alertas falsas.

## 4. Límites

- **Los datos son sintéticos.** Los montos se generaron con una distribución log-normal, que es justo la que el método supone. Con gastos reales (estacionalidad, compras grandes de una vez, quincenas) la tasa de falsos positivos va a ser mayor. Esta medición es una cota optimista.
- **La precisión depende de cuántos fraudes hay.** Con un 2 % de cargos inflados la precisión es del 67 %. Un fraude real es mucho más raro: con un 0,1 % de cargos anómalos y la misma tasa de falsos positivos, casi todas las alertas serían falsas. Por eso conviene medir en **alertas falsas por mes** y presentar la alerta como "¿reconoces este cargo?", no como "fraude".
- **"Inflado" no es lo mismo que "raro".** La etiqueta multiplica el monto que la compra iba a tener. Si esa compra ya era barata, un ×4 puede quedar dentro de lo normal del comercio: de ahí sale el 13 % de groseros en tarjeta que se escapan. Ningún detector que solo vea montos los puede encontrar.
- **Arranque en frío.** Un comercio nuevo no se juzga hasta su sexta compra, y el fraude típico (un cargo en un comercio que la persona nunca usó) cae justo ahí. Detectarlo pide otras señales: comercio nunca visto, país o moneda extraños, hora inusual o varias compras seguidas en minutos. Ninguna de ellas está en este prototipo.
- **SINPE a personas.** La dispersión es tan grande que el método casi no sirve ahí. Un SINPE a alguien nuevo por un monto alto sería mejor señal.
- **Solo colones.** El detector usa `crcCents`. Una compra en dólares sin tipo de cambio todavía (`crcCents` = 0) se ignora, y el tipo de cambio mueve el monto en colones aunque el monto en dólares sea el mismo.
- **El historial no se limpia.** Un cargo anómalo entra al historial del comercio. La mediana y la MAD lo toleran mientras sean pocos, pero si un cobro de más se repite cada mes, termina pareciendo normal.
- **Nombres de comercio.** Se agrupa por el nombre limpio. Si un banco recorta o cambia el nombre ("UBER *TRIP" frente a "UBER *EATS HELP"), el historial se parte. Las reglas de categoría de la persona no se usan para unir comercios.
- **No se midieron otros parámetros.** El historial mínimo (5), la dispersión mínima (8 %) y el exceso mínimo (₡2.000) quedaron fijos. Medirlos es el siguiente paso.

## 5. Siguientes pasos (TFG)

1. Medir con movimientos reales anonimizados, con la etiqueta "¿reconoces este cargo?" puesta por la persona.
2. Sumar señales de arranque en frío: comercio nunca visto, monto alto en el primer uso, moneda o país distintos y ráfagas de compras.
3. Barrer el historial mínimo, la dispersión mínima y el exceso mínimo junto con el umbral.
4. Si se lleva a la app: correr el detector al leer cada correo, guardar el resultado en el movimiento y mostrarlo como aviso que la persona puede descartar. Al descartarlo, el monto queda como normal.
