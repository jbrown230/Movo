// Pruebas de la lógica que corre en el teléfono: lector de correos y base SQLite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { parseEmail, parseAmount, categorize } from '../web/js/parser.js';
import { buildEmail, demoSeedEmails } from '../web/js/demo-emails.js';
import { migrate, createRepo } from '../web/js/repo.js';

const SQL = await initSqlJs();
const newRepo = () => { const db = new SQL.Database(); migrate(db); return createRepo(db); };

test('parseAmount entiende formatos de Costa Rica y EE. UU.', () => {
  assert.equal(parseAmount('15,000.00'), 15000);
  assert.equal(parseAmount('15.000,00'), 15000);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('7.99'), 7.99);
  assert.equal(parseAmount('2 500,50'), 2500.5);
});

for (const bank of ['BAC', 'BN', 'BCR']) {
  for (const type of ['sinpe', 'tarjeta']) {
    test(`plantilla ${bank} ${type}`, () => {
      const m = buildEmail({ bank, type, who: 'SODA DONA ROSA', amount: 3450.5, date: '2026-10-05T19:42:00.000Z' });
      const p = parseEmail(m);
      assert.ok(p.ok); assert.equal(p.bank, bank); assert.equal(p.amountCents, 345050);
      assert.equal(p.who, 'SODA DONA ROSA'); assert.equal(p.type, type); assert.equal(p.dir, 'out');
      assert.equal(new Date(p.date).getTime(), new Date('2026-10-05T19:42:00.000Z').setSeconds(0, 0));
    });
  }
}

test('SINPE recibido se marca como ingreso', () => {
  for (const bank of ['BAC', 'BN', 'BCR']) {
    const p = parseEmail(buildEmail({ bank, type: 'sinpe', dir: 'in', who: 'ANA ROJAS V', amount: 20000 }));
    assert.equal(p.dir, 'in', bank);
  }
});

test('compra en dólares', () => {
  const p = parseEmail(buildEmail({ bank: 'BAC', type: 'tarjeta', who: 'NETFLIX.COM', amount: 7.99, cur: 'USD' }));
  assert.equal(p.cur, 'USD'); assert.equal(p.amountCents, 799);
});

test('lector genérico con un formato desconocido', () => {
  const p = parseEmail({ from: 'avisos@banco-x.example', subject: 'Aviso de compra', body: 'Estimado cliente, se registró una compra.\nEstablecimiento: PANADERIA LA ESQUINA\nImporte: ₡4.500,00\nFecha: 03/10/2026 08:15' });
  assert.ok(p.ok); assert.equal(p.amountCents, 450000); assert.equal(p.who, 'PANADERIA LA ESQUINA'); assert.equal(p.template, 'genérica');
});

test('un correo sin monto no crea movimiento', () => {
  assert.equal(parseEmail({ subject: 'Estado de cuenta', body: 'Ya puede consultar su estado de cuenta.' }).ok, false);
});

test('pie de página con "recibió" no convierte una compra en ingreso', () => {
  const m = buildEmail({ bank: 'BAC', type: 'tarjeta', who: 'PIZZA ROMA', amount: 9000 });
  m.body += '\nUsted recibió este correo porque tiene alertas activas.';
  assert.equal(parseEmail(m).dir, 'out');
});

test('categorías: reglas del usuario antes que las automáticas', () => {
  assert.equal(categorize('SUPER LA AMISTAD', 'tarjeta', 'out').cat, 'super');
  assert.equal(categorize('SERVICENTRO LA SABANA', 'tarjeta', 'out').cat, 'transporte');
  assert.equal(categorize('MARIA FERNANDEZ', 'sinpe', 'out').cat, 'transfer');
  assert.equal(categorize('MARIA FERNANDEZ', 'sinpe', 'out', [{ match: 'MARIA FERNANDEZ', cat: 'comida' }]).cat, 'comida');
});

