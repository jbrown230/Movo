// Generador de correos bancarios SINTÉTICOS. Los formatos imitan la estructura
// típica de una notificación, pero son inventados: no contienen datos reales.
// Se usa en el modo demo, en los tests y en el benchmark del parser.

import { pad, uid } from './format.js';

export const DEMO_SENDERS = {
  BAC: { name: 'BAC Credomatic', addr: 'notificaciones@bac.demo' },
  BN:  { name: 'Banco Nacional', addr: 'bnnotifica@bn.demo' },
  BCR: { name: 'BCR Mensajero', addr: 'mensajero@bancobcr.demo' },
  BCR_TARJETAS: { name: 'BCR Tarjetas', addr: 'bcrtarjestcta@bancobcr.demo' },
};

const fUS = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fCR = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Los bancos escriben en hora de Costa Rica (UTC−6), sin importar la zona del teléfono.
const cr = (d) => new Date(d.getTime() - 6 * 3600e3);
const dmy = (d) => { const c = cr(d); return `${pad(c.getUTCDate())}/${pad(c.getUTCMonth() + 1)}/${c.getUTCFullYear()}`; };
const ymd = (d) => { const c = cr(d); return `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`; };
const hm = (d) => { const c = cr(d); return `${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`; };
const ref = () => String(Math.floor(1e15 + Math.random() * 9e15));
const mask = (p) => `${String(p).slice(0, 1)}***-**${String(p).slice(-2)}`;

/**
 * @param {{bank:'BAC'|'BN'|'BCR', type:'sinpe'|'tarjeta', dir?:'out'|'in', who:string,
 *          amount:number, cur?:'CRC'|'USD', date?:string, phone?:string, desc?:string, last4?:string, status?:string}} o
 */
export function buildEmail(o) {
  const d = new Date(o.date || Date.now());
  const cur = o.cur || 'CRC', usd = cur === 'USD';
  const phone = o.phone || '8' + Math.floor(1e6 + Math.random() * 8999999);
  const last4 = o.last4 || '4821';
  const inbound = o.dir === 'in';
  let subject, body;

  if (o.bank === 'BAC') {
    if (o.type === 'sinpe') {
      subject = inbound ? 'Notificación de SINPE Móvil recibido' : 'Notificación de transferencia SINPE Móvil';
      body = `Estimado(a) cliente:\n\n${inbound ? 'Le informamos que recibió una transferencia SINPE Móvil en su cuenta.' : 'Le informamos que se realizó una transferencia SINPE Móvil desde su cuenta.'}\n\nMonto: CRC ${fUS(o.amount)}\n${inbound ? 'Remitente' : 'Destinatario'}: ${o.who}\nTeléfono: ${mask(phone)}\nDescripción: ${o.desc || 'SINPE MOVIL'}\nFecha: ${dmy(d)} ${hm(d)}\nReferencia: ${ref()}\n\nEste es un mensaje automático, por favor no responda.`;
    } else {
      subject = 'Notificación de transacción';
      body = `Notificación de transacción\n\nComercio: ${o.who}\nCiudad y país: SAN JOSE, Costa Rica\nFecha: ${dmy(d)} ${hm(d)}\nTarjeta: VISA ****${last4}\nAutorización: ${Math.floor(100000 + Math.random() * 899999)}\nTipo de transacción: COMPRA\nMonto: ${usd ? 'USD' : 'CRC'} ${fUS(o.amount)}`;
    }
  } else if (o.bank === 'BN') {
    if (o.type === 'sinpe') {
      subject = inbound ? 'BN SINPE Móvil recibido' : 'BN SINPE Móvil enviado';
      body = inbound
        ? `BN Notificaciones\n\nHa recibido un SINPE Móvil por ₡${fCR(o.amount)} de ${o.who} (${mask(phone)}) el ${dmy(d)} a las ${hm(d)}.\nDetalle: ${o.desc || 'SINPE MOVIL'}\nComprobante: ${ref()}`
        : `BN Notificaciones\n\nSe realizó un SINPE Móvil por ₡${fCR(o.amount)} a ${o.who} (${mask(phone)}) el ${dmy(d)} a las ${hm(d)}.\nDetalle: ${o.desc || 'SINPE MOVIL'}\nComprobante: ${ref()}`;
    } else {
      subject = 'BN Compra aprobada';
      body = `BN Notificaciones\n\nCompra aprobada por ${usd ? '$' : '₡'}${fCR(o.amount)} en ${o.who} el ${dmy(d)} a las ${hm(d)} con su tarjeta terminada en ${last4}.`;
    }
  } else {
    // BCR: misma estructura que las notificaciones REALES (datos ficticios).
    const c = cr(d), H = c.getUTCHours();
    const h12 = `${H % 12 || 12}:${pad(c.getUTCMinutes())} ${H < 12 ? 'AM' : 'PM'}`;
    if (o.type === 'sinpe') {
      subject = 'SINPEMOVIL - Notificación de transacción realizada';
      body = `Transacción SINPE MÓVIL\nEstimado (a): CLIENTE DE PRUEBA\nLe informamos que se le ha ${inbound ? 'acreditado en' : 'debitado de'} su cuenta BCR la siguiente transacción SINPE Móvil:\nNúmero de referencia: ${ref()}${ref().slice(0, 9)}\n${inbound ? 'Teléfono origen: 0' : 'Teléfono Destino: ' + phone}\nNombre cliente ${inbound ? 'origen' : 'Destino'}: ${o.who}\nEntidad ${inbound ? 'origen: Banco Nacional de Costa Rica' : 'Destino: Banco de Costa Rica'}\nMonto: ${fUS(o.amount)}\nMotivo: ${o.desc || 'SINPE MOVIL'}\nEsta transacción fue realizada el ${dmy(d)} a las ${h12}\nImportante:\nPor favor, no escriba a esta dirección de correo.`;
    } else {
      subject = 'Notificación de Transacciones BCR';
      body = `Transacciones en su tarjeta BCR: ****-****-****-${last4}\nEstimado (a) cliente:\nLe informamos la siguiente transacción realizada con su tarjeta BCR :\nInformación Adicional\nDetalle de Transacciones\nFecha\tAutorización\tNo.Referencia\tMonto\tMoneda\tComercio\tEstado\n${dmy(d)} ${hm(d)}:${pad(cr(d).getUTCSeconds())}\t${o.status === 'Negada' ? '00000000' : String(Math.floor(1e7 + Math.random() * 9e7))}\t${ref().slice(0, 12)}\t${fUS(o.amount)}\t${usd ? 'US DOLLAR' : 'COLONES'}\t${o.who}\t${o.status || 'Aprobada'}\nEn caso de dudas respecto a las transacciones notificadas, escribir al WhatsApp.`;
    }
  }
  const s = DEMO_SENDERS[o.bank === 'BCR' && o.type !== 'sinpe' ? 'BCR_TARJETAS' : o.bank];
  return {
    id: `demo-${uid()}`,
    messageId: `<${uid().slice(0, 12)}@${o.bank.toLowerCase()}.demo>`,
    from: `${s.name} <${s.addr}>`, fromName: s.name, subject, body, date: d.toISOString(),
  };
}

