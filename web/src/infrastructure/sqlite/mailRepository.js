// Repositorio de correos leídos (tabla `mail`).

import { MailStatus } from '../../domain/types.js';

const toMail = (row) => ({
  id: row.id,
  messageId: row.message_id,
  bank: row.bank,
  fromAddress: row.from_addr,
  fromName: row.from_name,
  subject: row.subject,
  body: row.body,
  receivedAt: row.received_at,
  status: row.status,
  template: row.template,
  transactionId: row.tx_id,
  note: row.note,
});

const PREVIEW_LENGTH = 140;
const INBOX_LIMIT = 300;

export function createMailRepository(sql) {
  return {
    get(id) {
      const row = sql.queryOne('SELECT * FROM mail WHERE id=?', [id]);
      return row ? toMail(row) : null;
    },

    /** ¿Ya se leyó este correo? Se compara por id de Gmail y por Message-ID. */
    exists({ id, messageId }) {
      const NEVER_MATCHES = '\u0000';
      return sql.queryOne(
        'SELECT 1 AS found FROM mail WHERE id=? OR (message_id IS NOT NULL AND message_id=?)',
        [id, messageId || NEVER_MATCHES],
      ) !== null;
    },

    /** El correo del que salió un movimiento (por su Message-ID), o null. */
    findByMailKey(mailKey) {
      const row = sql.queryOne('SELECT * FROM mail WHERE message_id=? OR id=?', [mailKey, mailKey]);
      return row ? toMail(row) : null;
    },

    /** Los correos más recientes, con una vista previa corta del cuerpo. */
    listRecent() {
      return sql
        .query(
          `SELECT id, bank, from_name, from_addr, subject, substr(body,1,${PREVIEW_LENGTH}) AS preview, received_at, status, tx_id
           FROM mail ORDER BY received_at DESC LIMIT ${INBOX_LIMIT}`,
        )
        .map((row) => ({
          id: row.id,
          bank: row.bank,
          fromName: row.from_name,
          fromAddress: row.from_addr,
          subject: row.subject,
          preview: row.preview,
          receivedAt: row.received_at,
          status: row.status,
          transactionId: row.tx_id,
        }));
    },

    listByStatus(statuses) {
      const marks = statuses.map(() => '?').join(',');
      return sql.query(`SELECT * FROM mail WHERE status IN (${marks})`, statuses).map(toMail);
    },

    /** Correos registrados con una plantilla (los que se pueden volver a leer). */
    listRegisteredWithTemplate() {
      return sql
        .query('SELECT * FROM mail WHERE status=? AND template IS NOT NULL', [MailStatus.REGISTERED])
        .map(toMail);
    },

    count() {
      return sql.queryOne('SELECT COUNT(*) AS n FROM mail').n;
    },

    insert(mail) {
      sql.execute(
        `INSERT INTO mail(id,message_id,bank,from_addr,from_name,subject,body,received_at,status,template,tx_id,note)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          mail.id, mail.messageId ?? null, mail.bank ?? null, mail.fromAddress ?? null, mail.fromName ?? null,
          mail.subject ?? '', mail.body ?? '', mail.receivedAt, mail.status, mail.template ?? null,
          mail.transactionId ?? null, mail.note ?? null,
        ],
      );
    },

    remove(id) {
      sql.execute('DELETE FROM mail WHERE id=?', [id]);
    },

    /** Marca el correo como registrado a mano. */
    markRegistered(id, transactionId, note) {
      sql.execute('UPDATE mail SET status=?, tx_id=?, note=? WHERE id=?', [MailStatus.REGISTERED, transactionId, note, id]);
    },

    /** Cuando se elimina un movimiento, su correo queda como descartado. */
    discardByTransaction(transactionId, note) {
      sql.execute('UPDATE mail SET status=?, tx_id=NULL, note=? WHERE tx_id=?', [MailStatus.DISCARDED, note, transactionId]);
    },
  };
}