test('ingesta idempotente: el mismo correo no se registra dos veces', () => {
  const r = newRepo();
  const m = buildEmail({ bank: 'BN', type: 'sinpe', who: 'SODA DONA ROSA', amount: 1500 });
  assert.equal(r.ingestMail(m).status, 'registrado');
  assert.equal(r.ingestMail(m).status, 'duplicado');
  assert.equal(r.ingestMail({ ...m, id: 'otro-id-gmail' }).status, 'duplicado', 'mismo Message-ID');
  assert.equal(r.counts().tx, 1);
});

test('dos teléfonos generan el mismo id para el mismo correo', () => {
  const m = buildEmail({ bank: 'BAC', type: 'tarjeta', who: 'UBER *TRIP', amount: 4380 });
  const a = newRepo().ingestMail(m).tx, b = newRepo().ingestMail({ ...m, id: 'gmail-otro-telefono' }).tx;
  assert.equal(a.id, b.id);
});

test('resumen del mes en SQL: gastos e ingresos separados, USD convertido', () => {
  const r = newRepo();
  for (const m of demoSeedEmails()) r.ingestMail(m, { fx: 500 });
  const s = r.monthSummary();
  assert.equal(s.income, 2000000);
  const ocio = s.byCat.find((c) => c.cat === 'ocio');
  assert.equal(ocio.total, 799 * 500);
  assert.equal(s.spent, s.byCat.reduce((a, c) => a + c.total, 0));
});

test('cambiar categoría crea regla y aplica a los movimientos del mismo comercio', () => {
  const r = newRepo();
  const t = r.ingestMail(buildEmail({ bank: 'BAC', type: 'sinpe', who: 'JUAN PEREZ', amount: 1000 })).tx;
  r.ingestMail(buildEmail({ bank: 'BN', type: 'sinpe', who: 'JUAN PEREZ', amount: 2000 }));
  assert.equal(r.recategorize(t.id, 'comida'), 2);
  const t3 = r.ingestMail(buildEmail({ bank: 'BCR', type: 'sinpe', who: 'JUAN PEREZ', amount: 3000 })).tx;
  assert.equal(t3.cat, 'comida'); assert.equal(t3.cat_origin, 'tu regla');
});

test('sincronización local: dirty → clean y aplicar remoto con último-gana', () => {
  const r = newRepo();
  const t = r.ingestMail(buildEmail({ bank: 'BAC', type: 'tarjeta', who: 'CAFE CORDILLERA', amount: 2900 })).tx;
  const d = r.dirty(); assert.equal(d.tx.length, 1);
  r.markClean(d); assert.equal(r.pendingCount(), 0);
  const older = { tx: [{ id: t.id, updatedAt: t.updated_at - 10, deleted: false, data: { ...d.tx[0].data, cat: 'ocio' } }] };
  assert.equal(r.applyRemote(older), 0);
  const newer = { tx: [{ id: t.id, updatedAt: t.updated_at + 10, deleted: false, data: { ...d.tx[0].data, cat: 'ocio' } }] };
  assert.equal(r.applyRemote(newer), 1);
  assert.equal(r.getTx(t.id).cat, 'ocio');
});

test('la base se guarda y se vuelve a abrir (persistencia)', () => {
  const db = new SQL.Database(); migrate(db); const r = createRepo(db);
  r.ingestMail(buildEmail({ bank: 'BAC', type: 'tarjeta', who: 'X', amount: 1 }));
  const db2 = new SQL.Database(db.export()); migrate(db2);
  assert.equal(createRepo(db2).counts().tx, 1);
});

// ------------------------------------------------ formatos REALES del BCR
import { parseEmailAll } from '../web/js/parser.js';
import { BCR_SINPE_ENVIADO, BCR_SINPE_RECIBIDO, BCR_TARJETA_NEGADA } from './fixtures/bcr.mjs';
const local = (y, m, d, h, mi, s = 0) => new Date(Date.UTC(y, m - 1, d, h + 6, mi, s)).toISOString(); // hora de Costa Rica

