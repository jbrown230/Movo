// Validador $jsonSchema de la colección "backup_records".
//
// La API ya limpia cada campo antes de escribir (adapters/http/parseSyncRequest.js). Este validador
// es la segunda barrera, en la base misma: rechaza un documento mal formado aunque llegue por otro
// camino (un script, mongosh o un error en el código). Se arma con los mismos valores permitidos y
// largos máximos de shared/backupContract.js, así la API y la base no pueden contradecirse.

import {
  ALLOWED_CURRENCIES,
  ALLOWED_DIRECTIONS,
  ALLOWED_TRANSACTION_TYPES,
  MAX_TEXT_LENGTH,
  RECORD_ID_PATTERN,
  RECORD_KIND_BY_LIST,
  SYNCED_SETTING_NAMES,
} from '../../../../shared/backupContract.js';

const text = (maxLength) => ({ bsonType: 'string', maxLength });
const optionalText = (maxLength) => ({ bsonType: ['string', 'null'], maxLength });
const number = { bsonType: 'number' };

/** Un objeto con exactamente estos campos: todos obligatorios y ninguno de más. */
const exactObject = (properties) => ({
  bsonType: 'object',
  required: Object.keys(properties),
  additionalProperties: false,
  properties,
});

const transactionData = exactObject({
  date: optionalText(MAX_TEXT_LENGTH.DATE),
  amountCents: number,
  currency: { enum: [...ALLOWED_CURRENCIES] },
  crcCents: number,
  exchangeRate: { bsonType: ['number', 'null'] },
  counterparty: text(MAX_TEXT_LENGTH.COUNTERPARTY),
  category: text(MAX_TEXT_LENGTH.CATEGORY),
  categoryOrigin: optionalText(MAX_TEXT_LENGTH.CATEGORY_ORIGIN),
  type: { enum: [...ALLOWED_TRANSACTION_TYPES] },
  direction: { enum: [...ALLOWED_DIRECTIONS] },
  bank: optionalText(MAX_TEXT_LENGTH.BANK),
  mailKey: optionalText(MAX_TEXT_LENGTH.MAIL_KEY),
  note: optionalText(MAX_TEXT_LENGTH.NOTE),
});

const categoryRuleData = exactObject({
  counterpartyKey: text(MAX_TEXT_LENGTH.COUNTERPARTY),
  category: text(MAX_TEXT_LENGTH.CATEGORY),
});

const settingData = exactObject({
  value: { bsonType: ['string', 'number', 'bool', 'null'], maxLength: MAX_TEXT_LENGTH.SETTING_TEXT },
});

const savingsGoalData = exactObject({
  name: text(MAX_TEXT_LENGTH.GOAL_NAME),
  targetCents: { bsonType: 'number', minimum: 0 },
  targetDay: text(MAX_TEXT_LENGTH.DATE),
  startDay: text(MAX_TEXT_LENGTH.DATE),
});

/** Lo que debe cumplir `data` según el tipo de registro. Un ajuste, además, tiene que ser uno de los conocidos. */
const kindRules = [
  { properties: { kind: { enum: [RECORD_KIND_BY_LIST.transactions] }, data: transactionData } },
  { properties: { kind: { enum: [RECORD_KIND_BY_LIST.categoryRules] }, data: categoryRuleData } },
  { properties: { kind: { enum: [RECORD_KIND_BY_LIST.savingsGoals] }, data: savingsGoalData } },
  {
    properties: {
      kind: { enum: [RECORD_KIND_BY_LIST.settings] },
      id: { enum: [...SYNCED_SETTING_NAMES] },
      data: settingData,
    },
  },
];

export const backupRecordSchema = {
  bsonType: 'object',
  required: ['userId', 'kind', 'id', 'updatedAt', 'serverSequence', 'isDeleted', 'data'],
  additionalProperties: false,
  properties: {
    _id: {},
    userId: text(MAX_TEXT_LENGTH.DEFAULT),
    kind: { enum: Object.values(RECORD_KIND_BY_LIST) },
    id: { bsonType: 'string', pattern: RECORD_ID_PATTERN },
    updatedAt: { bsonType: 'number', minimum: 1 },
    serverSequence: { bsonType: 'number', minimum: 1 },
    isDeleted: { bsonType: 'bool' },
    data: { bsonType: 'object' },
  },
  oneOf: kindRules,
};
