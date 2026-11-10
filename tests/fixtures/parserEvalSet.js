// Conjunto de evaluación del lector de correos (issue 30): correos con su respuesta correcta,
// escrita a mano. Lo usa scripts/parser-vs-llm.mjs para comparar el lector por reglas contra un
// modelo de lenguaje. Todo es ficticio o anonimizado (la prueba de tests/privacy lo revisa).
//
// Cinco grupos:
//   real        estructura de correos reales (los mismos fixtures de las pruebas del lector).
//   variación   el mismo correo real con un cambio que un banco podría hacer: otra etiqueta, otro
//               formato de monto o fecha, columnas en otro orden. Simula un rediseño de la plantilla.
//   sin mov.    correos de bancos que traen montos pero no son un movimiento (publicidad, saldos,
//               códigos). La respuesta correcta es "ningún movimiento".
//   sin plant.  bancos sin plantilla en Movo (Davivienda y Promerica). Formatos INVENTADOS: todavía
//               no tenemos correos reales de esos bancos (issues 27 y 28).
//   demo        correos del generador sintético de la demo (web/src/demo/mailBuilder.js).
//
// Cada movimiento esperado: tipo, dirección, moneda, monto (en unidades), contraparte, fecha (ISO en
// UTC; los correos escriben hora de Costa Rica, UTC−6) y si el banco lo negó. Contraparte null =
// el correo no la dice y no se califica.

import { buildBankMail } from '../../web/src/demo/mailBuilder.js';
import { BAC_COMPRA_APROBADA, BAC_COMPRA_DOLARES, BAC_COMPRA_TEXTO_PLANO, BAC_SINPE_ENVIADO } from './bacMails.js';
import { BAC_SINPE_RECIBIDO, BAC_TARJETA_NEGADA } from './bacMails.js';
import { BN_VOUCHER_COMPRA, BN_VOUCHER_COMPRA_TEXTO_PLANO } from './bnMails.js';
import { BCR_SINPE_ENVIADO, BCR_SINPE_PROPIO, BCR_SINPE_RECIBIDO, BCR_TARJETA_NEGADA } from './bcrMails.js';

const costaRica = (year, month, day, hour, minute, second = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second)).toISOString();

const movement = (type, direction, currency, amount, counterparty, date, declined = false) => ({
  type,
  direction,
  currency,
  amount,
  counterparty,
  date,
  declined,
});
const card = (currency, amount, counterparty, date, declined) =>
  movement('tarjeta', 'out', currency, amount, counterparty, date, declined);

const replaceAll = (mail, pairs) => ({
  ...mail,
  body: pairs.reduce((body, [from, to]) => body.replaceAll(from, to), mail.body),
});

// ---------------------------------------------------------------- real

const BAC_SUPER = card('CRC', 15000, 'SUPERMERCADO DE PRUEBA', costaRica(2026, 10, 18, 19, 15));
const BN_SUPER = card('CRC', 3500, 'SUPERMERCADO DE PRUEBA SAN JOSE', costaRica(2026, 10, 20, 14, 15));
const BCR_SINPE_OUT = movement(
  'sinpe',
  'out',
  'CRC',
  0.15,
  'PERSONA DESTINO PRUEBA',
  costaRica(2026, 1, 15, 10, 30),
);

const BCR_TARJETA_VARIAS_FILAS = {
  from: 'BCR Tarjetas <bcrtarjestcta@bancobcr.com>',
  subject: 'Notificación de Transacciones BCR',
  body: `Transacciones en su tarjeta BCR: ****-****-****-0000
Estimado (a) cliente:
Le informamos la siguiente transacción realizada con su tarjeta BCR :
Detalle de Transacciones
Fecha\tAutorización\tNo.Referencia\tMonto\tMoneda\tComercio\tEstado
04/01/2026 18:05:12\t000001\t000000000002\t18,750.00\tCOLONES\tAUTOMERCADO ESCAZU\tAprobada
04/01/2026 18:40:00\t00000000\t000000000003\t9.99\tUS DOLLAR\tSTEAM GAMES\tNegada
04/01/2026 19:02:30\t000002\t000000000004\t3,200.00\tCOLONES\tSODA LA CEIBA\tAprobada
En caso de dudas respecto a las transacciones notificadas, escribir al WhatsApp y utilice las opciones disponibles.`,
};

