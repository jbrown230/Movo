// Notificaciones del Banco Nacional con la estructura de las reales, pero con TODOS los datos
// reemplazados por valores ficticios: nombre, tarjeta, autorización, referencia, comercio, monto y fecha.
// Antes de agregar un correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).

const BN_SENDER = 'BN Contacto Digital <bncontacto@bncr.fi.cr>';
const FOOTER =
  'Estimado cliente, esta notificación es generada de forma automática de acuerdo con lo establecido por el Banco Central de Costa Rica, en su Reglamento del Sistema de Tarjetas de Pago, por lo que agradecemos no responder este correo.';

// Tal como queda el HTML del comprobante al convertirlo (celdas separadas por tabulador).
export const BN_VOUCHER_COMPRA = {
  from: BN_SENDER,
  subject: 'Voucher Digital',
  body: `Estimado señor(a): CLIENTE DE PRUEBA
Reciba un cordial saludo de parte del Banco Nacional.
Por este medio le hacemos llegar el comprobante de Compra realizada en SUPERMERCADO DE PRUEBA SAN JOSE CRI el 20 de Octubre de 2026 a las 2:15 p.m.
SUPERMERCADO DE PRUEBA SAN JOSE CRI
Oct 20, 2026 - 2:15 p.m.
MASTERCARD\t************0000
NRO. AUT:\t000000
REF:\t00000000
TOTAL:\tCRC 3500,00
${FOOTER}`,
};

// La parte en texto plano del mismo correo: sin tabuladores, con varios espacios antes del país
// y sin espacio en "Comprarealizada" ni en "2026a las".
export const BN_VOUCHER_COMPRA_TEXTO_PLANO = {
  from: BN_SENDER,
  subject: 'Voucher Digital',
  body: `Estimado señor(a): CLIENTE DE PRUEBA
Reciba un cordial saludo de parte del Banco Nacional.

Por este medio le hacemos llegar el comprobante de Comprarealizada en SUPERMERCADO DE PRUEBA SAN JOSE    CRI el 20 de Octubre de 2026a las 2:15 p.m.

SUPERMERCADO DE PRUEBA SAN JOSE    CRI
Oct 20, 2026 - 2:15 p.m.
MASTERCARD************0000
NRO. AUT:
000000
REF:
00000000
TOTAL:
CRC 3500,00
${FOOTER}`,
};
