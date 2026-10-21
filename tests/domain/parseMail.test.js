// Pruebas del lector de correos bancarios (dominio puro: sin base de datos ni DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, parseFirstApproved } from '../../web/src/domain/emailParser/parseMail.js';
import { parseAmount } from '../../web/src/domain/emailParser/amount.js';
import { detectCurrency } from '../../web/src/domain/emailParser/currency.js';
import { categorize } from '../../web/src/domain/categories.js';
import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { costaRicaIso } from '../helpers/costaRica.js';
import {
  BCR_SINPE_ENVIADO,
  BCR_SINPE_RECIBIDO,
  BCR_SINPE_PROPIO,
  BCR_TARJETA_CORDOBAS,
  BCR_TARJETA_NEGADA,
} from '../fixtures/bcrMails.js';
import { BN_VOUCHER_COMPRA, BN_VOUCHER_COMPRA_TEXTO_PLANO } from '../fixtures/bnMails.js';
import {
  BAC_COMPRA_APROBADA,
  BAC_COMPRA_TEXTO_PLANO,
  BAC_COMPRA_DOLARES,
  BAC_TARJETA_NEGADA,
  BAC_SINPE_RECIBIDO,
  BAC_SINPE_ENVIADO,
} from '../fixtures/bacMails.js';

test('parseAmount entiende formatos de Costa Rica y de EE. UU.', () => {
  assert.equal(parseAmount('15,000.00'), 15000);
  assert.equal(parseAmount('15.000,00'), 15000);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('7.99'), 7.99);
  assert.equal(parseAmount('2 500,50'), 2500.5);
  assert.equal(parseAmount('.15'), 0.15);
  assert.ok(Number.isNaN(parseAmount('abc')));
});

// Plantillas sintéticas de la demo: cada banco y tipo se lee completo.
for (const bank of ['BAC', 'BN', 'BCR']) {
  for (const type of ['sinpe', 'tarjeta']) {
    test(`plantilla ${bank} ${type}`, () => {
      const date = '2026-01-15T19:42:00.000Z';
      const mail = buildBankMail({ bank, type, counterparty: 'SODA DONA ROSA', amount: 3450.5, date });
      const parsed = parseFirstApproved(mail);

      assert.ok(parsed.ok);
      assert.equal(parsed.bank, bank);
      assert.equal(parsed.amountCents, 345050);
      assert.equal(parsed.counterparty, 'SODA DONA ROSA');
      assert.equal(parsed.type, type);
      assert.equal(parsed.direction, 'out');
      assert.equal(new Date(parsed.date).getTime(), new Date(date).getTime());
    });
  }
}

test('un SINPE recibido se lee como ingreso', () => {
  for (const bank of ['BAC', 'BN', 'BCR']) {
    const mail = buildBankMail({ bank, type: 'sinpe', direction: 'in', counterparty: 'ANA EJEMPLO V', amount: 20000 });
    assert.equal(parseFirstApproved(mail).direction, 'in', bank);
  }
});

test('compra en dólares', () => {
  const mail = buildBankMail({
    bank: 'BAC',
    type: 'tarjeta',
    counterparty: 'NETFLIX.COM',
    amount: 7.99,
    currency: 'USD',
  });
  const parsed = parseFirstApproved(mail);
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 799);
});

test('sin plantilla oficial el correo se ignora, aunque traiga monto y etiquetas', () => {
  const result = parseMail({
    from: 'avisos@banco-x.example',
    subject: 'Aviso de compra',
    body: 'Estimado cliente, se registró una compra.\nEstablecimiento: PANADERIA LA ESQUINA\nImporte: ₡4.500,00\nFecha: 03/01/2026 08:15',
  });
  assert.equal(result.ok, false);
});

test('un correo promocional con montos no se lee como gasto', () => {
  const result = parseMail({
    from: 'promos@billetera.example',
    subject: 'Mandá tu SINPE desde la billetera.',
    body: '¿Te toca pagar? Hacelo al instante con nosotros. Hasta ₡200.000 sin comisión. Enviá hasta ₡300.000 al día.\nPodés desinscribirte de nuestra comunicación haciendo click aquí.',
    date: '2026-10-12T23:42:00.000Z',
  });
  assert.equal(result.ok, false);
});