const REAL = [
  ['bac-compra', BAC_COMPRA_APROBADA, [BAC_SUPER]],
  ['bac-compra-texto-plano', BAC_COMPRA_TEXTO_PLANO, [BAC_SUPER]],
  [
    'bac-compra-dolares',
    BAC_COMPRA_DOLARES,
    [card('USD', 20, 'SERVICIO DIGITAL SUB 00000000000 US', costaRica(2026, 1, 15, 9, 0))],
  ],
  ['bac-compra-rechazada', BAC_TARJETA_NEGADA, [{ ...BAC_SUPER, declined: true }]],
  [
    'bac-sinpe-recibido',
    BAC_SINPE_RECIBIDO,
    [movement('sinpe', 'in', 'CRC', 10000, null, costaRica(2026, 1, 15, 14, 31, 22))],
  ],
  [
    'bac-sinpe-enviado',
    BAC_SINPE_ENVIADO,
    [movement('sinpe', 'out', 'CRC', 5000, null, costaRica(2026, 1, 16, 12, 45, 10))],
  ],
  ['bn-voucher', BN_VOUCHER_COMPRA, [BN_SUPER]],
  ['bn-voucher-texto-plano', BN_VOUCHER_COMPRA_TEXTO_PLANO, [BN_SUPER]],
  ['bcr-sinpe-enviado', BCR_SINPE_ENVIADO, [BCR_SINPE_OUT]],
  [
    'bcr-sinpe-recibido',
    BCR_SINPE_RECIBIDO,
    [movement('sinpe', 'in', 'CRC', 5000, 'PERSONA ORIGEN PRUEBA', costaRica(2026, 1, 16, 9, 0))],
  ],
  [
    'bcr-sinpe-propio',
    BCR_SINPE_PROPIO,
    [
      movement(
        'sinpe',
        'self',
        'CRC',
        10000,
        'APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2',
        costaRica(2026, 1, 17, 14, 0),
      ),
    ],
  ],
  [
    'bcr-tarjeta-negada',
    BCR_TARJETA_NEGADA,
    [card('USD', 20, 'SERVICIO DIGITAL SUB 00000000000 US', costaRica(2026, 1, 15, 9, 5), true)],
  ],
  [
    'bcr-tarjeta-varias-filas',
    BCR_TARJETA_VARIAS_FILAS,
    [
      card('CRC', 18750, 'AUTOMERCADO ESCAZU', costaRica(2026, 1, 4, 18, 5, 12)),
      card('USD', 9.99, 'STEAM GAMES', costaRica(2026, 1, 4, 18, 40), true),
      card('CRC', 3200, 'SODA LA CEIBA', costaRica(2026, 1, 4, 19, 2, 30)),
    ],
  ],
];

// ---------------------------------------------------------------- variación

