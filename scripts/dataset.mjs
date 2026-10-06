// Genera un conjunto de correos bancarios SINTÉTICOS en JSON (sin datos reales).
// Uso: npm run dataset -- 50 > correos.json
import { buildEmail, MERCHANTS, PEOPLE } from '../web/js/demo-emails.js';
const N = Number(process.argv[2] || 30);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const out = Array.from({ length: N }, () => {
  const type = pick(['sinpe', 'tarjeta']);
  return buildEmail({ bank: pick(['BAC', 'BN', 'BCR']), type, who: type === 'sinpe' ? pick(PEOPLE) : pick(MERCHANTS),
    amount: Math.round(Math.random() * 5000000) / 100 + 100, date: new Date(Date.now() - Math.random() * 20 * 86400e3).toISOString() });
});
console.log(JSON.stringify(out, null, 2));