test('un correo sin monto no genera movimiento', () => {
  const result = parseMail({ subject: 'Estado de cuenta', body: 'Ya puede consultar su estado de cuenta.' });
  assert.equal(result.ok, false);
});

test('el pie de página "recibió este correo" no convierte una compra en ingreso', () => {
  const mail = buildBankMail({ bank: 'BAC', type: 'tarjeta', counterparty: 'PIZZA ROMA', amount: 9000 });
  mail.body += '\nUsted recibió este correo porque tiene alertas activas.';
  assert.equal(parseFirstApproved(mail).direction, 'out');
});

// ---- Formatos del BCR ----

test('BCR: SINPE enviado con monto ".15" y hora PM/AM', () => {
  const parsed = parseFirstApproved(BCR_SINPE_ENVIADO);
  assert.equal(parsed.template, 'BCR SINPE');
  assert.equal(parsed.bank, 'BCR');
  assert.equal(parsed.amountCents, 15);
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.counterparty, 'PERSONA DESTINO PRUEBA');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 10, 30));
  assert.match(parsed.note, /Motivo: prueba SINPE/);
});

test('BCR: SINPE recibido es ingreso', () => {
  const parsed = parseFirstApproved(BCR_SINPE_RECIBIDO);
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.amountCents, 500000);
  assert.equal(parsed.counterparty, 'PERSONA ORIGEN PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 16, 9, 0));
  assert.equal(
    categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category,
    'ingreso',
  );
});

test('BCR: una compra en "CORDOBA ORO" se lee como córdobas, no como colones', () => {
  const parsed = parseFirstApproved(BCR_TARJETA_CORDOBAS);
  assert.equal(parsed.template, 'BCR tarjeta');
  assert.equal(parsed.currency, 'NIO');
  assert.equal(parsed.amountCents, 30000);
  assert.equal(parsed.counterparty, 'COMERCIO NICARAGUA PRUEBA Rivas NI');
});

test('BCR: una moneda que Movo no sabe convertir no se cuenta como colones', () => {
  const body = BCR_TARJETA_CORDOBAS.body.replace('CORDOBA ORO', 'LIBRA ESTERLINA');
  const result = parseMail({ ...BCR_TARJETA_CORDOBAS, body });
  assert.equal(result.ok, false);
});

test('BCR: una compra con tarjeta NEGADA queda marcada como negada', () => {
  const result = parseMail(BCR_TARJETA_NEGADA);
  assert.equal(result.template, 'BCR tarjeta');
  assert.equal(result.items.length, 1);

  const [item] = result.items;
  assert.equal(item.declined, true);
  assert.equal(item.status, 'Negada');
  assert.equal(item.currency, 'USD');
  assert.equal(item.amountCents, 2000);
  assert.equal(item.counterparty, 'SERVICIO DIGITAL SUB 00000000000 US');
  assert.equal(item.date, costaRicaIso(2026, 1, 15, 9, 5, 0));
  assert.equal(item.note, 'Tarjeta ****0000');
});

test('BCR: la misma tabla copiada con espacios (sin tabuladores)', () => {
  const body = BCR_TARJETA_NEGADA.body.replace(/\t/g, ' ').replace('Negada', 'Aprobada');
  const parsed = parseFirstApproved({ ...BCR_TARJETA_NEGADA, body });
  assert.ok(parsed.ok);
  assert.equal(parsed.amountCents, 2000);
  assert.equal(parsed.counterparty, 'SERVICIO DIGITAL SUB 00000000000 US');
});

test('BCR: SINPE a mí mismo desde otra entidad se lee como "entre mis cuentas"', () => {
  const parsed = parseFirstApproved(BCR_SINPE_PROPIO);
  assert.equal(parsed.direction, 'self');
  assert.equal(parsed.amountCents, 1000000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 17, 14, 0));
  assert.match(parsed.note, /Entre tus cuentas/);
  assert.match(parsed.note, /COOPENAE/);
});

// ---- Formatos del Banco Nacional ----

