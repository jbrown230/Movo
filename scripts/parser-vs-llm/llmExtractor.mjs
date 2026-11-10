// Extractor con un modelo de lenguaje (Claude): lee un correo bancario y devuelve sus movimientos
// en la misma forma que las etiquetas del conjunto de evaluación. Solo para la comparación del
// issue 30: la app no lo usa.
import Anthropic from '@anthropic-ai/sdk';

/** Precio en dólares por millón de tokens (entrada, salida). Fuente: tabla de precios de Anthropic, octubre de 2026. */
export const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Haiku no tiene el respaldo del lado del servidor cuando el modelo se niega a responder. */
const SUPPORTS_FALLBACKS = (model) => !model.startsWith('claude-haiku');

const SYSTEM_PROMPT = `Lees notificaciones de bancos de Costa Rica y extraes los movimientos de dinero que informan.

Reglas:
- Un movimiento es una compra con tarjeta, un SINPE Móvil o una transferencia que ya ocurrió en la cuenta o tarjeta de la persona.
- Publicidad, estados de cuenta, saldos, recordatorios de pago, códigos de verificación y avisos de seguridad NO son movimientos: en ese caso devuelve una lista vacía.
- Un correo puede traer varios movimientos (por ejemplo, una tabla con varias filas): devuélvelos todos.
- type: "sinpe" para SINPE o SINPE Móvil, "tarjeta" para compras con tarjeta, "transferencia" para otras transferencias.
- direction: "out" si el dinero salió de la persona, "in" si le entró, "self" si la persona se envió dinero a sí misma (el nombre del titular del correo coincide con la otra parte).
- currency: "CRC" para colones (₡, CRC, COLONES), "USD" para dólares, "EUR" para euros.
- amount: número en unidades de la moneda, con punto decimal. Ojo con los formatos "15,000.00" y "15.000,00", que son el mismo monto.
- counterparty: el comercio o la persona tal como lo escribe el correo, sin el país ni la ciudad al final. Si el correo no dice el nombre, escribe "".
- date: fecha y hora LOCAL de Costa Rica tal como la escribe el correo, en formato AAAA-MM-DDTHH:mm:ss, sin zona horaria. Si no trae segundos, usa 00.
- declined: true si el banco negó o rechazó la transacción.`;

const MOVEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'direction', 'currency', 'amount', 'counterparty', 'date', 'declined'],
  properties: {
    type: { type: 'string', enum: ['sinpe', 'tarjeta', 'transferencia'] },
    direction: { type: 'string', enum: ['out', 'in', 'self'] },
    currency: { type: 'string', enum: ['CRC', 'USD', 'EUR'] },
    amount: { type: 'number' },
    counterparty: { type: 'string' },
    date: { type: 'string' },
    declined: { type: 'boolean' },
  },
};

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['movements'],
  properties: { movements: { type: 'array', items: MOVEMENT_SCHEMA } },
};

const COSTA_RICA_OFFSET = '-06:00';

/** "2026-10-18T19:15:00" en hora de Costa Rica → ISO en UTC. Si el modelo ya puso zona, se respeta. */
export function toUtcIso(localDate) {
  const hasZone = /([+-]\d{2}:?\d{2}|Z)$/.test(localDate);
  const time = new Date(hasZone ? localDate : `${localDate}${COSTA_RICA_OFFSET}`).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : localDate;
}

/**
 * @param {Object} options
 * @param {string} options.model
 * @param {'low'|'medium'|'high'} options.effort
 */
export function createLlmExtractor({ model, effort }) {
  const client = new Anthropic();

  /** @returns {Promise<{movements: Object[]|null, usage: {input: number, output: number}, ms: number, error?: string}>} */
  return async function extract(mail) {
    const params = {
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { effort, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Remitente: ${mail.from}\nAsunto: ${mail.subject}\n\n${mail.body}`,
        },
      ],
    };
    if (SUPPORTS_FALLBACKS(model))
      Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

    const startedAt = performance.now();
    const response = await client.beta.messages.create(params);
    const ms = performance.now() - startedAt;
    const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

    if (response.stop_reason === 'refusal') return { movements: null, usage, ms, error: 'refusal' };
    if (response.stop_reason === 'max_tokens') return { movements: null, usage, ms, error: 'max_tokens' };
    const text = response.content.find((block) => block.type === 'text')?.text ?? '';
    try {
      const { movements } = JSON.parse(text);
      return { movements: movements.map((movement) => ({ ...movement, date: toUtcIso(movement.date) })), usage, ms };
    } catch {
      return { movements: null, usage, ms, error: 'invalid_json' };
    }
  };
}

export const costOf = (model, usage) => {
  const price = PRICES[model];
  return price ? (usage.input * price.input + usage.output * price.output) / 1e6 : null;
};

export { Anthropic };
