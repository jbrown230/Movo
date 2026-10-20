// Notificaciones de BAC Credomatic con la estructura de las reales, pero con TODOS los datos
// reemplazados por valores ficticios: nombres, teléfonos, referencias, tarjeta, comercios y fechas.
// Antes de agregar un correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).

const BAC_SENDER = 'BAC Credomatic <notificaciones@baccredomatic.cr>';

// Tal como queda el HTML del comprobante de tarjeta al convertirlo (celdas separadas por tabulador).
export const BAC_COMPRA_APROBADA = {
  from: BAC_SENDER,
  subject: 'Notificación de Transferencia SUPERMERCADO DE PRUEBA Oct 18, 2026, 19:15',
  body: `Hola CLIENTE DE PRUEBA
A continuación le detallamos la transacción realizada:
Comercio:\tSUPERMERCADO DE PRUEBA
Ciudad y país:\tALAJUELA, Costa Rica
Fecha:\tOct 18, 2026, 19:15
AMEX:\t***********0000
Autorización:\t000000
Referencia:\t00000000
Tipo de Transacción:\tCOMPRA
Monto:\tCRC 15,000.00
¿Tiene dudas sobre esta transacción?
Puede contactarnos vía WhatsApp presionando aquí. O bien escríbanos al 8742-9595 agregando la palabra "alerta".
Este comprobante de su transacción hace referencia al artículo 18 y 19 del reglamento del sistema de tarjetas de pago establecidos por el BCCR.
Conozca más de nuestras promociones, productos y servicios ingresando a: https://www.baccredomatic.com/es-cr
Comunicado válido únicamente para Costa Rica.
Políticas de privacidad\t|\tTérminos y condiciones
TODOS LOS DERECHOS RESERVADOS. 2026 © BAC INTERNATIONAL BANK`,
};

// Versión en texto plano del comprobante de compra con tarjeta (sin tabuladores, línea por línea).
export const BAC_COMPRA_TEXTO_PLANO = {
  from: BAC_SENDER,
  subject: 'Notificación de Transferencia',
  body: `Hola CLIENTE DE PRUEBA
A continuación le detallamos la transacción realizada:

Comercio:
SUPERMERCADO DE PRUEBA
Ciudad y país:
ALAJUELA, Costa Rica
Fecha:
Oct 18, 2026, 19:15
AMEX:
***********0000
Autorización:
000000
Referencia:
00000000
Tipo de Transacción:
COMPRA
Monto:
CRC 15,000.00

¿Tiene dudas sobre esta transacción?
Puede contactarnos vía WhatsApp presionando aquí. O bien escríbanos al 8742-9595 agregando la palabra "alerta".
Este comprobante de su transacción hace referencia al artículo 18 y 19 del reglamento del sistema de tarjetas de pago establecidos por el BCCR.
Conozca más de nuestras promociones, productos y servicios ingresando a: https://www.baccredomatic.com/es-cr
Comunicado válido únicamente para Costa Rica.
Políticas de privacidad | Términos y condiciones
TODOS LOS DERECHOS RESERVADOS. 2026 © BAC INTERNATIONAL BANK`,
};

// Compra con tarjeta en dólares.
export const BAC_COMPRA_DOLARES = {
  from: BAC_SENDER,
  subject: 'Notificación de Transacción',
  body: `Hola CLIENTE DE PRUEBA
A continuación le detallamos la transacción realizada:
Comercio:\tSERVICIO DIGITAL SUB 00000000000 US
Ciudad y país:\tSAN JOSE, Costa Rica
Fecha:\tJan 15, 2026, 09:00
VISA:\t***********0000
Autorización:\t000001
Referencia:\t00000001
Tipo de Transacción:\tCOMPRA
Monto:\tUSD 20.00
¿Tiene dudas sobre esta transacción?
Puede contactarnos vía WhatsApp presionando aquí. O bien escríbanos al 8742-9595 agregando la palabra "alerta".
Este comprobante de su transacción hace referencia al artículo 18 y 19 del reglamento del sistema de tarjetas de pago establecidos por el BCCR.
Conozca más de nuestras promociones, productos y servicios ingresando a: https://www.baccredomatic.com/es-cr
Comunicado válido únicamente para Costa Rica.
Políticas de privacidad\t|\tTérminos y condiciones
TODOS LOS DERECHOS RESERVADOS. 2026 © BAC INTERNATIONAL BANK`,
};

// Compra con tarjeta rechazada/denegada.
export const BAC_TARJETA_NEGADA = {
  from: BAC_SENDER,
  subject: 'Notificación de Transacción',
  body: `Hola CLIENTE DE PRUEBA
A continuación le detallamos la transacción realizada:
Comercio:\tSUPERMERCADO DE PRUEBA
Ciudad y país:\tALAJUELA, Costa Rica
Fecha:\tOct 18, 2026, 19:15
AMEX:\t***********0000
Autorización:\t000000
Referencia:\t00000000
Tipo de Transacción:\tCOMPRA RECHAZADA
Monto:\tCRC 15,000.00
¿Tiene dudas sobre esta transacción?
Puede contactarnos vía WhatsApp presionando aquí. O bien escríbanos al 8742-9595 agregando la palabra "alerta".
Este comprobante de su transacción hace referencia al artículo 18 y 19 del reglamento del sistema de tarjetas de pago establecidos por el BCCR.
Conozca más de nuestras promociones, productos y servicios ingresando a: https://www.baccredomatic.com/es-cr
Comunicado válido únicamente para Costa Rica.
Políticas de privacidad\t|\tTérminos y condiciones
TODOS LOS DERECHOS RESERVADOS. 2026 © BAC INTERNATIONAL BANK`,
};

// Transferencia SINPE recibida / acreditada (ingreso).
export const BAC_SINPE_RECIBIDO = {
  from: BAC_SENDER,
  subject: 'Notificación de Transferencia SINPE',
  body: `Notificación de Transferencia SINPE
Hola CLIENTE DE PRUEBA :
BAC le comunica que la transferencia SINPE en tiempo real con el número de referencia 0000000000000000000000001, se acreditó en la cuenta IBAN CR13010000000000000000 por un monto de 10,000.00 Colones, por concepto de prueba SINPE.Día y hora 15/01/2026 02:31:22 p.m. 
Muchas gracias.
Notas Importantes:
La información mostrada en este comprobante no constituye un documento con validez legal.
No necesita responder este mensaje, ya que es informativo y se genera de forma automática.
En caso de que reciba un reporte de una transacción que usted no efectuó, favor llamar inmediatamente al teléfono 2295-9797.
2025 © BAC International Bank. Todos los derechos reservados.`,
};

// Transferencia SINPE enviada / debitada (gasto).
export const BAC_SINPE_ENVIADO = {
  from: BAC_SENDER,
  subject: 'Notificación de Transferencia SINPE',
  body: `Notificación de Transferencia SINPE
Hola CLIENTE DE PRUEBA :
BAC le comunica que la transferencia SINPE en tiempo real con el número de referencia 0000000000000000000000002, se debitó de la cuenta IBAN CR13010000000000000000 por un monto de 5,000.00 Colones, por concepto de pago almuerzo.Día y hora 16/01/2026 12:45:10 p.m. 
Muchas gracias.
Notas Importantes:
La información mostrada en este comprobante no constituye un documento con validez legal.
No necesita responder este mensaje, ya que es informativo y se genera de forma automática.
En caso de que reciba un reporte de una transacción que usted no efectuó, favor llamar inmediatamente al teléfono 2295-9797.
2025 © BAC International Bank. Todos los derechos reservados.`,
};
