// Correos de ejemplo que se cargan al entrar al modo demo.

import { buildBankMail } from './mailBuilder.js';
import { newId } from '../domain/ids.js';

const DEMO_ACCOUNT_CLIENT = 'CLIENTE DE PRUEBA';

/** `daysAgo`, `hour` y `minute` ubican cada correo dentro del mes actual. */
const SEED_ROWS = [
  {
    bank: 'BAC',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'CAFE CORDILLERA',
    amount: 2900,
    currency: 'CRC',
    daysAgo: 6,
    hour: 8,
    minute: 10,
  },
  {
    bank: 'BN',
    type: 'sinpe',
    direction: 'in',
    counterparty: 'ANA EJEMPLO V',
    amount: 20000,
    currency: 'CRC',
    daysAgo: 5,
    hour: 10,
    minute: 0,
  },
  {
    bank: 'BAC',
    type: 'sinpe',
    direction: 'out',
    counterparty: 'SODA DONA ROSA',
    amount: 3500,
    currency: 'CRC',
    daysAgo: 5,
    hour: 12,
    minute: 15,
  },
  {
    bank: 'BN',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'FARMACIA SAN MARTIN',
    amount: 8650,
    currency: 'CRC',
    daysAgo: 4,
    hour: 17,
    minute: 10,
  },
  {
    bank: 'BAC',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'SERVICENTRO LA SABANA',
    amount: 25000,
    currency: 'CRC',
    daysAgo: 4,
    hour: 7,
    minute: 30,
  },
  {
    bank: 'BAC',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'NETFLIX.COM',
    amount: 7.99,
    currency: 'USD',
    daysAgo: 3,
    hour: 8,
    minute: 2,
  },
  {
    bank: 'BCR',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'UBER *TRIP',
    amount: 4380,
    currency: 'CRC',
    daysAgo: 2,
    hour: 18,
    minute: 5,
  },
  {
    bank: 'BCR',
    type: 'sinpe',
    direction: 'out',
    counterparty: 'JOSE EJEMPLO S',
    amount: 6000,
    currency: 'CRC',
    daysAgo: 2,
    hour: 19,
    minute: 37,
  },
  {
    bank: 'BCR',
    type: 'sinpe',
    direction: 'in',
    counterparty: DEMO_ACCOUNT_CLIENT,
    amount: 10000,
    currency: 'CRC',
    daysAgo: 1,
    hour: 14,
    minute: 12,
  },
  {
    bank: 'BN',
    type: 'sinpe',
    direction: 'out',
    counterparty: 'MARIA EJEMPLO R',
    amount: 15000,
    currency: 'CRC',
    daysAgo: 1,
    hour: 12,
    minute: 40,
  },
  {
    bank: 'BAC',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'SUPER LA AMISTAD',
    amount: 23450,
    currency: 'CRC',
    daysAgo: 0,
    hour: 9,
    minute: 15,
  },
  {
    bank: 'BCR',
    type: 'tarjeta',
    direction: 'out',
    counterparty: 'STEAM GAMES',
    amount: 20,
    currency: 'USD',
    daysAgo: 3,
    hour: 9,
    minute: 33,
    status: 'Negada',
  },
];

/** Fecha de cada correo de ejemplo, siempre dentro del mes actual y antes de "ahora". */
function seedDate(row, index, now) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 7, 0);
  const date = new Date(now);
  date.setDate(date.getDate() - row.daysAgo);
  date.setHours(row.hour, row.minute, 0, 0);

  if (date < startOfMonth) return new Date(startOfMonth.getTime() + index * 3600e3);
  if (date > now) return new Date(now.getTime() - (SEED_ROWS.length - index) * 60e3);
  return date;
}

/** Datos de ejemplo del modo demo, relativos a "ahora". */
export function buildDemoSeedMails(now = new Date()) {
  const mails = SEED_ROWS.map((row, index) => buildBankMail({ ...row, date: seedDate(row, index, now).toISOString() }));

  // Un correo que no trae ningún movimiento, para mostrar el estado "Sin movimiento".
  mails.push({
    id: `demo-${newId()}`,
    messageId: `<estado-${newId().slice(0, 8)}@bac.demo>`,
    from: 'BAC Credomatic <notificaciones@bac.demo>',
    fromName: 'BAC Credomatic',
    subject: 'Su estado de cuenta está disponible',
    body: 'Estimado(a) cliente:\n\nYa puede consultar su estado de cuenta del mes en la Banca en Línea.\n\nEste es un mensaje automático, por favor no responda.',
    date: new Date(now.getTime() - 2 * 86400e3).toISOString(),
  });
  return mails;
}