const VARIATION = [
  ['bac-compra-importe', replaceAll(BAC_COMPRA_APROBADA, [['Monto:', 'Importe:']]), [BAC_SUPER]],
  [
    'bac-compra-fecha-numerica',
    replaceAll(BAC_COMPRA_APROBADA, [['Fecha:\tOct 18, 2026, 19:15', 'Fecha:\t18/10/2026 19:15']]),
    [BAC_SUPER],
  ],
  [
    'bac-compra-simbolo-colon',
    replaceAll(BAC_COMPRA_APROBADA, [['Monto:\tCRC 15,000.00', 'Monto:\t₡15.000,00']]),
    [BAC_SUPER],
  ],
  [
    'bac-compra-orden-distinto',
    replaceAll(BAC_COMPRA_APROBADA, [
      ['Comercio:\tSUPERMERCADO DE PRUEBA\n', ''],
      ['Monto:\tCRC 15,000.00', 'Monto:\tCRC 15,000.00\nEstablecimiento:\tSUPERMERCADO DE PRUEBA'],
    ]),
    [BAC_SUPER],
  ],
  [
    'bac-sinpe-moneda-codigo',
    replaceAll(BAC_SINPE_ENVIADO, [['por un monto de 5,000.00 Colones', 'por un monto de CRC 5,000.00']]),
    [movement('sinpe', 'out', 'CRC', 5000, null, costaRica(2026, 1, 16, 12, 45, 10))],
  ],
  ['bn-voucher-monto-total', replaceAll(BN_VOUCHER_COMPRA, [['TOTAL:', 'MONTO TOTAL:']]), [BN_SUPER]],
  [
    'bn-voucher-ingles',
    {
      ...BN_VOUCHER_COMPRA,
      subject: 'Digital Voucher',
      body: `Dear customer: CLIENTE DE PRUEBA
Banco Nacional sends you the receipt for the Purchase made at TIENDA DE PRUEBA MIAMI USA on October 20, 2026 at 2:15 p.m.
TIENDA DE PRUEBA MIAMI USA
MASTERCARD\t************0000
AUTH NO:\t000000
REF:\t00000000
TOTAL:\tUSD 12.50
This notification is generated automatically, please do not reply.`,
    },
    [card('USD', 12.5, 'TIENDA DE PRUEBA MIAMI', costaRica(2026, 10, 20, 14, 15))],
  ],
  [
    'bcr-sinpe-monto-europeo',
    replaceAll(BCR_SINPE_RECIBIDO, [['Monto: 5,000.00', 'Monto: ₡5.000,00']]),
    [movement('sinpe', 'in', 'CRC', 5000, 'PERSONA ORIGEN PRUEBA', costaRica(2026, 1, 16, 9, 0))],
  ],
  [
    'bcr-sinpe-otra-redaccion',
    replaceAll(BCR_SINPE_ENVIADO, [['se le ha debitado de su cuenta BCR', 'se rebajó de su cuenta BCR']]),
    [BCR_SINPE_OUT],
  ],
  [
    'bcr-tarjeta-columnas-reordenadas',
    replaceAll(BCR_TARJETA_NEGADA, [
      ['Fecha\tAutorización\tNo.Referencia\tMonto\tMoneda\tComercio\tEstado', 'Fecha\tComercio\tMoneda\tMonto\tEstado'],
      [
        '15/01/2026 09:05:00\t00000000\t000000000001\t20.00\tUS DOLLAR\tSERVICIO DIGITAL SUB 00000000000 US\tNegada',
        '15/01/2026 09:05:00\tSERVICIO DIGITAL SUB 00000000000 US\tUS DOLLAR\t20.00\tAprobada',
      ],
    ]),
    [card('USD', 20, 'SERVICIO DIGITAL SUB 00000000000 US', costaRica(2026, 1, 15, 9, 5))],
  ],
];

// ---------------------------------------------------------------- sin movimiento

