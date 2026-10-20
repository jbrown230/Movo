// La regla de sincronización del servidor: gana el cambio más reciente por registro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldReplace } from '../../src/domain/backupRecord.js';

const record = (updatedAt, category) => ({
  kind: 'transaction',
  id: 'm1',
  updatedAt,
  isDeleted: false,
  data: { category },
});

test('un registro nuevo siempre se guarda', () => {
  assert.equal(shouldReplace(record(1, 'super'), undefined), true);
});

test('un cambio más reciente reemplaza al guardado', () => {
  assert.equal(shouldReplace(record(3, 'ocio'), record(2, 'super')), true);
});

test('un cambio más viejo no pisa al guardado', () => {
  assert.equal(shouldReplace(record(1, 'ocio'), record(2, 'super')), false);
});

test('en un empate se queda lo que llegó primero', () => {
  assert.equal(shouldReplace(record(2, 'ocio'), record(2, 'super')), false);
});
