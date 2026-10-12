// Traductor entre las entidades de la app (BackupChanges) y el formato de red del respaldo.
// El formato de red está definido en shared/backupContract.js y explicado en docs/API.md.

import { CHANGE_LIST_NAMES } from '../../../../shared/backupContract.js';

// ---- de la app hacia la red ----
const transactionToWire = ({ id, updatedAt, isDeleted, ...data }) => ({ id, updatedAt, isDeleted, data });

const categoryRuleToWire = ({ id, updatedAt, isDeleted, counterpartyKey, category }) => ({
  id,
  updatedAt,
  isDeleted,
  data: { counterpartyKey, category },
});

const settingToWire = ({ name, value, updatedAt }) => ({ id: name, updatedAt, isDeleted: false, data: { value } });

const TO_WIRE_BY_LIST = {
  transactions: transactionToWire,
  categoryRules: categoryRuleToWire,
  settings: settingToWire,
};

// ---- de la red hacia la app ----
const transactionFromWire = ({ id, updatedAt, isDeleted, data }) => ({ id, updatedAt, isDeleted, ...data });

const categoryRuleFromWire = ({ id, updatedAt, isDeleted, data }) => ({
  id,
  updatedAt,
  isDeleted,
  counterpartyKey: data.counterpartyKey,
  category: data.category,
});

const settingFromWire = ({ id, updatedAt, data }) => ({ name: id, value: data.value, updatedAt });

const FROM_WIRE_BY_LIST = {
  transactions: transactionFromWire,
  categoryRules: categoryRuleFromWire,
  settings: settingFromWire,
};

function mapEachList(changes, mappers) {
  const mapped = {};
  for (const listName of CHANGE_LIST_NAMES) mapped[listName] = (changes[listName] ?? []).map(mappers[listName]);
  return mapped;
}

/** @param {import('../../domain/types.js').BackupChanges} changes */
export const toWireChanges = (changes) => mapEachList(changes, TO_WIRE_BY_LIST);

/** @returns {import('../../domain/types.js').BackupChanges} */
export const fromWireChanges = (wireChanges) => mapEachList(wireChanges ?? {}, FROM_WIRE_BY_LIST);