test('BN: el voucher de una compra con tarjeta se lee como gasto', () => {
  const parsed = parseFirstApproved(BN_VOUCHER_COMPRA);
  assert.equal(parsed.template, 'BN voucher');
  assert.equal(parsed.bank, 'BN');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 350000);
  assert.equal(parsed.counterparty, 'SUPERMERCADO DE PRUEBA SAN JOSE', 'sin el código de país del final');
  assert.equal(parsed.date, costaRicaIso(2026, 10, 20, 14, 15));
  assert.equal(parsed.note, 'Tarjeta ****0000');
});

test('BN: la versión en texto plano del voucher (sin algunos espacios) da el mismo resultado', () => {
  const fromHtml = parseFirstApproved(BN_VOUCHER_COMPRA);
  const fromPlainText = parseFirstApproved(BN_VOUCHER_COMPRA_TEXTO_PLANO);
  assert.deepEqual(fromPlainText, fromHtml);
});

test('BN: un voucher en dólares y de madrugada', () => {
  const body = BN_VOUCHER_COMPRA.body
    .replace('CRC 3500,00', 'USD 7,99')
    .replace('a las 2:15 p.m.', 'a las 12:05 a.m.')
    .replace('20 de Octubre', '3 de Setiembre');
  const parsed = parseFirstApproved({ ...BN_VOUCHER_COMPRA, body });
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 799);
  assert.equal(parsed.date, costaRicaIso(2026, 9, 3, 0, 5));
});

test('BN: se reconoce por el texto aunque el remitente no sea del banco', () => {
  const parsed = parseFirstApproved({ ...BN_VOUCHER_COMPRA, from: 'Yo <yo@correo.example>' });
  assert.equal(parsed.bank, 'BN');
  assert.equal(parsed.amountCents, 350000);
});

test('BN: un correo del banco sin comprobante no genera movimiento', () => {
  const body =
    'Estimado señor(a): CLIENTE DE PRUEBA\nReciba un cordial saludo de parte del Banco Nacional.\nTOTAL: CRC 3500,00';
  assert.equal(parseMail({ ...BN_VOUCHER_COMPRA, body }).ok, false);
});

// ---- Formatos de BAC Credomatic ----

test('BAC: compra con tarjeta aprobada', () => {
  const parsed = parseFirstApproved(BAC_COMPRA_APROBADA);
  assert.equal(parsed.template, 'BAC tarjeta');
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.type, 'tarjeta');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1500000);
  assert.equal(parsed.counterparty, 'SUPERMERCADO DE PRUEBA');
  assert.equal(parsed.date, costaRicaIso(2026, 10, 18, 19, 15));
  assert.equal(parsed.note, 'Tarjeta ****0000');
  assert.equal(
    categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category,
    'super',
  );
});

test('BAC: la versión en texto plano de la compra con tarjeta da el mismo resultado', () => {
  const fromTabs = parseFirstApproved(BAC_COMPRA_APROBADA);
  const fromPlainText = parseFirstApproved(BAC_COMPRA_TEXTO_PLANO);
  assert.deepEqual(fromPlainText, fromTabs);
});

test('BAC: compra con tarjeta en dólares', () => {
  const parsed = parseFirstApproved(BAC_COMPRA_DOLARES);
  assert.equal(parsed.currency, 'USD');
  assert.equal(parsed.amountCents, 2000);
  assert.equal(parsed.counterparty, 'SERVICIO DIGITAL SUB 00000000000 US');
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 9, 0));
  assert.equal(parsed.note, 'Tarjeta ****0000');
});

test('BAC: una compra con tarjeta rechazada queda marcada como negada', () => {
  const result = parseMail(BAC_TARJETA_NEGADA);
  assert.equal(result.template, 'BAC tarjeta');
  assert.equal(result.items.length, 1);

  const [item] = result.items;
  assert.equal(item.declined, true);
  assert.equal(item.status, 'COMPRA RECHAZADA');
  assert.equal(item.currency, 'CRC');
  assert.equal(item.amountCents, 1500000);
  assert.equal(item.counterparty, 'SUPERMERCADO DE PRUEBA');
  assert.equal(item.date, costaRicaIso(2026, 10, 18, 19, 15));
  assert.equal(item.note, 'Tarjeta ****0000');
});

