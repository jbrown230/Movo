// Casos de uso: lo que la persona puede hacer con un movimiento.

import { categorize } from '../domain/categories.js';
import { newId } from '../domain/ids.js';
import { normalizeKey } from '../domain/names.js';
import { CategoryOrigin, Currency, Direction, TransactionType } from '../domain/types.js';

const VALID_DIRECTIONS = Object.values(Direction);

export function createTransactionActions({ transactions, mails, rules, atomically }) {
  /** La persona decide cómo contar un movimiento: gasto, ingreso o entre sus cuentas. */
  function setDirection(transactionId, direction) {
    const transaction = transactions.get(transactionId);
    if (!transaction || !VALID_DIRECTIONS.includes(direction)) return null;

    const { category } = categorize({
      counterparty: transaction.counterparty, type: transaction.type, direction, userRules: rules.list(),
    });
    transactions.update(transactionId, { direction, category, categoryOrigin: CategoryOrigin.USER_CHOICE });
    return transactions.get(transactionId);
  }

  /**
   * Cambia la categoría y guarda una regla para ese comercio o persona, así los
   * próximos movimientos se categorizan igual.
   * @returns {number} Cuántos movimientos existentes cambiaron.
   */
  function recategorize(transactionId, category) {
    const transaction = transactions.get(transactionId);
    if (!transaction) return 0;

    const key = normalizeKey(transaction.counterparty);
    return atomically(() => {
      rules.save(key, category);
      const sameCounterparty = transactions
        .listByDirection(transaction.direction)
        .filter((other) => normalizeKey(other.counterparty) === key);
      for (const other of sameCounterparty) {
        transactions.update(other.id, { category, categoryOrigin: CategoryOrigin.USER_RULE });
      }
      return sameCounterparty.length;
    });
  }

  /**
   * Registra un movimiento escrito a mano (efectivo, o un correo que el lector no entendió).
   * Si viene de un correo (`mailId`), el correo queda como registrado.
   */
  function addManualTransaction({
    amountCents, counterparty, category,
    type = TransactionType.CASH, direction = Direction.EXPENSE,
    date = new Date().toISOString(), note = null, mailId = null,
  }) {
    const mail = mailId ? mails.get(mailId) : null;
    const id = newId();

    return atomically(() => {
      transactions.insert({
        id,
        date,
        amountCents,
        currency: Currency.CRC,
        crcCents: amountCents,
        exchangeRate: null,
        counterparty,
        category,
        categoryOrigin: CategoryOrigin.USER_CHOICE,
        type,
        direction,
        bank: null,
        mailKey: mail ? mail.messageId || mail.id : null,
        note,
      });
      if (mailId) mails.markRegistered(mailId, id, 'Registrado a mano.');
      return transactions.get(id);
    });
  }

  /** Elimina el movimiento; su correo queda como descartado para que no reaparezca. */
  function deleteTransaction(transactionId) {
    atomically(() => {
      transactions.softDelete(transactionId);
      mails.discardByTransaction(transactionId, 'Eliminaste este movimiento.');
    });
  }

  return { setDirection, recategorize, addManualTransaction, deleteTransaction };
}
