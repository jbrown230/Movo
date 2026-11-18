// Notificaciones de Wink con la estructura de las reales, pero con TODOS los datos reemplazados por valores
// ficticios: nombres, teléfono, cuenta, tarjeta, comprobante, comercio, montos y fechas. Antes de agregar un
// correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).
//
// Wink escribe desde transacciones@holawink.com. Los cuerpos de abajo son el texto que sale de convertir el HTML del
// correo (así lo lee la app, porque trae tablas); las versiones HTML están en wink-html/, sin estilos, imágenes ni el
// píxel de seguimiento. WINK_TEXTO_PLANO son las mismas notificaciones tal como vienen en la parte de texto plano.
// El aviso del SINPE enviado solo trae el día en el cuerpo: la hora está en el asunto.

const SENDER = 'transacciones@holawink.com';

export const WINK_SINPE_ENVIADO = {
  from: SENDER,
  subject: 'Notificación de envío 15/01/2026 - 10:30',
  body: `Notificación de transferencia
¡Hola Winker!
Tu transferencia de SINPE móvil fue procesada correctamente. Estos son los detalles de la transacción:
Cuenta de origen: Cuenta de ahorros en colones
Número de destino: 80000000
Nombre del destinatario: PERSONA DESTINO PRUEBA
Monto transferido: 3,500.00 colones
Fecha de la transferencia: 15/01/2026
Importante: Este mensaje se genera de forma automática, por favor no respondás a este correo.
Atentamente,
El equipo de WINK
¿Te llegó este correo por error?
Podés reportarlo con servicio al cliente a soporte@holawink.com
Sos parte de la familia WINK. Si necesitás contactarnos haz click aquí y tendrás acceso a nuestros canales de atención.`,
};

export const WINK_TARJETA_COMPRA = {
  from: SENDER,
  subject: 'Notificación de transacción en COMERCIO DE PRUEBA 0000000000 CR 15/01/2026 - 02:21 PM',
  body: `Notificación de transacción
¡Hola Winker!
Se registró una transacción con tu tarjeta. Estos son los detalles de la transacción:
Tarjeta utilizada: Terminada en 0000
Monto de la compra: 2,500.00
Comercio: COMERCIO DE PRUEBA 0000000000 CR
Fecha y hora: 15/01/2026, 02:21 PM (hora de Costa Rica)
Importante: Este mensaje se genera de forma automática, por favor no respondás a este correo.
Atentamente,
El equipo de WINK
¿Te llegó este correo por error?
Podés reportarlo con servicio al cliente a soporte@holawink.com
Sos parte de la familia WINK. Si necesitás contactarnos haz click aquí y tendrás acceso a nuestros canales de atención.`,
};

export const WINK_PAGO_TARJETA_CREDITO = {
  from: SENDER,
  subject: 'Pago de tarjeta de crédito exitoso',
  body: `¡Pago de tarjeta de crédito exitoso!
Hola Winker, te informamos que se ha efectuado exitosamente el pago de la tarjeta de crédito:
Tarjeta de crédito: XXXX XXXX XXXX 0000
Titular: CLIENTE DE PRUEBA
Tipo de pago: Otro monto
Monto: ₡5,000.00
Atentamente,
El equipo de WINK
¿Te llegó este correo por error?
Podés reportarlo con servicio al cliente a soporte@holawink.com
Sos parte de la familia WINK. Si necesitás contactarnos haz click aquí y tendrás acceso a nuestros canales de atención.`,
};

export const WINK_SINPE_RECIBIDO = {
  from: SENDER,
  subject: 'Transferencia recibida 15/01/2026 - 06:22 PM',
  body: `Transferencia recibida
¡Hola Winker!
Recibiste una transferencia SINPE a tu cuenta de ahorros Wink. Estos son los detalles de la transacción:
Monto recibido: 15,000.00 colones
Cuenta de destino: Cuenta de ahorros en colones
Número de comprobante: 0000000000000000000000001
Fecha y hora de la transferencia: 15/01/2026, 06:22 PM (hora de Costa Rica)
Importante: Este mensaje se genera de forma automática, por favor no respondás a este correo.
Atentamente,
El equipo de WINK
¿Te llegó este correo por error?
Podés reportarlo con servicio al cliente a soporte@holawink.com
Sos parte de la familia WINK. Si necesitás contactarnos haz click aquí y tendrás acceso a nuestros canales de atención.`,
};