test('BCR real: SINPE enviado con monto ".15" y hora PM', () => {
  const p = parseEmail(BCR_SINPE_ENVIADO);
  assert.equal(p.template, 'BCR SINPE'); assert.equal(p.bank, 'BCR');
  assert.equal(p.amountCents, 15); assert.equal(p.cur, 'CRC');
  assert.equal(p.who, 'PERSONA DESTINO PRUEBA');
  assert.equal(p.dir, 'out'); assert.equal(p.type, 'sinpe');
  assert.equal(p.date, local(2026, 10, 5, 19, 37));
  assert.match(p.note, /Motivo: prueba SINPE/);
});

test('BCR real: SINPE recibido es ingreso, hora AM', () => {
  const p = parseEmail(BCR_SINPE_RECIBIDO);
  assert.equal(p.dir, 'in'); assert.equal(p.amountCents, 500000);
  assert.equal(p.who, 'PERSONA ORIGEN PRUEBA'); assert.equal(p.date, local(2026, 10, 1, 9, 1));
  assert.equal(categorize(p.who, p.type, p.dir).cat, 'ingreso');
});

test('BCR real: compra con tarjeta NEGADA no se registra como gasto', () => {
  const all = parseEmailAll(BCR_TARJETA_NEGADA);
  assert.equal(all.template, 'BCR tarjeta');
  assert.equal(all.items.length, 1);
  const it = all.items[0];
  assert.equal(it.declined, true); assert.equal(it.status, 'Negada');
  assert.equal(it.cur, 'USD'); assert.equal(it.amountCents, 2000);
  assert.equal(it.who, 'SERVICIO DIGITAL SUB 00000000000 US');
  assert.equal(it.date, local(2026, 10, 1, 9, 33, 49));
  const r = newRepo();
  const res = r.ingestMail({ id: 'g-neg', messageId: '<neg@bcr>', ...BCR_TARJETA_NEGADA });
  assert.equal(res.status, 'negada'); assert.equal(r.counts().tx, 0);
  assert.match(r.getMail('g-neg').note, /Negada/);
});

test('BCR real: la misma tabla copiada con espacios (sin tabuladores)', () => {
  const body = BCR_TARJETA_NEGADA.body.replace(/\t/g, ' ').replace('Negada', 'Aprobada');
  const p = parseEmail({ ...BCR_TARJETA_NEGADA, body });
  assert.ok(p.ok); assert.equal(p.amountCents, 2000); assert.equal(p.who, 'SERVICIO DIGITAL SUB 00000000000 US');
});

test('BCR: tabla con varias transacciones, una negada', () => {
  const body = BCR_TARJETA_NEGADA.body.replace(/(01\/10\/2026 09:33:49.*Negada)/,
    '$1\n01/10/2026 10:00:00\t123456\t000000000005\t18,750.00\tCOLONES\tAUTOMERCADO ESCAZU\tAprobada\n01/10/2026 11:15:00\t654321\t000000000006\t3,200.00\tCOLONES\tSODA LA CEIBA\tAprobada');
  const r = newRepo();
  const res = r.ingestMail({ id: 'g-multi', messageId: '<multi@bcr>', ...BCR_TARJETA_NEGADA, body });
  assert.equal(res.status, 'registrado'); assert.equal(res.txs.length, 2);
  assert.deepEqual(res.txs.map((t) => [t.who, t.crc_cents, t.cat]), [['AUTOMERCADO ESCAZU', 1875000, 'super'], ['SODA LA CEIBA', 320000, 'comida']]);
  assert.match(r.getMail('g-multi').note, /1 transacción\(es\) negada/);
  assert.equal(r.ingestMail({ id: 'g-multi', messageId: '<multi@bcr>', ...BCR_TARJETA_NEGADA, body }).status, 'duplicado');
});

