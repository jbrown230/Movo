// Convierte un mensaje de la API de Gmail en el correo simple que entiende Movo.

import { htmlToText } from './htmlToText.js';

function decodeBase64Url(data) {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** Recorre las partes del mensaje y devuelve la primera versión en texto plano y en HTML. */
function findBodies(payload) {
  const found = { plain: null, html: null };
  (function visit(part) {
    if (!part) return;
    if (part.body?.data) {
      if (part.mimeType === 'text/plain' && !found.plain) found.plain = decodeBase64Url(part.body.data);
      if (part.mimeType === 'text/html' && !found.html) found.html = decodeBase64Url(part.body.data);
    }
    (part.parts || []).forEach(visit);
  })(payload);
  return found;
}

/** Texto del cuerpo. Si el HTML trae tablas se prefiere, porque conserva las columnas (Monto, Moneda, Estado...). */
function extractBodyText(payload) {
  const { plain, html } = findBodies(payload);
  const htmlHasTables = html && /<t[dh][\s>]/i.test(html);
  if (htmlHasTables) return htmlToText(html);
  if (plain && plain.trim()) return plain;
  return html ? htmlToText(html) : '';
}

const headerValue = (message, name) =>
  message.payload?.headers?.find((header) => header.name.toLowerCase() === name)?.value || '';

/**
 * @param {string} id  Id del mensaje en Gmail.
 * @param {object} message  Respuesta de `messages.get?format=full`.
 * @returns {import('../../domain/types.js').IncomingMail}
 */
export function decodeGmailMessage(id, message) {
  const from = headerValue(message, 'from');
  return {
    id,
    messageId: headerValue(message, 'message-id') || null,
    from,
    fromName: from.replace(/<.*>/, '').replace(/"/g, '').trim() || from,
    subject: headerValue(message, 'subject'),
    body: extractBodyText(message.payload),
    date: new Date(Number(message.internalDate) || Date.now()).toISOString(),
  };
}
