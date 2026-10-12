// Notificaciones del BCR con la estructura de las reales, pero con TODOS los datos
// reemplazados por valores ficticios: nombres, teléfonos, referencias, tarjeta, comercios y fechas.
// Antes de agregar un correo nuevo aquí, anonimízalo (ver docs/CONTRIBUIR.md).

export const BCR_SINPE_ENVIADO = {
  from: 'BCR Mensajero <mensajero@bancobcr.com>',
  subject: 'SINPEMOVIL - Notificación de transacción realizada',
  body: `Transacción SINPE MÓVIL
Estimado (a): CLIENTE DE PRUEBA
Le informamos que se le ha debitado de su cuenta BCR la siguiente transacción SINPE Móvil:
Número de referencia: 0000000000000000000000001
Teléfono Destino: 80000000
Nombre cliente Destino: PERSONA DESTINO PRUEBA
Entidad Destino: Banco de Costa Rica
Monto: .15
Motivo: prueba SINPE***
Esta transacción fue realizada el 15/01/2026 a las 10:30 AM
Importante:
Por favor, no escriba a esta dirección de correo. Contáctenos a: CentroAsistenciaBCR@bancobcr.com
En caso de dudas respecto a las transacciones notificadas, escribir al WhatsApp y utilice las opciones disponibles.`,
};

export const BCR_SINPE_RECIBIDO = {
  from: 'BCR Mensajero <mensajero@bancobcr.com>',
  subject: 'SINPEMOVIL - Notificación de transacción realizada',
  body: `Transacción SINPE MÓVIL
Estimado (a): CLIENTE DE PRUEBA
Le informamos que se le ha acreditado en su cuenta BCR la siguiente transacción SINPE Móvil:
Número de referencia: 0000000000000000000000002
Teléfono origen: 0
Nombre cliente origen: PERSONA ORIGEN PRUEBA
Entidad origen: Banco Nacional de Costa Rica
Monto: 5,000.00
Motivo: abono cuenta-0000000
Esta transacción fue realizada el 16/01/2026 a las 9:00 AM
Importante:`,
};

// Tal como queda el HTML de la tabla al convertirlo (celdas separadas por tabulador).
export const BCR_TARJETA_NEGADA = {
  from: 'BCR Tarjetas <bcrtarjestcta@bancobcr.com>',
  subject: 'Notificación de Transacciones BCR',
  body: `Transacciones en su tarjeta BCR: ****-****-****-0000
Estimado (a) cliente:
Le informamos la siguiente transacción realizada con su tarjeta BCR :
Información Adicional
Si aún no es usuario de la página web transaccional le invitamos a hacerlo a través de formulario digital ubicado en nuestro sitio web y el App BCR Móvil.
Detalle de Transacciones
Fecha\tAutorización\tNo.Referencia\tMonto\tMoneda\tComercio\tEstado
15/01/2026 09:05:00\t00000000\t000000000001\t20.00\tUS DOLLAR\tSERVICIO DIGITAL SUB 00000000000 US\tNegada
En caso de dudas respecto a las transacciones notificadas, escribir al WhatsApp y utilice las opciones disponibles.`,
};

// SINPE de la persona a sí misma desde otra entidad (titular = origen).
export const BCR_SINPE_PROPIO = {
  from: 'BCR Mensajero <mensajero@bancobcr.com>',
  subject: 'SINPEMOVIL - Notificación de transacción realizada',
  body: `Transacción SINPE MÓVIL
Estimado (a): APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
Le informamos que se le ha acreditado en su cuenta BCR la siguiente transacción SINPE Móvil:
Número de referencia: 0000000000000000000000003
Teléfono origen: 0
Nombre cliente origen: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
Entidad origen: COOPENAE
Monto: 10,000.00
Motivo: Transferencia SINP
Esta transacción fue realizada el 17/01/2026 a las 2:00 PM`,
};

// HTML equivalente de una tabla de tarjeta con varias filas (prueba de la conversión de tablas).
export const BCR_TARJETA_VARIAS_FILAS_HTML = `<html><body><table><tr><td><img src="logo.gif"></td></tr>
<tr><td><table width="100%"><tr><td align="right">Transacciones en su tarjeta BCR: ****-****-****-0000</td></tr>
<tr><td><b>Estimado (a) cliente:</b></td></tr>
<tr><td>Le informamos la siguiente transacción realizada con su tarjeta BCR :</td></tr>
<tr><td>Detalle de Transacciones</td></tr>
<tr><td><table>
<tr><th>Fecha</th><th>Autorización</th><th>No.Referencia</th><th>Monto</th><th>Moneda</th><th>Comercio</th><th>Estado</th></tr>
<tr><td>04/01/2026
 18:05:12</td><td>000001</td><td>000000000002</td><td>18,750.00</td><td>COLONES</td><td>AUTOMERCADO
 ESCAZU</td><td>Aprobada</td></tr>
<tr><td>04/01/2026 18:40:00</td><td>00000000</td><td>000000000003</td><td>9.99</td><td>US DOLLAR</td><td>STEAM GAMES</td><td>Negada</td></tr>
<tr><td>04/01/2026 19:02:30</td><td>000002</td><td>000000000004</td><td>3,200.00</td><td>COLONES</td><td>SODA LA CEIBA</td><td>Aprobada</td></tr>
</table></td></tr></table></td></tr></table></body></html>`;
