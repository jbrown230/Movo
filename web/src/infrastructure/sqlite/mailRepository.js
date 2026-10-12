// Repositorio de correos leídos (tabla `mails`).

import { MailStatus } from '../../domain/types.js';

const PREVIEW_LENGTH = 140;
const INBOX_LIMIT = 300;

const toMail = (row) => ({
  id: row.id,
  messageId: row.message_id,
  bank: row.bank,
  fromAddress: row.from_address,
  fromName: row.from_name,
  subject: row.subject,
  body: row.body,
  receivedAt: row.received_at,
  status: row.status,
  template: row.template,
  transactionId: row.transaction_id,
  note: row.note,
});

/** Un correo de la bandeja: lo justo para la lista, con una vista previa corta del cuerpo. */
const toInboxItem = (row) => ({
  id: row.id,
  bank: row.bank,
  fromName: row.from_name,
  fromAddress: row.from_address,
  subject: row.subject,
  preview: row.preview,
  receivedAt: row.received_at,
  status: row.status,
  transactionId: row.transaction_id,
});

function insertMail(sql, mail) {
  sql.execute(
    `INSERT INTO mails(
       id, message_id, bank, from_address, from_name, subject, body, received_at, status, template, transaction_id, note)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      mail.id,
      mail.messageId ?? null,
      mail.bank ?? null,
      mail.fromAddress ?? null,
      mail.fromName ?? null,
      mail.subject ?? '',
      mail.body ?? '',
      mail.receivedAt,
      mail.status,
      mail.template ?? null,
      mail.transactionId ?? null,
      mail.note ?? null,
    ],
  );
}

export function createMailRepository(sql) {
  return {
    get(id) {
      const row = sql.queryOne('SELECT * FROM mails WHERE id=?', [id]);
      return row ? toMail(row) : null;
    },

    /** ¿Ya se leyó este correo? Se compara por id de Gmail y por Message-ID. */
    exists({ id, messageId }) {
      const NEVER_MATCHES = String.fromCharCode(0);
      return (
        sql.queryOne('SELECT 1 AS found FROM mails WHERE id=? OR (message_id IS NOT NULL AND message_id=?)', [
          id,
          messageId || NEVER_MATCHES,
        ]) !== null
      );
    },

    /** El correo del que salió un movimiento (por su Message-ID), o null. */
    findByMailKey(mailKey) {
      const row = sql.queryOne('SELECT * FROM mails WHERE message_id=? OR id=?', [mailKey, mailKey]);
      return row ? toMail(row) : null;
    },

    /** Los correos más recientes, con una vista previa corta del cuerpo. */
    listRecent() {
      return sql
        .query(
          `SELECT id, bank, from_name, from_address, subject, substr(body,1,${PREVIEW_LENGTH}) AS preview,
                  received_at, status, transaction_id
           FROM mails ORDER BY received_at DESC LIMIT ${INBOX_LIMIT}`,
        )
        .map(toInboxItem);
    },

    listByStatus(statuses) {
      const placeholders = statuses.map(() => '?').join(',');
      return sql.query(`SELECT * FROM mails WHERE status IN (${placeholders})`, statuses).map(toMail);
    },

    /** Correos registrados con una plantilla (los que se pueden volver a leer). */
    listRegisteredWithTemplate() {
      return sql
        .query('SELECT * FROM mails WHERE status=? AND template IS NOT NULL', [MailStatus.REGISTERED])
        .map(toMail);
    },

    count() {
      return sql.queryOne('SELECT COUNT(*) AS count FROM mails').count;
    },

    insert: (mail) => insertMail(sql, mail),

    remove(id) {
      sql.execute('DELETE FROM mails WHERE id=?', [id]);
    },

    /** Marca el correo como registrado a mano. */
    markRegistered(id, transactionId, note) {
      sql.execute('UPDATE mails SET status=?, transaction_id=?, note=? WHERE id=?', [
        MailStatus.REGISTERED,
        transactionId,
        note,
        id,
      ]);
    },

    /** Cuando se elimina un movimiento, su correo queda como descartado. */
    discardByTransaction(transactionId, note) {
      sql.execute('UPDATE mails SET status=?, transaction_id=NULL, note=? WHERE transaction_id=?', [
        MailStatus.DISCARDED,
        note,
        transactionId,
      ]);
    },
  };
}