test('BAC: SINPE recibido se lee como ingreso', () => {
  const parsed = parseFirstApproved(BAC_SINPE_RECIBIDO);
  assert.equal(parsed.template, 'BAC SINPE');
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'in');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 1000000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 15, 14, 31, 22));
  assert.match(parsed.note, /Motivo: prueba SINPE/);
  assert.match(parsed.note, /Cuenta \*\*\*\*0000/);
  assert.equal(
    categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category,
    'ingreso',
  );
});

test('BAC: SINPE enviado se lee como gasto', () => {
  const parsed = parseFirstApproved(BAC_SINPE_ENVIADO);
  assert.equal(parsed.template, 'BAC SINPE');
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.type, 'sinpe');
  assert.equal(parsed.direction, 'out');
  assert.equal(parsed.currency, 'CRC');
  assert.equal(parsed.amountCents, 500000);
  assert.equal(parsed.date, costaRicaIso(2026, 1, 16, 12, 45, 10));
  assert.match(parsed.note, /Motivo: pago almuerzo/);
  assert.match(parsed.note, /Cuenta \*\*\*\*0000/);
  assert.equal(
    categorize({ counterparty: parsed.counterparty, type: parsed.type, direction: parsed.direction }).category,
    'transfer',
  );
});

test('BAC: se reconoce por el texto aunque el remitente no sea del banco', () => {
  const parsed = parseFirstApproved({ ...BAC_COMPRA_APROBADA, from: 'Yo <yo@correo.example>' });
  assert.equal(parsed.bank, 'BAC');
  assert.equal(parsed.amountCents, 1500000);
});

test('BAC: un correo del banco sin comprobante ni movimiento no genera movimiento', () => {
  const body = 'Hola CLIENTE DE PRUEBA\nConozca más de nuestras promociones ingresando a https://www.baccredomatic.com';
  assert.equal(parseMail({ from: 'BAC Credomatic <notificaciones@baccredomatic.cr>', body }).ok, false);
});

test('el remitente manda sobre la plantilla para decidir el banco', () => {
  const mail = { ...BCR_SINPE_ENVIADO, from: 'Avisos <avisos@davivienda.example>' };
  assert.equal(parseMail(mail).bank, 'DAVIVIENDA');
});

// ---- Monedas: colones, dólares y euros ----

test('detectCurrency reconoce colones, dólares y euros', () => {
  const cases = [
    ['COLONES', 'CRC'],
    ['CRC', 'CRC'],
    ['₡', 'CRC'],
    ['US DOLLAR', 'USD'],
    ['USD', 'USD'],
    ['$', 'USD'],
    ['EURO', 'EUR'],
    ['EUROS', 'EUR'],
    ['EUR', 'EUR'],
    ['€', 'EUR'],
    ['', 'CRC'],
  ];
  for (const [text, expected] of cases) assert.equal(detectCurrency(text), expected, text);
});

test('BCR: una compra con tarjeta en euros', () => {
  const body = BCR_TARJETA_NEGADA.body.replace('US DOLLAR', 'EURO').replace('Negada', 'Aprobada');
  const parsed = parseFirstApproved({ ...BCR_TARJETA_NEGADA, body });
  assert.equal(parsed.currency, 'EUR');
  assert.equal(parsed.amountCents, 2000);

  const copiedWithSpaces = parseFirstApproved({ ...BCR_TARJETA_NEGADA, body: body.replace(/\t/g, ' ') });
  assert.equal(copiedWithSpaces.currency, 'EUR', 'también si la tabla se copió sin tabuladores');
});

test('BN: un voucher en euros', () => {
  const body = BN_VOUCHER_COMPRA.body.replace('CRC 3500,00', 'EUR 12,50');
  const parsed = parseFirstApproved({ ...BN_VOUCHER_COMPRA, body });
  assert.equal(parsed.currency, 'EUR');
  assert.equal(parsed.amountCents, 1250);
});

test('las compras en euros de la demo se leen en euros en los tres bancos', () => {
  for (const bank of ['BAC', 'BN', 'BCR']) {
    const mail = buildBankMail({
      bank,
      type: 'tarjeta',
      counterparty: 'TIENDA EN MADRID',
      amount: 49.9,
      currency: 'EUR',
    });
    const parsed = parseFirstApproved(mail);
    assert.equal(parsed.currency, 'EUR', bank);
    assert.equal(parsed.amountCents, 4990, bank);
  }
});