test('correos no reconocidos se vuelven a leer cuando mejora el lector', () => {
  // Simula lo que guardó la versión anterior: el SINPE real del BCR quedó "sin movimiento".
  const db = new SQL.Database(); migrate(db); const r = createRepo(db);
  db.run(`INSERT INTO mail(id,message_id,bank,from_addr,from_name,subject,body,received_at,status)
          VALUES('g1','<g1@bcr>','BCR',?,?,?,?,?,'sin_movimiento')`,
    [BCR_SINPE_ENVIADO.from, 'BCR Mensajero', BCR_SINPE_ENVIADO.subject, BCR_SINPE_ENVIADO.body, new Date().toISOString()]);
  r.setMeta('parser_version', 1);
  assert.equal(r.reparseIfParserChanged(), 1);
  assert.equal(r.getMail('g1').status, 'registrado');
  assert.equal(r.listTx()[0].amount_cents, 15);
  assert.equal(r.reparseIfParserChanged(), 0, 'solo una vez por versión');
});

test('eliminar un movimiento no lo revive al volver a leer', () => {
  const r = newRepo();
  const t = r.ingestMail({ id: 'e1', messageId: '<e1@bcr>', ...BCR_SINPE_ENVIADO }).tx;
  r.deleteTx(t.id);
  assert.equal(r.getMail('e1').status, 'descartado');
  assert.equal(r.reparseIfParserChanged(), 0);
  r.setMeta('parser_version', 0);
  assert.equal(r.reparseIfParserChanged(), 0);
  assert.equal(r.counts().tx, 0);
});

// ------------------------------------------------ SINPE entre mis cuentas
import { samePerson } from '../web/js/parser.js';
import { BCR_SINPE_PROPIO } from './fixtures/bcr.mjs';

test('mismo titular: tolera orden distinto y nombres recortados, pero no familiares', () => {
  assert.ok(samePerson('APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2', 'APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2'));
  assert.ok(samePerson('APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2', 'NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2'));
  assert.ok(samePerson('APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2', 'APELLIDO1 APELLIDO2 NOMBRE1 NO'), 'recortado por el banco');
  assert.ok(samePerson('Núñez Pérez José', 'NUNEZ PEREZ JOSE'), 'tildes');
  assert.equal(samePerson('APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2', 'APELLIDO1 APELLIDO2 HERMANA'), false, 'familiar con mismos apellidos');
  assert.equal(samePerson('APELLIDO1 APELLIDO2 NOMBRE1', 'APELLIDO1 APELLIDO2'), false, 'solo apellidos no alcanza');
  assert.equal(samePerson('APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2', 'OTRA PERSONA DISTINTA'), false);
});

test('BCR real: SINPE a mí mismo desde otra entidad no es ingreso ni gasto', () => {
  const p = parseEmail(BCR_SINPE_PROPIO);
  assert.equal(p.dir, 'self'); assert.equal(p.amountCents, 1000000);
  assert.equal(p.date, local(2026, 7, 29, 14, 12));
  assert.match(p.note, /Entre tus cuentas/); assert.match(p.note, /COOPENAE/);
  const r = newRepo();
  const res = r.ingestMail({ id: 'own', messageId: '<own@bcr>', ...BCR_SINPE_PROPIO, date: '2026-07-29T20:12:00Z' });
  assert.equal(res.tx.cat, 'propias');
  const s = r.monthSummary(new Date(2026, 6, 15));
  assert.equal(s.spent, 0); assert.equal(s.income, 0); assert.equal(s.moved, 1000000);
});

test('la persona puede cambiar cómo se cuenta un movimiento', () => {
  const r = newRepo();
  const t = r.ingestMail({ id: 'own2', messageId: '<own2@bcr>', ...BCR_SINPE_PROPIO }).tx;
  assert.equal(r.setDir(t.id, 'in').cat, 'ingreso');
  assert.equal(r.setDir(t.id, 'self').cat, 'propias');
  assert.equal(r.getTx(t.id).cat_origin, 'elegida por ti');
});

test('al actualizar el lector, un SINPE propio ya registrado como ingreso se corrige', () => {
  const db = new SQL.Database(); migrate(db); const r = createRepo(db);
  const t = r.ingestMail({ id: 'old', messageId: '<old@bcr>', ...BCR_SINPE_PROPIO }).tx;
  db.run("UPDATE tx SET dir='in', cat='ingreso' WHERE id=?", [t.id]);   // como lo dejó la v1.1
  r.setMeta('parser_version', 2);
  assert.equal(r.reparseIfParserChanged(), 1);
  assert.equal(r.getTx(t.id).dir, 'self');
  // Lo que la persona eligió a mano no se toca.
  r.setDir(t.id, 'in'); r.setMeta('parser_version', 2);
  r.reparseIfParserChanged();
  assert.equal(r.getTx(t.id).dir, 'in');
});

