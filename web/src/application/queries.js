// Consultas de solo lectura que usa la interfaz.

import { monthRange } from '../domain/period.js';

export function createQueries({ transactions, mails }) {
  return {
    /** Resumen del mes: gastos por categoría, ingresos y dinero movido entre cuentas propias. */
    getMonthSummary(date = new Date()) {
      const { byCategory, incomeCents, movedBetweenOwnAccountsCents } = transactions.summarizeMonth(monthRange(date));
      const spentCents = byCategory.reduce((sum, row) => sum + row.totalCents, 0);
      return { spentCents, incomeCents, movedBetweenOwnAccountsCents, byCategory };
    },

    listTransactions: (limit) => transactions.list(limit),
    getTransaction: (id) => transactions.get(id),
    countTransactions: () => transactions.countActive(),

    listMails: () => mails.listRecent(),
    getMail: (id) => mails.get(id),
    countMails: () => mails.count(),

    /** Movimientos que salieron de un correo. */
    getTransactionsOfMail: (mail) => transactions.listForMail(mail.messageId || mail.id),
    /** El correo del que salió un movimiento, o null (por ejemplo, si lo escribió la persona). */
    getMailOfTransaction: (transaction) => (transaction.mailKey ? mails.findByMailKey(transaction.mailKey) : null),
  };
}
