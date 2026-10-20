// Notificaciones de Davivienda con la estructura de las reales, pero con TODOS los datos
// reemplazados por valores ficticios: nombres, cuentas, IBAN, tarjeta, referencias, comercio, IP, montos y fechas.
// Antes de agregar un correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).
//
// Todo llega del mismo remitente, salvo el estado de cuenta. Las versiones HTML están en davivienda-html/.

const DAVIVIENDA_SENDER = 'TRANSACCIÓN DAVIVIENDA <bancavirtual@davivienda.cr>';
const NOTICES_SENDER = 'NOTIFICACIONES Davivienda <bancavirtual@davivienda.cr>';
const FOOTER = `En Davivienda estamos a su servicio.
Este mensaje es generado automáticamente. Si usted no reconoce esta transacción, por favor comuníquese de inmediato a través de cualquiera de los siguientes canales:
Teléfono Rojo: 2287-1111
Chat de atención en línea
Correo electrónico: CostaRica_Clientes@davivienda.cr`;

// ---- Movimientos en la cuenta (débito = gasto, crédito = ingreso). No dicen a quién fue el dinero. ----

// Un SINPE enviado desde la app: Davivienda lo avisa como débito en la cuenta.
export const DAVIVIENDA_CUENTA_DEBITO = {
  from: DAVIVIENDA_SENDER,
  subject: 'TRANSACCIÓN DAVIVIENDA 15/01/2026 10:30:22 AM',
  body: `Estimado(a) Cliente CLIENTE DE PRUEBA
Davivienda le informa que se realizó un débito en su cuenta de ahorros terminada en 0000
Fecha y hora:\t15/01/2026, a las 10:30:15
Monto:\tCRC 12500.00
Concepto:\tTransferencia SINPE
Referencia:\t[0000001]
${FOOTER}`,
};

export const DAVIVIENDA_CUENTA_CREDITO = {
  from: DAVIVIENDA_SENDER,
  subject: 'TRANSACCIÓN DAVIVIENDA 31/01/2026 23:49:50 PM',
  body: `Estimado(a) Cliente CLIENTE DE PRUEBA
Davivienda le informa que se realizó un crédito en su cuenta de ahorros terminada en 0000
Fecha y hora:\t31/01/2026, a las 23:49:21
Monto:\tCRC 1.50
Concepto:\tPago intereses
Referencia:\t[0000001]
${FOOTER}`,
};

// ---- Compra con tarjeta ----

export const DAVIVIENDA_TARJETA_COMPRA = {
  from: 'NOTIFICACION POR TRANSACCION DE DAVIVIENDA <bancavirtual@davivienda.cr>',
  subject: 'Notificación por transacción de Davivienda 17/01/2026 18:15:46 PM',
  body: `Estimado(a) Cliente CLIENTE DE PRUEBA
Davivienda le informa que se realizó una transacción en:
Comercio:\tRESTAURANTE DE PRUEBA
Ciudad y País:\tALAJUELA, CR
Fecha y Hora:\t17/01/2026, a las 18:15:31
Marca de Tarjeta:\tTarjeta VISA terminada en *0000
Autorización:\t000000
Referencia:\t0000001
Monto:\tCRC 8750.00
${FOOTER}`,
};

// ---- Transferencia recibida: llega cuando le depositan a la persona (lo que ella envía llega como débito). ----

export const DAVIVIENDA_TRANSFERENCIA_RECIBIDA = {
  from: NOTICES_SENDER,
  subject: 'TRANSFERENCIA REALIZADA | 15/01/2026 12:11:46 p.m.',
  body: `Estimado cliente
Deseamos notificarle que se realizó la siguiente transacción:
Cuenta origen:\tCTE - CR00000000000000000000 CRC EMPRESA DE PRUEBA SOCIEDAD ANONIMA
Cuenta destino:\tAHO - CR00000000000000000001 CRC CLIENTE DE PRUEBA
Monto:\t250000.00 CRC
Fecha y hora:\t15/01/2026 12:11:46 PM
No. Comprobante:\t0000000000000000000000001
Detalle:\tPAGO DE PRUEBA
En Davivienda estamos a su servicio.
Este mensaje es generado de forma automática, si usted no realizó esta solicitud, por su seguridad favor comunicarse de inmediato a nuestro teléfono rojo al 2287-1111 o visite cualquiera de nuestras sucursales.`,
};

// ---- Avisos que NO son movimientos (el lector debe ignorarlos) ----

export const DAVIVIENDA_INICIO_SESION = {
  from: 'NOTIFICACIÓN INICIO DE SESIÓN <bancavirtual@davivienda.cr>',
  subject: 'Notificaciones Davivienda por Ingreso a canales digitales 15/01/2026 08:15:16 AM',
  body: `Estimado(a) Cliente CLIENTE DE PRUEBA
Usted ha ingresado exitosamente a nuestra App Davivienda Costa Rica.
Fecha:\t15/01/2026
Hora:\t08:15:11 AM
Dirección IP:\t0.0.0.0
Referencia:\t[0000001]
Si usted no realizó el ingreso, diríjase a “Olvidó su clave” y registre una nueva contraseña que solo usted conozca.
Si requiere más información llamar al (506) 2287-1111.`,
};

export const DAVIVIENDA_CAMBIO_DISPOSITIVO = {
  from: NOTICES_SENDER,
  subject: 'Notificación Davivienda por cambio de dispositivo principal en el APP | 15/01/2026 19:19:36 p.m.',
  body: `Estimado(a) Cliente: CLIENTE DE PRUEBA
Davivienda le informa que se ha solicitado un cambio de dispositivo celular como principal para la APP Davivienda Costa Rica.
El día 15/01/2026 a las 07:18:06 PM horas; desde la IP 0.0.0.0
Si requiere más información llamar al (506) 2287-1111.`,
};

// Solo es la solicitud: el retiro, cuando ocurre, llega después como débito en la cuenta.
export const DAVIVIENDA_RETIRO_SIN_TARJETA = {
  from: NOTICES_SENDER,
  subject: 'SOLICITUD DE RETIRO EN ATM SIN TARJETA | 15/01/2026 19:41:39 p.m.',
  body: `Estimado Cliente:
Usted ha realizado una solicitud de retiro en ATM sin tarjeta. por un monto de : ¢20000.00
Fecha:\t15/01/2026
Hora:\t07:41:39 PM
En Davivienda estamos a su servicio.`,
};

// Llega de otro remitente y trae el detalle en un PDF adjunto (aquí no se incluye).
export const DAVIVIENDA_ESTADO_DE_CUENTA = {
  from: 'Davivienda Estados de Cuenta <costarica_estadoscta@davivienda.cr>',
  subject: '00000000-Estado de Cuenta Davivienda al Corte: 15/01/2026',
  body: `Estimado cliente
CLIENTE DE PRUEBA
A continuación encontrará los movimientos de su estado de Cuenta Maestra en un archivo adjunto (PDF) con los detalles del mismo.
•\tFecha de corte: 15/01/2026
•\tFecha de pago mínimo:
•\tFecha de pago de contado:
¿Ya hizo su ahorro hormiga del mes? Ahorre ¢50.000 en su cuenta Davivienda y participe por premios en efectivo. Más información en www.Davivienda.cr`,
};
