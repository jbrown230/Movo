// Validación estricta de lo que llega del teléfono en POST /api/sync.
//
// Solo se aceptan campos conocidos y tipos esperados: nada de operadores de MongoDB ni claves extra.
// Lo que falta o está mal en un campo se reemplaza por un valor por defecto seguro; lo que está mal
// en la estructura (ids, listas, fechas) se rechaza con InvalidRequestError.

import {
  ALLOWED_CURRENCIES,
  ALLOWED_DIRECTIONS,
  ALLOWED_TRANSACTION_TYPES,
  CHANGE_LIST_NAMES,
  MAX_CHANGES_PER_REQUEST,
  MAX_TEXT_LENGTH as MaxLength,
  RECORD_ID_PATTERN as RECORD_ID_SOURCE,
  RECORD_KIND_BY_LIST,
  SYNCED_SETTING_NAMES,
} from '../../../../shared/backupContract.js';
import { InvalidRequestError } from '../../application/errors.js';

const RECORD_ID_PATTERN = new RegExp(RECORD_ID_SOURCE);

const DEFAULT_CATEGORY = 'otros';
const DEFAULT_TRANSACTION_TYPE = 'transferencia';
const DEFAULT_DIRECTION = 'out';
const DEFAULT_CURRENCY = 'CRC';

// ---- conversiones seguras ----
const toBoundedText = (value, maxLength = MaxLength.DEFAULT) =>
  value === null || value === undefined ? null : String(value).slice(0, maxLength);
const toInteger = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);
const toNumberOrNull = (value) =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
const oneOf = (value, allowedValues, defaultValue) => (allowedValues.includes(value) ? value : defaultValue);

// ---- contenido de cada tipo de registro ----
const sanitizeTransactionData = (data) => ({
  date: toBoundedText(data.date, MaxLength.DATE),
  amountCents: toInteger(data.amountCents),
  currency: oneOf(data.currency, ALLOWED_CURRENCIES, DEFAULT_CURRENCY),
  crcCents: toInteger(data.crcCents),
  exchangeRate: toNumberOrNull(data.exchangeRate),
  counterparty: toBoundedText(data.counterparty, MaxLength.COUNTERPARTY) || '',
  category: toBoundedText(data.category, MaxLength.CATEGORY) || DEFAULT_CATEGORY,
  categoryOrigin: toBoundedText(data.categoryOrigin, MaxLength.CATEGORY_ORIGIN),
  type: oneOf(data.type, ALLOWED_TRANSACTION_TYPES, DEFAULT_TRANSACTION_TYPE),
  direction: oneOf(data.direction, ALLOWED_DIRECTIONS, DEFAULT_DIRECTION),
  bank: toBoundedText(data.bank, MaxLength.BANK),
  mailKey: toBoundedText(data.mailKey, MaxLength.MAIL_KEY),
  note: toBoundedText(data.note, MaxLength.NOTE),
});

const sanitizeCategoryRuleData = (data) => ({
  counterpartyKey: toBoundedText(data.counterpartyKey, MaxLength.COUNTERPARTY) || '',
  category: toBoundedText(data.category, MaxLength.CATEGORY) || DEFAULT_CATEGORY,
});

const sanitizeSettingData = (data) => {
  const isNumberOrBoolean = typeof data.value === 'number' || typeof data.value === 'boolean';
  return { value: isNumberOrBoolean ? data.value : toBoundedText(data.value, MaxLength.SETTING_TEXT) };
};

const SANITIZER_BY_LIST = {
  transactions: sanitizeTransactionData,
  categoryRules: sanitizeCategoryRuleData,
  settings: sanitizeSettingData,
};

/** Un ajuste que el servidor no conoce se ignora (no es un error). */
const isIgnoredSetting = (listName, id) => listName === 'settings' && !SYNCED_SETTING_NAMES.includes(id);

function parseRecord(listName, rawRecord) {
  if (!rawRecord || typeof rawRecord !== 'object' || !RECORD_ID_PATTERN.test(String(rawRecord.id))) {
    throw new InvalidRequestError('Id inválido.');
  }
  const updatedAt = Number(rawRecord.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) throw new InvalidRequestError('updatedAt inválido.');

  return {
    kind: RECORD_KIND_BY_LIST[listName],
    id: String(rawRecord.id),
    updatedAt,
    isDeleted: Boolean(rawRecord.isDeleted),
    data: SANITIZER_BY_LIST[listName](rawRecord.data || {}),
  };
}

/**
 * @param {unknown} body  Cuerpo de la petición (ver SyncRequest en shared/backupContract.js).
 * @returns {{ cursor: number, records: import('../../domain/backupRecord.js').BackupRecord[] }}
 * @throws {InvalidRequestError} si la estructura está mal.
 */
export function parseSyncRequest(body) {
  if (!body || typeof body !== 'object') throw new InvalidRequestError('Cuerpo inválido.');

  const records = [];
  for (const listName of CHANGE_LIST_NAMES) {
    const rawList = body.changes?.[listName] ?? [];
    if (!Array.isArray(rawList)) throw new InvalidRequestError(`"${listName}" debe ser una lista.`);

    for (const rawRecord of rawList) {
      const record = parseRecord(listName, rawRecord);
      if (!isIgnoredSetting(listName, record.id)) records.push(record);
    }
  }
  if (records.length > MAX_CHANGES_PER_REQUEST) {
    throw new InvalidRequestError(`Máximo ${MAX_CHANGES_PER_REQUEST} cambios por solicitud.`);
  }

  return { cursor: Math.max(0, Number(body.since) || 0), records };
}
