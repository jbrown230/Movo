// Caso de uso: leer un correo del banco y registrar sus movimientos.

import { parseMail } from '../domain/emailParser/parseMail.js';
import { categorize } from '../domain/categories.js';
import { CURRENCY_SYMBOL, isForeignCurrency, toColonesCents } from '../domain/money.js';
import { transactionIdForMail } from '../domain/ids.js';
import { MailStatus } from '../domain/types.js';

/** Resultado de ingestMail cuando el correo ya se había leído antes. */
export const DUPLICATE_MAIL = 'duplicado';

const declinedNote = (item) =>
  `El banco marcó la transacción como "${item.status || 'negada'}" ` +
  `(${item.counterparty}, ${CURRENCY_SYMBOL[item.currency] ?? ''}${(item.amountCents / 100).toFixed(2)}). ` +
  'No se registra como gasto.';

/**
 * @typedef {Object} IngestResult
 * @property {'duplicado'|'registrado'|'sin_movimiento'|'negada'} status
 * @property {import('../domain/types.js').Transaction} [transaction]   El primer movimiento registrado.
 * @property {import('../domain/types.js').Transaction[]} [transactions] Todos los movimientos registrados.
 */

/** El correo tal como se guarda en la bandeja. */
function toMailRecord(mail, bank, { status, template = null, transactionId = null, note = null }) {
  return {
    id: mail.id,
    messageId: mail.messageId || null,
    bank,
    fromAddress: mail.from || null,
    fromName: mail.fromName || null,
    subject: mail.subject || '',
    body: mail.body || '',
    receivedAt: mail.date || new Date().toISOString(),
    status,
    template,
    transactionId,
    note,
  };
}

/** El movimiento nuevo que sale de una fila leída del correo. */
function toNewTransaction({ id, item, bank, mailKey, categorization, exchangeRatesOn }) {
  const rate = isForeignCurrency(item.currency) ? exchangeRatesOn(item.date)[item.currency] || 0 : null;
  return {
    id,
    date: item.date,
    amountCents: item.amountCents,
    currency: item.currency,
    crcCents: toColonesCents(item.amountCents, item.currency, rate),
    exchangeRate: rate,
    counterparty: item.counterparty,
    category: categorization.category,
    categoryOrigin: categorization.origin,
    type: item.type,
    direction: item.direction,
    bank,
    mailKey,
    note: item.note,
  };
}

export function createIngestMail({ transactions, mails, rules, atomically }) {
  const saveMail = (mail, bank, outcome) => mails.insert(toMailRecord(mail, bank, outcome));

  /** Crea el movimiento de una fila del correo (si no existe ya) y devuelve su id. */
  function registerItem({ item, rowIndex, bank, mailKey, userRules, exchangeRatesOn }) {
    const id = transactionIdForMail(mailKey, rowIndex);
    if (transactions.exists(id)) return id;

    const categorization = categorize({
      counterparty: item.counterparty,
      type: item.type,
      direction: item.direction,
      userRules,
    });
    transactions.insert(toNewTransaction({ id, item, bank, mailKey, categorization, exchangeRatesOn }));
    return id;
  }

  /** Registra las filas aprobadas de un correo y guarda el correo como "registrado". */
  function registerApprovedItems({ mail, parsed, exchangeRatesOn }) {
    const mailKey = mail.messageId || mail.id;
    const userRules = rules.list();
    const transactionIds = [];
    parsed.items.forEach((item, rowIndex) => {
      if (item.declined) return;
      transactionIds.push(registerItem({ item, rowIndex, bank: parsed.bank, mailKey, userRules, exchangeRatesOn }));
    });

    const declinedCount = parsed.items.filter((item) => item.declined).length;
    saveMail(mail, parsed.bank, {
      status: MailStatus.REGISTERED,
      template: parsed.template,
      transactionId: transactionIds[0],
      note: declinedCount ? `${declinedCount} transacción(es) negada(s) en este correo no se registraron.` : null,
    });

    const registered = transactionIds.map((id) => transactions.get(id));
    return { status: MailStatus.REGISTERED, transaction: registered[0], transactions: registered };
  }

  /**
   * Lee un correo y registra sus movimientos. Es idempotente: el mismo correo
   * nunca crea movimientos repetidos.
   *
   * - Un correo puede traer varias transacciones (tabla de tarjeta del BCR).
   * - Las transacciones "Negadas" no se registran como gasto.
   * - Si no se encuentra un monto, el correo queda como "sin movimiento" para revisarlo.
   *
   * @param {import('../domain/types.js').IncomingMail} mail
   * @param {{ exchangeRatesOn?: (dateIso: string) => Object<string, number|null> }} [options]
   *   Colones por dólar y por euro (`{ USD, EUR }`) para el día de cada compra. Una compra en una moneda
   *   sin tipo de cambio queda en 0 colones hasta que llegue uno.
   * @returns {IngestResult}
   */
  return function ingestMail(mail, { exchangeRatesOn = () => ({}) } = {}) {
    if (mails.exists({ id: mail.id, messageId: mail.messageId || null })) return { status: DUPLICATE_MAIL };

    const parsed = parseMail(mail);

    return atomically(() => {
      if (!parsed.ok) {
        saveMail(mail, parsed.bank, { status: MailStatus.NO_MOVEMENT, note: parsed.reason });
        return { status: MailStatus.NO_MOVEMENT };
      }

      if (parsed.items.every((item) => item.declined)) {
        const outcome = { status: MailStatus.DECLINED, template: parsed.template, note: declinedNote(parsed.items[0]) };
        saveMail(mail, parsed.bank, outcome);
        return { status: MailStatus.DECLINED };
      }

      return registerApprovedItems({ mail, parsed, exchangeRatesOn });
    });
  };
}
