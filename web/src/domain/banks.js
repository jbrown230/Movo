// Los bancos que Movo reconoce y cómo identificarlos en un correo.

/**
 * `senderPattern` se prueba contra el remitente del correo.
 * `textPattern` se prueba contra el asunto y el cuerpo, si el remitente no alcanza.
 */
export const BANKS = Object.freeze({
  BCR: {
    name: 'Banco de Costa Rica',
    color: '#00478F',
    senderPattern: /(bancobcr|bcr\.fi|bcr\.demo)/i,
    textPattern: /(cuenta|tarjeta) BCR\b|\bALERTA BCR\b/i,
  },
  BAC: {
    name: 'BAC Credomatic',
    color: '#D3122B',
    senderPattern: /(baccr|credomatic|bac\.demo|bacnetwork)/i,
    textPattern: /CREDOMATIC|\bBAC\b/i,
  },
  BN: {
    name: 'Banco Nacional',
    color: '#0A6E3C',
    senderPattern: /(bncr|bn\.demo|bnmas)/i,
    textPattern: /\bBN NOTIFICACIONES\b/i,
  },
  DAVIVIENDA: { name: 'Davivienda', color: '#E30613', senderPattern: /davivienda/i, textPattern: /DAVIVIENDA/i },
  PROMERICA: { name: 'Promerica', color: '#00843D', senderPattern: /promerica/i, textPattern: /PROMERICA/i },
});

/** Color de marca de un banco (gris si no se reconoce). */
export const bankColor = (bankKey) => BANKS[bankKey]?.color ?? '#6B667D';

const entries = Object.entries(BANKS);

/** Banco que envió el correo según el remitente, o null. */
export function detectBankBySender(sender = '') {
  return entries.find(([, bank]) => bank.senderPattern.test(sender))?.[0] ?? null;
}

/** Banco según el remitente primero y el texto después, o null si no se reconoce. */
export function detectBank(sender = '', text = '') {
  const bySender = detectBankBySender(sender);
  if (bySender) return bySender;
  return entries.find(([, bank]) => bank.textPattern.test(text))?.[0] ?? null;
}
