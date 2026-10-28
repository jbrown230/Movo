// Notificaciones de Banco Popular con la estructura de las reales, pero con TODOS los datos
// reemplazados por valores ficticios: nombres, cédulas, teléfonos, cuentas, IBAN, tarjeta, códigos, comercios,
// montos y fechas. Antes de agregar un correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).
//
// Las versiones HTML están en popular-html/ (solo la parte del correo original del banco).

const CARD_SENDER = 'Banco Popular <tarjetaBPnotifica@bancopopularinforma.fi.cr>';
const NOTICES_SENDER = '<BPNotifica@bpdc.fi.cr>';
const CARD_FOOTER = `Cualquier duda o consulta sobre la transacción, comuníquese
al teléfono 800-257-0422, cuyo horario de atención es 24/7, los 365 días del año. También puede escribir al correo electrónico CallCenter800Tarjetas@bp.fi.cr, el cual tiene un horario de atención de lunes a viernes de 8:00am a 4:30pm, el tiempo de respuesta promedio es de 1 día hábil.`;

// ---- Compras con tarjeta de crédito: el comercio trae la ciudad y el país; el monto va pegado a la moneda ----

export const POPULAR_TARJETA_COLONES = {
  from: CARD_SENDER,
  subject: 'Transacción Tarjeta Crédito VISA BP',
  body: `Estimado (a) cliente,
El Banco Popular le informa de la transacción realizada en VERDULERIA DE PRUEBA     GUANACASTE   CR el 15/01/2026 a las 16:49, con la tarjeta VISA ORO PREF. SIN P 0000, Auth # 000000, Ref # 000000000001, por  12,500.00Colones
${CARD_FOOTER}`,
};

export const POPULAR_TARJETA_DOLARES = {
  from: CARD_SENDER,
  subject: 'Transacción Tarjeta Crédito VISA BP',
  body: `Estimado (a) cliente,
El Banco Popular le informa de la transacción realizada en RESTAURANTE DE PRUEBA    GRANADA      NI el 16/01/2026 a las 11:56, con la tarjeta VISA ORO PREF. SIN P 0000, Auth # 000000, Ref # 000000000002, por  25.50Dolares US
${CARD_FOOTER}`,
};

// ---- Comprobantes SINPE: llegan por los enviados (débito) y por los recibidos (crédito) ----

export const POPULAR_SINPE_ENVIADO = {
  from: NOTICES_SENDER,
  subject: 'Comprobante de transacción SINPE',
  body: `Estimado cliente, el Banco Popular le informa que ha transferido un Sinpe Móvil del teléfono 80000001 por un monto de 3,500.00 CRC al teléfono 80000002 de PERSONA DESTINO PRUEBA. Referencia 0000000000000000000000001.Fecha y hora 15/01/2026 08:30:27 PM En caso de duda o consulta por favor comunicarse al 2202-2020 o al correo electrónico Popularenlinea@bp.fi.cr
Transacción SINPE
Referencia SINPE:\t\t0000000000000000000000001
Número Comprobante:\t\tFT00000A0000
Fecha:\t\t15/01/2026 08:30:27 PM
Estado de la Transacción:\t\tAplicado
Canal Origen:\t\tBanca Móvil
Servicio SINPE:\t\tSinpe Móvil
Nombre Origen:\t\tCLIENTE DE PRUEBA
Identificación Origen:\t\t00-0000-0000
Origen de Fondos:\t\t80000001
Nombre Destino:\t\tPERSONA DESTINO PRUEBA
Identificación Destino:\t\t00-0000-0000
Entidad Destino:\t\t0151-Banco Nacional de Costa Rica
Teléfono Destino:\t\t80000002
Moneda:\t\tCRC
Monto Enviado:\t\t3,500.00
Comisión:\t\t00.00
Total debitado:\t\t3,500.00
Descripción:\t\tprueba SINPE
Tipo de Movimiento:\t\tDébito`,
};

// En los recibidos el banco recorta los nombres a 20 letras y cambia los espacios por "_".
export const POPULAR_SINPE_RECIBIDO = {
  from: NOTICES_SENDER,
  subject: 'Comprobante transacción SINPE',
  body: `Estimado cliente,
Adjunto encontrará su comprobante de Transacción
En caso de duda o consulta por favor comunicarse al 22022020 o al correo electrónico BancaFacilPopularenLinea@bp.fi.cr
Transacción SINPE
Referencia SINPE:\t\t0000000000000000000000002
Número Comprobante:\t\tFT000000A0AA
Fecha:\t\t16/01/2026 12:31:32
Estado de la Transacción:\t\tAplicada
Canal Origen:\t\tPIN Entrante Cuenta Fondos Nacional
Servicio SINPE:\t\tPagos Inmediatos
Nombre Origen:\t\tPERSONA_ORIGEN_PRUEBA
Identificación Origen:\t\t00-0000-0000
Iban Origen:\t\tCR00**************0000
Nombre Destino:\t\tCLIENTE__DE_PRUEBA
Identificación Destino:\t\t00-0000-0000
Iban Destino:\t\tCR00**************0000
Monto Enviado:\t\t150,000.00
Moneda:\t\tCRC
Descripción:\t\tPago_Prueba_____
Tipo de movimiento:\t\tCrédito`,
};

// ---- Avisos que hoy NO se leen ----

// Aviso de movimiento en la cuenta. Llega junto con otros avisos de la misma plata (ver POPULAR_DTR_ENVIADO).
export const POPULAR_CUENTA_CREDITO = {
  from: '<BPnotifica@bpdc.fi.cr>',
  subject: 'Notificacion de Transaccion BPDC',
  body: 'Estimado (a) CLIENTE DE PRUEBA: El Banco Popular le informa que se le acredito  a su cuenta ******0000, un monto de 100000.00 en moneda CRC a las 10:35 del dia 17 JAN 2026, codigo de transaccion 0000000000000000000000003. Cualquier consulta o duda sobre la transaccion, escribanos a popularenlinea@bp.fi.cr o bien comuniquese al telefono 2202-2020. Gracias por utilizar los productos y/o servicios del Banco Popular.',
};

// Débito en tiempo real (DTR): la persona se trajo plata de otra cuenta suya. Es el MISMO dinero que el aviso de arriba.
export const POPULAR_DTR_ENVIADO = {
  from: '<BPSinpe@bpdc.fi.cr>',
  subject: 'Banco Popular Informa',
  body: `Estimado cliente, el Banco Popular le informa que usted ha enviado un débito en tiempo real (DTR) a CLIENTE DE PRUEBA por un monto de 100,000.00 colones. Descripción: pago de prueba___. Cod. Referencia: 0000000000000000000000003.
Transacción hecha el: 17/01/2026 10:35:10
Gracias por utilizar nuestros servicios SINPE en tiempo real.`,
};

// Los SINPE hechos desde Banca Móvil mandan el comprobante solo en un PDF adjunto: el correo no trae datos.
export const POPULAR_BANCA_MOVIL_PDF = {
  from: '<bancamovil@bpdc.fi.cr>',
  subject: 'Banca Móvil / Notificación transferencia SINPE',
  body: 'En el adjunto encontrará el comprobante de la transferencia SINPE realizada.',
};
