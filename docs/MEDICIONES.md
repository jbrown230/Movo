# Mediciones

## Efecto de Redis en el tipo de cambio

Issue 17 del [backlog](BACKLOG.md): comparar la latencia de `GET /api/fx` con Redis y sin Redis, con al menos 200 solicitudes, y decidir si Redis justifica su costo operativo.

- Script: [`scripts/bench-fx.mjs`](../scripts/bench-fx.mjs).
- Qué se mide: el tiempo de cada solicitud a la API, desde el cliente, con la API real levantada en el mismo proceso.

```bash
npm run bench:fx            # 200 solicitudes por escenario
npm run bench:fx -- 500     # otra cantidad
```

Necesita `BCCR_TOKEN` en el `.env` y Redis corriendo en `REDIS_URL` (por defecto `redis://localhost:6379`; en local, el contenedor `movo-redis`).

### Escenarios

| Escenario | Qué hace cada solicitud |
|---|---|
| Sin caché (BCCR directo) | Consulta al BCCR cada vez: dos llamadas, dólar (indicador 318) y euro (333), con 67 días de historial. |
| Caché en memoria | Lee el tipo de cambio de la memoria del proceso. Es lo que usa la API cuando no hay Redis. |
| Redis | Lee el tipo de cambio de Redis. Es lo que usa la API en producción. |

En los tres casos la API también suma la solicitud al contador del límite por minuto, igual que en producción, pero sin tope, para que las 200 solicitudes no terminen en 429. La primera solicitud de cada escenario se reporta aparte: con la caché vacía, consulta al BCCR.

### Primer hallazgo: sin caché, el BCCR rechaza las ráfagas

La primera corrida hizo las 200 solicitudes sin caché una tras otra, sin pausa. El BCCR rechazó **181 de 200** con `429 Rate limit is exceeded. Try again in 6 seconds`. Su límite ronda las 40 consultas por minuto, y cada solicitud sin caché le hace dos.

En esos 181 casos la API respondió rápido (mediana de 84 ms), pero con el **valor de reserva** (`FX_FALLBACK` = ₡510) en lugar del tipo de cambio real. Para la persona eso es peor que una respuesta lenta: ve un número equivocado sin saberlo.

Por eso la medición de latencia sin caché espera 3,5 s entre solicitudes, para quedar por debajo del límite y medir lo que de verdad tarda el BCCR.

### Resultados

200 solicitudes seguidas por escenario, el 20 de octubre de 2026, en una computadora con Windows 11, Node 22 y Redis 7 en Docker Desktop. Tiempos en milisegundos.

| Escenario | 1.ª solicitud (caché vacía) | Mediana | p95 | Media | Mín. | Máx. | Falló el BCCR |
|---|---|---|---|---|---|---|---|
| Sin caché (BCCR directo) | 676,9 | **693,9** | **845,6** | 749,7 | 435,5 | 6010,4 | 1 de 200 |
| Caché en memoria | 893,7 | **0,78** | **1,52** | 0,91 | 0,60 | 4,23 | 0 |
| Redis | 662,1 | **2,04** | **2,82** | 2,15 | 1,61 | 4,89 | 0 |

No hubo errores HTTP en ningún escenario. La falla del BCCR sin caché es la solicitud de 6 s: llegó al tiempo máximo de espera de la API y respondió con el valor de reserva.

### Interpretación

- **Lo que cambia la latencia es tener caché, no que sea Redis.** Con cualquier caché, la mediana baja de 694 ms a menos de 3 ms (unas 340 veces menos con Redis) y el p95 baja de 846 ms a menos de 3 ms.
- **Redis es un poco más lento que la memoria:** 2,0 ms contra 0,8 ms de mediana. Leer de la memoria del proceso no sale de él; leer de Redis es un viaje por la red local, aunque sea dentro de la misma máquina. Esa diferencia de 1,3 ms no se nota frente a lo que tarda la conexión entre el teléfono y el servidor.
- **Sin caché, la API depende del BCCR en cada solicitud:** tarda lo que tarde el BCCR (hasta 6 s cuando no responde) y, con más de unas 20 solicitudes por minuto en total, el BCCR empieza a rechazarlas y las personas ven el valor de reserva (ver el primer hallazgo).
- **La primera solicitud** tras vaciar la caché tarda lo mismo en los tres escenarios (unos 0,7–0,9 s), porque las tres consultan al BCCR. Con caché, eso pasa una vez cada 6 horas.

Límites de la medición: el cliente y la API corren en la misma máquina, así que los tiempos no incluyen la red entre el teléfono y el servidor; y las solicitudes van una tras otra, no al mismo tiempo.

### Conclusión: ¿justifica Redis el costo operativo?

**Por latencia, no.** La caché en memoria que la API ya tiene como respaldo es igual de efectiva, incluso un poco más rápida. Lo que no se puede quitar es la caché: sin ella la API es unas 340 veces más lenta y, peor, el límite del BCCR hace que la gente vea un tipo de cambio falso.

**Por robustez, sí, porque cuesta poco.** Redis aporta lo que la memoria no:

- La caché sobrevive a reinicios y despliegues de la API. Con solo memoria, cada reinicio vuelve a consultar al BCCR.
- Si la API corre en más de un proceso o servidor, todos comparten el mismo tipo de cambio y una sola consulta al BCCR cada 6 horas, en vez de una por proceso.
- El límite de solicitudes por minuto y la validación de tokens de Google se cuentan en un solo lugar. Con memoria, cada proceso lleva su propia cuenta y el límite real se multiplica.

Y su costo es bajo: un contenedor más en el `docker-compose.yml`, con la memoria limitada a 64 MB y sin guardar nada en disco. Si Redis se cae, la API sigue funcionando con la memoria (`ResilientCache`), así que no es un punto único de falla.

**Decisión: mantener Redis.** Para un solo servidor con un solo proceso de la API, la caché en memoria bastaría para el tipo de cambio; Redis se justifica por compartir el estado entre reinicios y procesos, no por velocidad.
