// Genera un conjunto de correos bancarios SINTÉTICOS en JSON (sin datos reales).
// Uso: npm run dataset -- 50 > correos.json
import { buildBankMail } from '../web/src/demo/mailBuilder.js';
import { MERCHANTS, PEOPLE } from '../web/src/demo/sampleData.js';

const COUNT = Number(process.argv[2] || 30);
const BANKS = ['BAC', 'BN', 'BCR'];
const TYPES = ['sinpe', 'tarjeta'];
const MAX_DAYS_AGO = 20;
const MS_PER_DAY = 86400e3;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const mails = Array.from({ length: COUNT }, () => {
  const type = pick(TYPES);
  return buildBankMail({
    bank: pick(BANKS),
    type,
    counterparty: type === 'sinpe' ? pick(PEOPLE) : pick(MERCHANTS),
    amount: Math.round(Math.random() * 5_000_000) / 100 + 100,
    date: new Date(Date.now() - Math.random() * MAX_DAYS_AGO * MS_PER_DAY).toISOString(),
  });
});

console.log(JSON.stringify(mails, null, 2));
