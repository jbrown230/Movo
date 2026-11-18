// Convierte un mensaje de la API de Gmail en el correo simple que entiende Movo.

import { htmlToText } from './htmlToText.js';

/**
 * Con un bucle simple: `Uint8Array.from(texto, función)` llamaba a una función por cada carácter y era unas
 * 15 veces más lento en un correo de 50 KB, algo que en el teléfono se nota al leer cientos de correos seguidos.
 */
function decodeBase64Url(data) {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Recorre las partes del mensaje y devuelve, SIN descodificar, la primera versión en texto plano y en HTML. */
function findEncodedBodies(payload) {
  const found = { plain: null, html: null };
  (function visit(part) {
    if (!part) return;
    if (part.body?.data) {
      if (part.mimeType === 'text/plain' && !found.plain) found.plain = part.body.data;
      if (part.mimeType === 'text/html' && !found.html) found.html = part.body.data;
    }
    (part.parts || []).forEach(visit);
  })(payload);
  return found;
}

/**
 * Texto del cuerpo. Si el HTML trae tablas se prefiere, porque conserva las columnas (Monto, Moneda, Estado...).
 * Solo se descodifica lo que hace falta: casi todos los correos traen las dos versiones y se usa una.
 */
function extractBodyText(payload) {
  const { plain, html } = findEncodedBodies(payload);
  const htmlText = html ? decodeBase64Url(html) : null;
  if (htmlText && /<t[dh][\s>]/i.test(htmlText)) return htmlToText(htmlText);
  if (plain) {
    const plainText = decodeBase64Url(plain);
    if (plainText.trim()) return plainText;
  }
  return htmlText ? htmlToText(htmlText) : '';
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