// ------------------------------------------------ HTML REAL del BCR (anonimizado)
import { readFileSync } from 'node:fs';
import { DOMParser as LinkeDOMParser } from 'linkedom';
globalThis.DOMParser ??= LinkeDOMParser;
const { htmlToText } = await import('../web/js/html.js');
const realHtml = (f) => readFileSync(new URL('./fixtures/bcr-html/' + f, import.meta.url), 'utf8');
const SINPE_FROM = '"BCR Mensajero" <mensajero@bancobcr.com>', TARJ_FROM = 'BCR Tarjetas <bcrtarjestcta@bancobcr.com>';

test('HTML real BCR: el SINPE no usa tablas y parte etiquetas con saltos de línea', () => {
  const body = htmlToText(realHtml('sinpe-enviado.html'));
  assert.match(body, /^Estimado \(a\): APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2$/m, '"Estimado\\r\\n(a):" queda en una línea');
  const p = parseEmail({ from: SINPE_FROM, subject: 'SINPEMOVIL - Notificación de transacción realizada', body });
  assert.equal(p.template, 'BCR SINPE'); assert.equal(p.amountCents, 15); assert.equal(p.dir, 'out');
  assert.equal(p.who, 'PERSONA DESTINO PRUEBA'); assert.equal(p.date, local(2026, 10, 5, 19, 37));
});

test('HTML real BCR: SINPE desde COOPENAE a mi cuenta = entre mis cuentas', () => {
  const p = parseEmail({ from: SINPE_FROM, subject: 'SINPEMOVIL', body: htmlToText(realHtml('sinpe-propio.html')) });
  assert.equal(p.dir, 'self'); assert.equal(p.amountCents, 1000000); assert.match(p.note, /COOPENAE/);
  assert.equal(p.date, local(2026, 7, 29, 14, 12));
});

test('HTML real BCR: tabla de tarjeta, columnas alineadas pese a tabuladores del código fuente', () => {
  const body = htmlToText(realHtml('tarjeta-aprobada.html'));
  assert.match(body, /^Fecha\tAutorización\tNo\.Referencia\tMonto\tMoneda\tComercio\tEstado$/m);
  const all = parseEmailAll({ from: TARJ_FROM, subject: 'Notificación de Transacciones BCR', body });
  assert.equal(all.items.length, 1);
  const it = all.items[0];
  assert.deepEqual([it.cur, it.amountCents, it.who, it.status, it.declined], ['USD', 2000, 'ANTHROPIC CLAUDE SUB 14152360599 US', 'Aprobada', false]);
  assert.equal(it.date, local(2026, 10, 1, 9, 41, 55));
  assert.equal(categorize(it.who, it.type, it.dir).cat, 'ocio');
});

test('HTML real BCR: tarjeta negada no se registra', () => {
  const r = newRepo();
  const res = r.ingestMail({ id: 'n', messageId: '<n@bcr>', from: TARJ_FROM, subject: 'Notificación de Transacciones BCR', body: htmlToText(realHtml('tarjeta-negada.html')) }, { fx: 505 });
  assert.equal(res.status, 'negada'); assert.equal(r.counts().tx, 0);
});

import { displayName } from '../web/js/format.js';
test('nombre de comercio limpio para mostrar', () => {
  assert.equal(displayName('ANTHROPIC  CLAUDE SUB  14152360599 US'), 'Anthropic Claude Sub');
  assert.equal(displayName('UBER *TRIP'), 'Uber *Trip');
  assert.equal(displayName('SODA DONA ROSA'), 'Soda Dona Rosa');
  assert.equal(displayName('1234567'), '1234567', 'no deja vacío');
});