const NO_MOVEMENT = [
  [
    'bac-promocion',
    {
      from: 'BAC Credomatic <notificaciones@baccredomatic.cr>',
      subject: 'Tasa 0 en compras desde ₡50,000',
      body: `Hola CLIENTE DE PRUEBA
Este mes, sus compras desde CRC 50,000.00 con su tarjeta BAC se pueden pasar a Tasa 0 a 12 meses.
Monto mínimo: CRC 50,000.00
Comercio: todos los comercios afiliados
Válido del 01/10/2026 al 31/10/2026. Aplican restricciones.
Conozca más de nuestras promociones, productos y servicios ingresando a: https://www.baccredomatic.com/es-cr`,
    },
    [],
  ],
  [
    'bcr-estado-de-cuenta',
    {
      from: 'BCR Tarjetas <bcrtarjestcta@bancobcr.com>',
      subject: 'Su estado de cuenta está disponible',
      body: `Estimado (a) cliente:
Su estado de cuenta de la tarjeta BCR ****-****-****-0000 con corte al 15/10/2026 ya está disponible.
Saldo al corte: 125,000.00 COLONES
Pago mínimo: 12,500.00 COLONES
Fecha límite de pago: 30/10/2026
Por favor, no escriba a esta dirección de correo.`,
    },
    [],
  ],
  [
    'bac-recordatorio-pago',
    {
      from: 'BAC Credomatic <notificaciones@baccredomatic.cr>',
      subject: 'Recordatorio de pago',
      body: `Hola CLIENTE DE PRUEBA
Le recordamos que el pago de su tarjeta AMEX ***********0000 por CRC 80,000.00 vence el 25/10/2026.
Si ya realizó el pago, omita este mensaje.`,
    },
    [],
  ],
  [
    'bn-codigo-verificacion',
    {
      from: 'BN Contacto Digital <bncontacto@bncr.fi.cr>',
      subject: 'Código de verificación',
      body: `Estimado señor(a): CLIENTE DE PRUEBA
Su código para autorizar una transferencia de CRC 25000,00 es 000000. Vence en 5 minutos.
Si usted no solicitó este código, comuníquese con el Banco Nacional.`,
    },
    [],
  ],
  [
    'bcr-cambio-clave',
    {
      from: 'BCR Mensajero <mensajero@bancobcr.com>',
      subject: 'Cambio de contraseña',
      body: `Estimado (a): CLIENTE DE PRUEBA
Le informamos que la contraseña de BCR Móvil se cambió el 15/01/2026 a las 10:30 AM.
Si usted no hizo este cambio, contáctenos.`,
    },
    [],
  ],
  [
    'promerica-boletin',
    {
      from: 'Banco Promerica <boletin@promerica.example>',
      subject: 'Gane hasta ₡1.000.000 en premios',
      body: `Hola CLIENTE DE PRUEBA
Por cada compra de ₡10.000 con su tarjeta Promerica participa en el sorteo de ₡1.000.000.
Promoción válida hasta el 30/11/2026.`,
    },
    [],
  ],
];

// ---------------------------------------------------------------- banco sin plantilla (formatos inventados)

const NO_TEMPLATE = [
  [
    'davivienda-compra',
    {
      from: 'Davivienda <alertas@davivienda.example>',
      subject: 'Alerta de compra con su tarjeta',
      body: `Davivienda le informa:
Se realizó una compra con su tarjeta Visa terminada en 0000.
Establecimiento: FARMACIA DE PRUEBA
Valor: ₡8.450,00
Fecha y hora: 12/10/2026 08:20
Si no reconoce esta transacción, llame al centro de atención.`,
    },
    [card('CRC', 8450, 'FARMACIA DE PRUEBA', costaRica(2026, 10, 12, 8, 20))],
  ],
  [
    'davivienda-transferencia-recibida',
    {
      from: 'Davivienda <alertas@davivienda.example>',
      subject: 'Recibió una transferencia',
      body: `Davivienda le informa:
Recibió una transferencia SINPE de PERSONA ORIGEN PRUEBA por ₡25.000,00 el 13/10/2026 a las 17:40.
Cuenta destino: ****0000`,
    },
    [movement('sinpe', 'in', 'CRC', 25000, 'PERSONA ORIGEN PRUEBA', costaRica(2026, 10, 13, 17, 40))],
  ],
  [
    'promerica-compra',
    {
      from: 'Banco Promerica <notificaciones@promerica.example>',
      subject: 'Notificación de consumo',
      body: `Estimado cliente,
Le notificamos el siguiente consumo con su tarjeta ****0000:
Comercio\tRESTAURANTE DE PRUEBA
Monto\tUSD 45.80
Fecha\t2026-10-14 21:05
Estado\tAPROBADO`,
    },
    [card('USD', 45.8, 'RESTAURANTE DE PRUEBA', costaRica(2026, 10, 14, 21, 5))],
  ],
  [
    'promerica-sinpe-enviado',
    {
      from: 'Banco Promerica <notificaciones@promerica.example>',
      subject: 'SINPE Móvil enviado',
      body: `Estimado cliente,
Usted envió un SINPE Móvil de ₡12.000,00 a PERSONA DESTINO PRUEBA (8000-0000) el 15/10/2026 a las 12:10 p.m.
Detalle: almuerzo`,
    },
    [movement('sinpe', 'out', 'CRC', 12000, 'PERSONA DESTINO PRUEBA', costaRica(2026, 10, 15, 12, 10))],
  ],
  [
    'promerica-compra-rechazada',
    {
      from: 'Banco Promerica <notificaciones@promerica.example>',
      subject: 'Consumo rechazado',
      body: `Estimado cliente,
Su consumo con la tarjeta ****0000 fue RECHAZADO por fondos insuficientes.
Comercio\tTIENDA EN LINEA DE PRUEBA
Monto\tUSD 120.00
Fecha\t2026-10-16 23:55`,
    },
    [card('USD', 120, 'TIENDA EN LINEA DE PRUEBA', costaRica(2026, 10, 16, 23, 55), true)],
  ],
];

