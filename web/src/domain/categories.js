// Categorías de gasto y la forma de asignarlas automáticamente.

import { CategoryOrigin, Direction, TransactionType } from './types.js';
import { normalizeKey } from './names.js';

export const CATEGORIES = Object.freeze({
  super: { name: 'Súper', color: '#0E9E74' },
  comida: { name: 'Comida', color: '#E07A22' },
  transporte: { name: 'Transporte', color: '#2F7CF6' },
  servicios: { name: 'Servicios', color: '#8B5CF6' },
  salud: { name: 'Salud', color: '#E0457B' },
  ocio: { name: 'Ocio', color: '#C9930E' },
  transfer: { name: 'Transferencias', color: '#5A33E6' },
  ingreso: { name: 'Ingresos', color: '#0E9E74' },
  propias: { name: 'Entre mis cuentas', color: '#6B7A90' },
  otros: { name: 'Otros', color: '#8A8799' },
});

export const FALLBACK_CATEGORY = 'otros';

/** Categorías que Movo asigna sola según cómo cuenta el movimiento: la persona no las elige a mano. */
export const AUTOMATIC_ONLY_CATEGORY_KEYS = ['ingreso', 'propias'];

export const getCategory = (key) => CATEGORIES[key] ?? CATEGORIES[FALLBACK_CATEGORY];

/** Palabras que aparecen en el nombre del comercio. El orden importa: gana la primera que coincide. */
const KEYWORD_RULES = [
  ['super', /\b(SUPER|MERCADO|PALI|MAXI ?PALI|WALMART|FRESH|PRICESMART|AUTOMERCADO|MAS X MENOS)/],
  ['transporte', /\b(UBER|DIDI|SERVICENTRO|GASOLINERA|PARQUEO|PEAJE|TAXI|BUS|RITEVE|DEKRA)/],
  ['comida', /\b(SODA|PIZZA|CAFE|REST|BURGER|POLLO|PANADER|SUSHI|ALMUERZO|CENA|DESAYUNO|KFC|MCDONALD|STARBUCKS)/],
  ['salud', /\b(FARMACIA|CLINICA|HOSPITAL|LABORATORIO|DENT|OPTICA|CCSS)/],
  ['ocio', /\b(NETFLIX|SPOTIFY|CINE|STEAM|TEATRO|DISNEY|HBO|PLAYSTATION|XBOX|ANTHROPIC|OPENAI|YOUTUBE)/],
  ['servicios', /\b(ICE|KOLBI|CNFL|AYA|TELECABLE|INTERNET|ELECTRIC|LIBERTY|CLARO|TIGO|MUNICIPALIDAD)\b/],
];

/**
 * Decide la categoría de un movimiento. Orden de prioridad:
 * 1. Entre mis cuentas e ingresos tienen categoría fija.
 * 2. Las reglas que la persona creó.
 * 3. Palabras clave del comercio.
 * 4. Por tipo: un SINPE sin pistas es una transferencia; lo demás es "otros".
 *
 * @param {{counterparty: string, type: string, direction: string, userRules?: Array<{counterpartyKey: string, category: string}>}} movement
 * @returns {{category: string, origin: string}}
 */
export function categorize({ counterparty, type, direction, userRules = [] }) {
  if (direction === Direction.OWN_TRANSFER) return { category: 'propias', origin: CategoryOrigin.SAME_HOLDER };
  if (direction === Direction.INCOME) return { category: 'ingreso', origin: CategoryOrigin.AUTOMATIC };

  const key = normalizeKey(counterparty);
  const userRule = userRules.find((rule) => rule.counterpartyKey && key.includes(rule.counterpartyKey));
  if (userRule) return { category: userRule.category, origin: CategoryOrigin.USER_RULE };

  const keywordRule = KEYWORD_RULES.find(([, pattern]) => pattern.test(key));
  if (keywordRule) return { category: keywordRule[0], origin: CategoryOrigin.AUTOMATIC };

  const fallback = type === TransactionType.SINPE ? 'transfer' : FALLBACK_CATEGORY;
  return { category: fallback, origin: CategoryOrigin.AUTOMATIC };
}