export const MERCHANTS = ['SUPER LA AMISTAD', 'PIZZA ROMA ESCAZU', 'UBER *TRIP', 'FARMACIA SAN MARTIN', 'STEAM GAMES', 'KOLBI PREPAGO', 'CAFE CORDILLERA', 'SERVICENTRO LA SABANA', 'NETFLIX.COM', 'SODA DONA ROSA'];
export const PEOPLE = ['MARIA FERNANDEZ R', 'CARLOS JIMENEZ M', 'ANA ROJAS V', 'JOSE ARAYA S'];

/** Datos de ejemplo del modo demo, relativos a "ahora" y dentro del mes actual. */
export function demoSeedEmails(now = new Date()) {
  const som = new Date(now.getFullYear(), now.getMonth(), 1, 7, 0);
  const rows = [
    ['BAC', 'tarjeta', 'out', 'CAFE CORDILLERA', 2900, 'CRC', 6, 8, 10],
    ['BN', 'sinpe', 'in', 'ANA ROJAS V', 20000, 'CRC', 5, 10, 0],
    ['BAC', 'sinpe', 'out', 'SODA DONA ROSA', 3500, 'CRC', 5, 12, 15],
    ['BN', 'tarjeta', 'out', 'FARMACIA SAN MARTIN', 8650, 'CRC', 4, 17, 10],
    ['BAC', 'tarjeta', 'out', 'SERVICENTRO LA SABANA', 25000, 'CRC', 4, 7, 30],
    ['BAC', 'tarjeta', 'out', 'NETFLIX.COM', 7.99, 'USD', 3, 8, 2],
    ['BCR', 'tarjeta', 'out', 'UBER *TRIP', 4380, 'CRC', 2, 18, 5],
    ['BCR', 'sinpe', 'out', 'JOSE ARAYA S', 6000, 'CRC', 2, 19, 37],
    ['BCR', 'sinpe', 'in', 'CLIENTE DE PRUEBA', 10000, 'CRC', 1, 14, 12],
    ['BN', 'sinpe', 'out', 'MARIA FERNANDEZ R', 15000, 'CRC', 1, 12, 40],
    ['BAC', 'tarjeta', 'out', 'SUPER LA AMISTAD', 23450, 'CRC', 0, 9, 15],
    ['BCR', 'tarjeta', 'out', 'STEAM GAMES', 20, 'USD', 3, 9, 33, 'Negada'],
  ];
  const out = rows.map((r, i) => {
    let d = new Date(now); d.setDate(d.getDate() - r[6]); d.setHours(r[7], r[8], 0, 0);
    if (d < som) d = new Date(som.getTime() + i * 3600e3);
    if (d > now) d = new Date(now.getTime() - (rows.length - i) * 60e3);
    return buildEmail({ bank: r[0], type: r[1], dir: r[2], who: r[3], amount: r[4], cur: r[5], date: d.toISOString(), status: r[9] });
  });
  out.push({
    id: `demo-${uid()}`, messageId: `<estado-${uid().slice(0, 8)}@bac.demo>`,
    from: 'BAC Credomatic <notificaciones@bac.demo>', fromName: 'BAC Credomatic',
    subject: 'Su estado de cuenta está disponible',
    body: 'Estimado(a) cliente:\n\nYa puede consultar su estado de cuenta del mes en la Banca en Línea.\n\nEste es un mensaje automático, por favor no responda.',
    date: new Date(now.getTime() - 2 * 86400e3).toISOString(),
  });
  return out;
}
