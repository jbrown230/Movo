// Genera un conjunto de correos bancarios SINTÉTICOS en JSON (sin datos reales).
// Uso: npm run dataset -- 50 > correos.json
//      npm run dataset -- 50 7 > correos.json     (con semilla fija: siempre los mismos correos)
//
// Cada comercio tiene un monto típico y una dispersión propios, como en la vida real: el súper
// cuesta más que un café y Netflix cobra siempre lo mismo. Así el dataset sirve también para el
// prototipo de cargos anómalos (scripts/anomalies.mjs), que le inyecta cargos raros con etiqueta.
import { pathToFileURL } from 'node:url';
import { buildBankMail } from '../web/src/demo/mailBuilder.js';
import { PEOPLE } from '../web/src/demo/sampleData.js';

const BANKS = ['BAC', 'BN', 'BCR'];
const MS_PER_DAY = 86400e3;

/**
 * Perfil de gasto de cada contraparte: monto típico en colones (la mediana), dispersión en escala
 * log (0 = siempre lo mismo; 0,5 ≈ la mitad de las compras entre 0,6× y 1,6× lo típico) y peso
 * (qué tan seguido se compra ahí).
 */
export const SPENDING_PROFILES = {
  'SUPER LA AMISTAD': { type: 'tarjeta', typical: 28_000, spread: 0.45, weight: 8 },
  'PIZZA ROMA ESCAZU': { type: 'tarjeta', typical: 12_500, spread: 0.3, weight: 3 },
  'UBER *TRIP': { type: 'tarjeta', typical: 3_200, spread: 0.4, weight: 8 },
  'FARMACIA SAN MARTIN': { type: 'tarjeta', typical: 7_500, spread: 0.6, weight: 2 },
  'STEAM GAMES': { type: 'tarjeta', typical: 9_000, spread: 0.5, weight: 1 },
  'KOLBI PREPAGO': { type: 'tarjeta', typical: 5_000, spread: 0.15, weight: 2 },
  'CAFE CORDILLERA': { type: 'tarjeta', typical: 2_800, spread: 0.25, weight: 7 },
  'SERVICENTRO LA SABANA': { type: 'tarjeta', typical: 25_000, spread: 0.25, weight: 4 },
  'NETFLIX.COM': { type: 'tarjeta', typical: 7_200, spread: 0, weight: 1 },
  'SODA DONA ROSA': { type: 'tarjeta', typical: 4_200, spread: 0.2, weight: 6 },
  ...Object.fromEntries(PEOPLE.map((name) => [name, { type: 'sinpe', typical: 9_000, spread: 0.8, weight: 2 }])),
};

/** Generador con semilla (el mismo que el benchmark): misma semilla, mismos correos. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** Normal estándar con Box-Muller. */
const gaussian = (random) => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

/** Cargos raros que se pueden inyectar, con el rango del multiplicador sobre el monto normal. */
export const ANOMALY_KINDS = {
  grosero: { min: 4, max: 10 }, // un cobro duplicado varias veces, un monto con ceros de más
  moderado: { min: 2, max: 3 }, // el doble o el triple de lo usual
};

/**
 * Arma el dataset: una lista de correos con su etiqueta.
 *
 * @param {Object} options
 * @param {number} options.count               Cantidad de correos.
 * @param {number} [options.seed]              Semilla; sin ella, cada corrida es distinta.
 * @param {number} [options.days]              Días hacia atrás que cubren los correos.
 * @param {number} [options.anomalyRate]       Fracción de gastos a los que se les infla el monto (0 = ninguno).
 * @param {Date}   [options.now]
 * @returns {Array<{mail: Object, type: string, counterparty: string, amount: number, anomaly: null|{kind: string, factor: number}}>}
 *          En orden cronológico.
 */
export function buildDataset({ count, seed = Date.now(), days = 20, anomalyRate = 0, now = new Date() }) {
  const random = seededRandom(seed);
  const entries = Object.entries(SPENDING_PROFILES);
  const totalWeight = entries.reduce((sum, [, profile]) => sum + profile.weight, 0);
  const pickProfile = () => {
    let ticket = random() * totalWeight;
    return entries.find(([, profile]) => (ticket -= profile.weight) < 0) ?? entries.at(-1);
  };
  const kinds = Object.entries(ANOMALY_KINDS);

  const dates = Array.from({ length: count }, () => now.getTime() - random() * days * MS_PER_DAY).sort(
    (first, second) => first - second,
  );
  return dates.map((time) => {
    const [counterparty, profile] = pickProfile();
    let amount = profile.typical * Math.exp(profile.spread * gaussian(random));

    let anomaly = null;
    if (random() < anomalyRate) {
      const [kind, range] = kinds[Math.floor(random() * kinds.length)];
      const factor = range.min + random() * (range.max - range.min);
      amount *= factor;
      anomaly = { kind, factor };
    }
    amount = Math.max(100, Math.round(amount * 100) / 100);

    const mail = buildBankMail({
      bank: BANKS[Math.floor(random() * BANKS.length)],
      type: profile.type,
      counterparty,
      amount,
      date: new Date(time).toISOString(),
    });
    return { mail, type: profile.type, counterparty, amount, anomaly };
  });
}

const isCommandLine = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) {
  const count = Number(process.argv[2] || 30);
  const seed = process.argv[3] === undefined ? undefined : Number(process.argv[3]);
  const mails = buildDataset({ count, seed }).map((entry) => entry.mail);
  console.log(JSON.stringify(mails, null, 2));
}