// ---------------------------------------------------------------- demo (generador sintético)

const demo = (id, options, expected) => [id, buildBankMail({ phone: '80000000', ...options }), [expected]];
const demoDate = costaRica(2026, 10, 10, 13, 25);

const DEMO = [
  demo(
    'demo-bac-tarjeta',
    { bank: 'BAC', type: 'tarjeta', counterparty: 'PIZZA ROMA ESCAZU', amount: 12500, date: demoDate },
    card('CRC', 12500, 'PIZZA ROMA ESCAZU', demoDate),
  ),
  demo(
    'demo-bac-sinpe-recibido',
    { bank: 'BAC', type: 'sinpe', direction: 'in', counterparty: 'ANA EJEMPLO V', amount: 20000, date: demoDate },
    movement('sinpe', 'in', 'CRC', 20000, 'ANA EJEMPLO V', demoDate),
  ),
  demo(
    'demo-bn-tarjeta-euros',
    { bank: 'BN', type: 'tarjeta', counterparty: 'TIENDA EN MADRID', amount: 49.9, currency: 'EUR', date: demoDate },
    card('EUR', 49.9, 'TIENDA EN MADRID', demoDate),
  ),
  demo(
    'demo-bn-sinpe-enviado',
    { bank: 'BN', type: 'sinpe', counterparty: 'CARLOS EJEMPLO M', amount: 7300, date: demoDate },
    movement('sinpe', 'out', 'CRC', 7300, 'CARLOS EJEMPLO M', demoDate),
  ),
  demo(
    'demo-bcr-tarjeta-dolares',
    { bank: 'BCR', type: 'tarjeta', counterparty: 'NETFLIX.COM', amount: 7.99, currency: 'USD', date: demoDate },
    card('USD', 7.99, 'NETFLIX.COM', demoDate),
  ),
  demo(
    'demo-bcr-tarjeta-negada',
    { bank: 'BCR', type: 'tarjeta', counterparty: 'STEAM GAMES', amount: 15000, status: 'Negada', date: demoDate },
    card('CRC', 15000, 'STEAM GAMES', demoDate, true),
  ),
  demo(
    'demo-bcr-sinpe-enviado',
    { bank: 'BCR', type: 'sinpe', counterparty: 'MARIA EJEMPLO R', amount: 3500, date: demoDate },
    movement('sinpe', 'out', 'CRC', 3500, 'MARIA EJEMPLO R', demoDate),
  ),
];

const group = (name, cases) => cases.map(([id, mail, expected]) => ({ id, group: name, mail, expected }));

/** @type {Array<{id: string, group: string, mail: {from: string, subject: string, body: string}, expected: Object[]}>} */
export const PARSER_EVAL_SET = [
  ...group('real', REAL),
  ...group('variación', VARIATION),
  ...group('sin movimiento', NO_MOVEMENT),
  ...group('sin plantilla', NO_TEMPLATE),
  ...group('demo', DEMO),
];
