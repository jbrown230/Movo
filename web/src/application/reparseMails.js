// Caso de uso: volver a leer correos cuando el lector mejora.

import { parseMail, PARSER_VERSION } from '../domain/emailParser/parseMail.js';
import { categorize } from '../domain/categories.js';
import { transactionIdForMail } from '../domain/ids.js';
import { CategoryOrigin, MailStatus } from '../domain/types.js';
import { DUPLICATE_MAIL } from './ingestMail.js';

const META_PARSER_VERSION = 'parser_version';
const META_EXCHANGE_RATE = 'fx';

export function createReparseMails({ mails, transactions, rules, meta, ingestMail, atomically }) {
  const toIncomingMail = (mail) => ({
    id: mail.id,
    messageId: mail.messageId,
    from: mail.fromAddress,
    fromName: mail.fromName,
    subject: mail.subject,
    body: mail.body,
    date: mail.receivedAt,
  });

  /**
   * Vuelve a leer un correo que no generó movimiento (por ejemplo, tras mejorar el lector).
   * Los correos ya registrados o descartados no se tocan.
   */
  function reparseMail(mailId) {
    const mail = mails.get(mailId);
    if (!mail) return { status: 'no_existe' };
    if (mail.status === MailStatus.REGISTERED || mail.status === MailStatus.DISCARDED) return { status: DUPLICATE_MAIL };

    return atomically(() => {
      mails.remove(mailId);
      return ingestMail(toIncomingMail(mail), { exchangeRate: meta.get(META_EXCHANGE_RATE)?.rate || null });
    });
  }

  /** Corrige la dirección (gasto / ingreso / entre mis cuentas) de lo ya registrado si el lector ahora la lee distinto. */
  function fixDirectionsOfRegisteredMails() {
    let fixed = 0;
    for (const mail of mails.listRegisteredWithTemplate()) {
      const parsed = parseMail({ from: mail.fromAddress, subject: mail.subject, body: mail.body, date: mail.receivedAt });
      if (!parsed.ok) continue;

      const mailKey = mail.messageId || mail.id;
      parsed.items.forEach((item, rowIndex) => {
        const transaction = transactions.get(transactionIdForMail(mailKey, rowIndex));
        const shouldSkip = !transaction
          || transaction.deleted
          || transaction.direction === item.direction
          || transaction.categoryOrigin === CategoryOrigin.USER_CHOICE; // lo que la persona eligió no se toca
        if (shouldSkip) return;

        const { category, origin } = categorize({
          counterparty: transaction.counterparty, type: transaction.type, direction: item.direction, userRules: rules.list(),
        });
        transactions.update(transaction.id, { direction: item.direction, category, categoryOrigin: origin, note: item.note });
        fixed++;
      });
    }
    return fixed;
  }

  /**
   * Si cambió la versión del lector: reintenta los correos no reconocidos y
   * corrige lo ya leído. Solo corre una vez por versión.
   * @returns {number} Cuántos correos o movimientos se corrigieron.
   */
  function reparseIfParserChanged() {
    if (meta.get(META_PARSER_VERSION) === PARSER_VERSION) return 0;

    let changed = 0;
    for (const mail of mails.listByStatus([MailStatus.NO_MOVEMENT, MailStatus.DECLINED])) {
      if (reparseMail(mail.id).status === MailStatus.REGISTERED) changed++;
    }
    changed += fixDirectionsOfRegisteredMails();

    meta.set(META_PARSER_VERSION, PARSER_VERSION);
    return changed;
  }

  return { reparseMail, reparseIfParserChanged };
}
