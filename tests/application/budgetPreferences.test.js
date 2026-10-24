import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, reopenDatabase } from '../helpers/createTestApp.js';
import { SettingName } from '../../web/src/application/preferences.js';

test('presupuestos por categoría: se guardan, se limpian y sobreviven a reabrir la app', () => {
  const { db, services } = createTestApp();
  assert.deepEqual(services.preferences.categoryBudgets(), {}, 'al empezar no hay ninguno');

  services.preferences.setCategoryBudgets({ comida: 5_000_000, ocio: 0, ingreso: 100 });
  assert.deepEqual(services.preferences.categoryBudgets(), { comida: 5_000_000 });

  const reopened = createTestApp({ database: reopenDatabase(db) });
  assert.deepEqual(reopened.services.preferences.categoryBudgets(), { comida: 5_000_000 });
});

test('presupuestos por categoría: un valor dañado se lee como "sin presupuestos"', () => {
  const { storage, services } = createTestApp();
  storage.settings.set(SettingName.CATEGORY_BUDGETS, '{no es json');
  assert.deepEqual(services.preferences.categoryBudgets(), {});
});

test('umbral del aviso: 80 % por defecto y solo valores válidos', () => {
  const { services } = createTestApp();
  assert.equal(services.preferences.budgetAlertPercent(), 80);
  services.preferences.setBudgetAlertPercent(60);
  assert.equal(services.preferences.budgetAlertPercent(), 60);
  services.preferences.setBudgetAlertPercent(120);
  assert.equal(services.preferences.budgetAlertPercent(), 80);
});

test('los cambios a los presupuestos quedan pendientes de respaldo', () => {
  const { services } = createTestApp();
  const before = services.backup.pendingCount();
  services.preferences.setCategoryBudgets({ super: 8_000_000 });
  services.preferences.setBudgetAlertPercent(90);
  assert.equal(services.backup.pendingCount(), before + 2);
});