/** La parte de texto plano de cada correo: las etiquetas van entre asteriscos. */
export const WINK_TEXTO_PLANO = {
  sinpeEnviado: `Notificación de transferencia

¡Hola Winker!

Tu transferencia de SINPE móvil fue procesada correctamente. Estos son los detalles de la transacción:

*Cuenta de origen:* Cuenta de ahorros en colones
*Número de destino:* 80000000
*Nombre del destinatario:* PERSONA DESTINO PRUEBA
*Monto transferido:* 3,500.00 colones
*Fecha de la transferencia:* 15/01/2026

*Importante:* Este mensaje se genera de forma automática, por favor no respondás a este correo.

Atentamente,
*El equipo de WINK*

¿Te llegó este correo por error?

Podés reportarlo con servicio al cliente a soporte@holawink.com ( soporte@holawink.com )

Sos parte de la familia WINK. Si necesitás contactarnos haz *click aquí* ( https://soporte.holawink.com/es/articles/6738598-canales-de-atencion-wink ) y tendrás acceso a nuestros canales de atención.

( http://www.facebook.com/holawink ) ( http://www.instagram.com/holawink ) ( https://www.youtube.com/@holawink6606 ) ( soporte@holawink.com ) ( http://holawink.com )`,
  tarjetaCompra: `Notificación de transacción

¡Hola Winker!

Se registró una transacción con tu tarjeta. Estos son los detalles de la transacción:

*Tarjeta utilizada:* Terminada en 0000
*Monto de la compra:* 2,500.00
*Comercio:* COMERCIO DE PRUEBA 0000000000 CR
*Fecha y hora:* 15/01/2026, 02:21 PM (hora de Costa Rica)

*Importante:* Este mensaje se genera de forma automática, por favor no respondás a este correo.

Atentamente,
*El equipo de WINK*

¿Te llegó este correo por error?

Podés reportarlo con servicio al cliente a soporte@holawink.com ( soporte@holawink.com )

Sos parte de la familia WINK. Si necesitás contactarnos haz *click aquí* ( https://soporte.holawink.com/es/articles/6738598-canales-de-atencion-wink ) y tendrás acceso a nuestros canales de atención.

( http://www.facebook.com/holawink ) ( http://www.instagram.com/holawink ) ( https://www.youtube.com/@holawink6606 ) ( soporte@holawink.com ) ( http://holawink.com )`,
  pagoTarjetaCredito: `¡Pago de tarjeta de crédito exitoso!

Hola Winker, te informamos que se ha efectuado exitosamente el pago de la tarjeta de crédito:

Tarjeta de crédito: XXXX XXXX XXXX 0000
Titular: CLIENTE DE PRUEBA
 Tipo de pago: Otro monto
 Monto: ₡5,000.00

Atentamente,
*El equipo de WINK*

¿Te llegó este correo por error?

Podés reportarlo con servicio al cliente a soporte@holawink.com ( soporte@holawink.com )

Sos parte de la familia WINK. Si necesitás contactarnos haz *click aquí* ( https://soporte.holawink.com/es/articles/6738598-canales-de-atencion-wink ) y tendrás acceso a nuestros canales de atención.

( http://www.facebook.com/holawink ) ( http://www.instagram.com/holawink ) ( https://www.youtube.com/@holawink6606 ) ( soporte@holawink.com ) ( http://holawink.com )`,
  sinpeRecibido: `Transferencia recibida

¡Hola Winker!

Recibiste una transferencia SINPE a tu cuenta de ahorros Wink. Estos son los detalles de la transacción:

*Monto recibido:* 15,000.00 colones
*Cuenta de destino:* Cuenta de ahorros en colones
*Número de comprobante:* 0000000000000000000000001
*Fecha y hora de la transferencia:* 15/01/2026, 06:22 PM (hora de Costa Rica)

*Importante:* Este mensaje se genera de forma automática, por favor no respondás a este correo.

Atentamente,
*El equipo de WINK*

¿Te llegó este correo por error?

Podés reportarlo con servicio al cliente a soporte@holawink.com ( soporte@holawink.com )

Sos parte de la familia WINK. Si necesitás contactarnos haz *click aquí* ( https://soporte.holawink.com/es/articles/6738598-canales-de-atencion-wink ) y tendrás acceso a nuestros canales de atención.

( http://www.facebook.com/holawink ) ( http://www.instagram.com/holawink ) ( https://www.youtube.com/@holawink6606 ) ( soporte@holawink.com ) ( http://holawink.com )`,
};
