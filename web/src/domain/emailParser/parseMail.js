// Lector de notificaciones bancarias. Módulo puro (sin DOM ni base de datos):
// se usa en la app, en las pruebas y en el benchmark.
//
// Estrategia:
//   1. Detectar el banco por el remitente o por el texto.
//   2. Probar primero las plantillas de ese banco, luego las demás.
//   3. Si ninguna sirve, el correo se ignora: sin plantilla oficial no se adivina (así la
//      publicidad con montos nunca se lee como gasto).
// Un correo puede traer VARIAS transacciones (tabla de tarjeta del BCR), y una
// transacción puede venir "Negada": esas no se registran como gasto.

import { detectBank, detectBankBySender } from '../banks.js';
import { Currency, Direction, TransactionType } from '../types.js';
import { collapseSpaces } from './text.js';
import { TEMPLATES } from './templates/index.js';

/** Súbelo cuando cambie el lector: la app vuelve a leer los correos no reconocidos. */
export const PARSER_VERSION = 8;

const MAX_COUNTERPARTY_LENGTH = 80;

const RECEIVED_MONEY_HINTS =
  /(se le ha acreditado|recibi[oó] (?:una?|el) (?:transferencia|sinpe|dep[oó]sito|pago)|ha recibido (?:una?|el) |le transfirieron|acreditad[oa] a su|dep[oó]sito a su favor|SINPE M[OÓ]VIL RECIBIDO|abono a su cuenta)/i;
const CARD_HINTS = /tarjeta|compra|comercio|autorizaci/i;

/**
 * @typedef {Object} ParsedItem
 * @property {string} type
 * @property {string} direction
 * @property {string} currency
 * @property {number} amountCents
 * @property {string} counterparty
 * @property {string} date
 * @property {boolean} declined
 * @property {string|null} status
 * @property {string|null} note
 */

/** Primera plantilla que reconoce el correo, con sus transacciones sin normalizar. */
function runTemplates(body, bank) {
  const preferred = TEMPLATES.filter((template) => template.bank === bank);
  const others = TEMPLATES.filter((template) => template.bank !== bank);
  for (const template of [...preferred, ...others]) {
    const rawItems = template.parse(body);
    if (rawItems?.some((item) => item.amount > 0)) return { template, rawItems };
  }
  return null;
}

/** Dirección y tipo que se asumen cuando la plantilla no los dice. */
function guessDefaults(text) {
  const isSinpe = /SINPE/i.test(text);
  let type = TransactionType.TRANSFER;
  if (isSinpe) type = TransactionType.SINPE;
  else if (CARD_HINTS.test(text)) type = TransactionType.CARD;

  const direction = RECEIVED_MONEY_HINTS.test(text) ? Direction.INCOME : Direction.EXPENSE;
  return { type, direction };
}

function normalizeItem(rawItem, defaults, mail) {
  const type = rawItem.type || defaults.type;
  const fallbackName = type === TransactionType.SINPE ? 'SINPE MÓVIL' : 'SIN NOMBRE';
  return {
    type,
    direction: rawItem.direction || defaults.direction,
    currency: rawItem.currency || Currency.CRC,
    amountCents: Math.round(rawItem.amount * 100),
    counterparty: collapseSpaces(rawItem.counterparty).slice(0, MAX_COUNTERPARTY_LENGTH) || fallbackName,
    date: rawItem.date || mail.date || new Date().toISOString(),
    declined: Boolean(rawItem.declined),
    status: rawItem.status || null,
    note: rawItem.note || null,
  };
}

/**
 * Lee todas las transacciones de un correo.
 *
 * @param {{from?: string, subject?: string, body?: string, date?: string}} mail
 * @returns {{ok: true, bank: string|null, template: string, items: ParsedItem[]}
 *         | {ok: false, bank: string|null, reason: string}}
 */
export function parseMail(mail) {
  const body = mail.body || '';
  const text = `${mail.subject || ''}\n${body}`;
  let bank = detectBank(mail.from, text);

  const found = runTemplates(body, bank);
  if (!found) return { ok: false, bank, reason: 'No hay una plantilla oficial para este correo.' };

  // Si el remitente identifica otro banco, se respeta; si no, manda la plantilla.
  bank = detectBankBySender(mail.from) ?? found.template.bank;

  const withAmount = found.rawItems.filter((item) => item.amount > 0);
  const defaults = guessDefaults(text);
  return {
    ok: true,
    bank,
    template: found.template.name,
    items: withAmount.map((item) => normalizeItem(item, defaults, mail)),
  };
}

/**
 * Atajo: la primera transacción aprobada del correo, ya aplanada.
 * Lo usan las pruebas y el benchmark.
 */
export function parseFirstApproved(mail) {
  const result = parseMail(mail);
  if (!result.ok) return result;
  const item = result.items.find((candidate) => !candidate.declined);
  if (!item)
    return {
      ok: false,
      bank: result.bank,
      template: result.template,
      declined: true,
      reason: 'El banco negó la transacción.',
    };
  return { ok: true, bank: result.bank, template: result.template, ...item };
}
