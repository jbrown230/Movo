// Lector de notificaciones bancarias. Módulo puro (sin DOM): se usa en la PWA,
// en los tests y en scripts/bench-parser.mjs para medir precisión.
//
// Estrategia: 1) detectar banco por remitente o texto, 2) probar la plantilla
// de ese banco, 3) probar las demás plantillas, 4) lector genérico por etiquetas.
// Un correo puede traer VARIAS transacciones (tabla de tarjeta del BCR) y una
// transacción puede venir "Negada": esas no se registran como gasto.
//
// Plantillas:
//   BCR  -> formatos REALES (SINPE Móvil débito/crédito y tabla de tarjeta).
//   BAC, BN -> formatos SINTÉTICOS de la demo, hasta tener correos reales.

import { normKey } from './format.js';

/** Súbelo cuando cambie el lector: la app vuelve a leer los correos no reconocidos. */
export const PARSER_VERSION = 4;

export const CATS = {
  super:      { n: 'Súper',          c: '#0E9E74' },
  comida:     { n: 'Comida',         c: '#E07A22' },
  transporte: { n: 'Transporte',     c: '#2F7CF6' },
  servicios:  { n: 'Servicios',      c: '#8B5CF6' },
  salud:      { n: 'Salud',          c: '#E0457B' },
  ocio:       { n: 'Ocio',           c: '#C9930E' },
  transfer:   { n: 'Transferencias', c: '#5A33E6' },
  ingreso:    { n: 'Ingresos',       c: '#0E9E74' },
  propias:    { n: 'Entre mis cuentas', c: '#6B7A90' },
  otros:      { n: 'Otros',          c: '#8A8799' },
};

const KEYWORDS = [
  ['super',      /\b(SUPER|MERCADO|PALI|MAXI ?PALI|WALMART|FRESH|PRICESMART|AUTOMERCADO|MAS X MENOS)/],
  ['transporte', /\b(UBER|DIDI|SERVICENTRO|GASOLINERA|PARQUEO|PEAJE|TAXI|BUS|RITEVE|DEKRA)/],
  ['comida',     /\b(SODA|PIZZA|CAFE|REST|BURGER|POLLO|PANADER|SUSHI|ALMUERZO|CENA|DESAYUNO|KFC|MCDONALD|STARBUCKS)/],
  ['salud',      /\b(FARMACIA|CLINICA|HOSPITAL|LABORATORIO|DENT|OPTICA|CCSS)/],
  ['ocio',       /\b(NETFLIX|SPOTIFY|CINE|STEAM|TEATRO|DISNEY|HBO|PLAYSTATION|XBOX|ANTHROPIC|OPENAI|YOUTUBE)/],
  ['servicios',  /\b(ICE|KOLBI|CNFL|AYA|TELECABLE|INTERNET|ELECTRIC|LIBERTY|CLARO|TIGO|MUNICIPALIDAD)\b/],
];

export const BANKS = {
  BCR:        { name: 'Banco de Costa Rica', color: '#00478F', from: /(bancobcr|bcr\.fi|bcr\.demo)/i,           text: /(cuenta|tarjeta) BCR\b|\bALERTA BCR\b/i },
  BAC:        { name: 'BAC Credomatic',     color: '#D3122B', from: /(baccr|credomatic|bac\.demo|bacnetwork)/i, text: /CREDOMATIC|\bBAC\b/i },
  BN:         { name: 'Banco Nacional',     color: '#0A6E3C', from: /(bncr|bn\.demo|bnmas)/i,                   text: /\bBN NOTIFICACIONES\b/i },
  DAVIVIENDA: { name: 'Davivienda',         color: '#E30613', from: /davivienda/i,                              text: /DAVIVIENDA/i },
  PROMERICA:  { name: 'Promerica',          color: '#00843D', from: /promerica/i,                               text: /PROMERICA/i },
};

/** "15,000.00", "15.000,00", "15000", "1.234", ".15" -> número */
export function parseAmount(s) {
  s = String(s).trim().replace(/\s/g, '');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (ld > -1 && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : NaN;
}

const NUM = '(\\d[\\d.,]*|\\.\\d+)';
const curOf = (s) => (/USD|US\$|\$|D[OÓ]LAR|DOLLAR/i.test(s || '') && !/CRC|₡|COLON/i.test(s || '') ? 'USD' : 'CRC');
// Los bancos escriben la hora de Costa Rica (UTC−6 todo el año, sin horario de verano).
const iso = (y, m, d, h = 0, mi = 0, s = 0) => new Date(Date.UTC(+y, +m - 1, +d, +h + 6, +mi, +s)).toISOString();
const to24 = (h, ampm) => {
  h = +h; if (!ampm) return h;
  const pm = /p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
};
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const DECLINED = /negad|rechazad|declinad|denegad|anulad|revers/i;

/**
 * ¿Dos nombres son la misma persona? Tolera orden distinto y nombres recortados
 * ("APELLIDO1 APELLIDO2 NOMBRE1 NO"), pero exige al menos 3 palabras en común para no
 * confundir familiares que comparten apellidos.
 */
export function samePerson(a, b) {
  const tok = (s) => normKey(s).replace(/[^A-Z ]/g, ' ').split(' ').filter((w) => w.length > 1);
  const A = tok(a), B = tok(b);
  if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  if (small.length < 3) return false;
  const used = new Set();
  let hits = 0;
  for (const w of small) {
    const i = big.findIndex((x, k) => !used.has(k) && (x === w || (w.length >= 2 && (x.startsWith(w) || w.startsWith(x)))));
    if (i > -1) { used.add(i); hits++; }
  }
  return hits >= Math.min(3, small.length) && hits === small.length;
}

export function detectBank(from = '', text = '') {
  for (const [k, b] of Object.entries(BANKS)) if (b.from.test(from)) return k;
  for (const [k, b] of Object.entries(BANKS)) if (b.text.test(text)) return k;
  return null;
}

// ---------------------------------------------------------------- BCR (real)
function bcrSinpe(t) {
  if (!/SINPE/i.test(t) || !/Monto:/i.test(t) || !/Nombre cliente (?:destino|origen)/i.test(t)) return null;
  const a = t.match(new RegExp('Monto:\\s*(?:CRC|₡)?\\s*' + NUM, 'i'));
  if (!a) return null;
  const dir = /se le ha acreditado|acreditado en su cuenta/i.test(t) ? 'in' : 'out';
  // Cada dato termina en el salto de línea o en la siguiente etiqueta (por si vienen en la misma línea).
  const NEXT = '(?=\\s+(?:N[uú]mero de referencia|Tel[eé]fono|Nombre cliente|Entidad|Monto|Motivo|Esta transacci[oó]n|Le informamos)\\b|\\n|$)';
  const field = (label) => t.match(new RegExp(label + ':\\s*(.+?)' + NEXT, 'i'))?.[1];
  const who = field('Nombre cliente (?:destino|origen)');
  const holder = field('Estimado \\(a\\)');
  const own = holder && who && samePerson(holder, who);
  const ent = field('Entidad (?:destino|origen)');
  const mot = field('Motivo');
  const f = t.match(/realizada el\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*a las\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?/);
  return [{
    type: 'sinpe', dir: own ? 'self' : dir, cur: 'CRC', amount: parseAmount(a[1]), who,
    date: f ? iso(f[3], f[2], f[1], to24(f[4], f[7]), f[5], f[6] || 0) : null,
    note: [own && 'Entre tus cuentas', mot && 'Motivo: ' + clean(mot).replace(/\*+$/, ''), ent && (dir === 'in' ? 'Desde ' : 'Hacia ') + clean(ent)].filter(Boolean).join(' · ') || null,
  }];
}

function bcrTarjeta(t) {
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const h = lines.findIndex((l) => /Fecha/i.test(l) && /Monto/i.test(l) && /Moneda/i.test(l));
  const items = [];
  const last4 = t.match(/\*{4}-?\*{4}-?\*{4}-?(\d{4})/)?.[1];
  const make = (fecha, monto, moneda, comercio, estado) => {
    const f = fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/);
    if (!f) return;
    items.push({
      type: 'tarjeta', dir: 'out', cur: curOf(moneda), amount: parseAmount(monto), who: comercio,
      date: iso(f[3], f[2], f[1], to24(f[4] || 12, f[7]), f[5] || 0, f[6] || 0),
      declined: DECLINED.test(estado || ''), status: clean(estado) || null,
      note: last4 ? `Tarjeta ****${last4}` : null,
    });
  };
  if (h > -1) {
    // Tabla con columnas separadas por tabulador (HTML convertido o texto copiado).
    const split = (l) => (l.includes('\t') ? l.split('\t') : l.split(/\s{2,}/)).map((c) => c.trim());
    const head = split(lines[h]).map((c) => c.toLowerCase());
    const col = (re) => head.findIndex((c) => re.test(c));
    const iF = col(/fecha/), iM = col(/monto/), iC = col(/moneda/), iCo = col(/comercio|establecimiento|descrip/), iE = col(/estado/);
    if (head.length >= 4 && iF > -1 && iM > -1) {
      for (const l of lines.slice(h + 1)) {
        const c = split(l);
        if (c.length < head.length - 1 || !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(c[iF] || '')) continue;
        make(c[iF], c[iM], c[iC] ?? '', iCo > -1 ? c[iCo] : '', iE > -1 ? c[iE] : '');
      }
    }
  }
  if (!items.length) {
    // Fila en una sola línea con espacios simples.
    const re = /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+\d+\s+\d+\s+(\d[\d.,]*|\.\d+)\s+(US DOLLAR|D[OÓ]LAR(?:ES)?|USD|COLON(?:ES)?(?: COSTARRICENSES?)?|CRC)\s+(.+?)\s+(Aprobad[ao]|Negad[ao]|Rechazad[ao]|Declinad[ao]|Anulad[ao]|Procesad[ao])\s*$/gim;
    for (const m of t.matchAll(re)) make(m[1], m[2], m[3], m[4], m[5]);
  }
  return items.length ? items : null;
}

// ---------------------------------------------------------- demo (sintéticos)
function bacDemo(t) {
  const a = t.match(/Monto:\s*(CRC|USD)\s*([\d.,]+)/i); if (!a) return null;
  const w = t.match(/(?:Comercio|Destinatario|Remitente):\s*(.+)/i);
  const f = t.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  return [{ cur: a[1].toUpperCase(), amount: parseAmount(a[2]), who: w?.[1], date: f ? iso(f[3], f[2], f[1], f[4], f[5]) : null }];
}
function bnDemo(t) {
  const a = t.match(/por\s*(₡|\$)\s*([\d.,]+)/); if (!a) return null;
  const w = t.match(/\s(?:a|en|de)\s+([A-ZÁÉÍÓÚÑÜ0-9 .&*'-]{3,}?)\s+(?:\(|el\s+\d)/);
  const f = t.match(/el\s+(\d{2})\/(\d{2})\/(\d{4})\s+a las\s+(\d{2}):(\d{2})/);
  return [{ cur: a[1] === '$' ? 'USD' : 'CRC', amount: parseAmount(a[2]), who: w?.[1], date: f ? iso(f[3], f[2], f[1], f[4], f[5]) : null }];
}

const TEMPLATES = [
  { bank: 'BCR', name: 'BCR SINPE', fn: bcrSinpe },
  { bank: 'BCR', name: 'BCR tarjeta', fn: bcrTarjeta },
  { bank: 'BAC', name: 'BAC (demo)', fn: bacDemo },
  { bank: 'BN', name: 'BN (demo)', fn: bnDemo },
];

// ------------------------------------------------- lector genérico por etiquetas
const CUR = '(CRC|USD|US\\$|₡|\\$|colones|d[oó]lares)';
function generic(t) {
  let cur = null, amount = NaN;
  const lab = t.match(new RegExp('(?:monto|importe|total|valor|cantidad)[^\\d\\n₡$.]{0,30}' + CUR + '?\\s*' + NUM + '\\s*' + CUR + '?', 'i'));
  if (lab) { amount = parseAmount(lab[2]); cur = curOf((lab[1] || '') + (lab[3] || '')); }
  if (!(amount > 0)) {
    const any = t.match(new RegExp(CUR + '\\s*' + NUM, 'i')) || t.match(new RegExp(NUM + '\\s*' + CUR, 'i'));
    if (any) {
      const numFirst = /\d/.test(any[1]);
      amount = parseAmount(numFirst ? any[1] : any[2]); cur = curOf(numFirst ? any[2] : any[1]);
    }
  }
  if (!(amount > 0)) return null;
  const w = t.match(/(?:comercio|establecimiento|destinatario|beneficiario|remitente|nombre del comercio|nombre cliente (?:destino|origen)|a nombre de|lugar)\s*:\s*(.+)/i)
         || t.match(/\s(?:a|en)\s+([A-ZÁÉÍÓÚÑÜ0-9 .&*'-]{3,}?)\s+(?:\(|el\s+\d)/);
  let date = null;
  const d1 = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d\n]{1,12}(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?)?/);
  const d2 = t.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (d1) date = iso(d1[3], d1[2], d1[1], d1[4] ? to24(d1[4], d1[7]) : 12, d1[5] || 0, d1[6] || 0);
  else if (d2) date = iso(d2[1], d2[2], d2[3], d2[4] || 12, d2[5] || 0);
  return [{ cur, amount, who: w?.[1], date, declined: DECLINED.test(t.match(/estado\s*:?\s*(\w+)/i)?.[1] || '') }];
}

/**
 * Lee todas las transacciones de un correo.
 * @returns {{ok:true, bank, template, items:Array<{type,dir,cur,amountCents,who,date,declined,status,note}>} | {ok:false, bank, reason}}
 */
export function parseEmailAll(mail) {
  const body = mail.body || '';
  const text = `${mail.subject || ''}\n${body}`;
  let bank = detectBank(mail.from, text);
  const order = [...TEMPLATES.filter((t) => t.bank === bank), ...TEMPLATES.filter((t) => t.bank !== bank)];
  let raw = null, template = null;
  for (const tp of order) {
    const r = tp.fn(body);
    if (r && r.some((i) => i.amount > 0)) { raw = r; template = tp.name; bank = bank && bank !== tp.bank && BANKS[bank].from.test(mail.from || '') ? bank : tp.bank; break; }
  }
  if (!raw) { raw = generic(text); template = 'genérica'; }
  raw = (raw || []).filter((i) => i.amount > 0);
  if (!raw.length) return { ok: false, bank, reason: 'No se encontró un monto en el correo.' };

  const isSinpe = /SINPE/i.test(text);
  const gDir = /(se le ha acreditado|recibi[oó] (?:una?|el) (?:transferencia|sinpe|dep[oó]sito|pago)|ha recibido (?:una?|el) |le transfirieron|acreditad[oa] a su|dep[oó]sito a su favor|SINPE M[OÓ]VIL RECIBIDO|abono a su cuenta)/i.test(text) ? 'in' : 'out';
  const gType = isSinpe ? 'sinpe' : /tarjeta|compra|comercio|autorizaci/i.test(text) ? 'tarjeta' : 'transferencia';
  const items = raw.map((i) => {
    const type = i.type || gType;
    return {
      type, dir: i.dir || gDir, cur: i.cur || 'CRC', amountCents: Math.round(i.amount * 100),
      who: clean(i.who).slice(0, 80) || (type === 'sinpe' ? 'SINPE MÓVIL' : 'SIN NOMBRE'),
      date: i.date || mail.date || new Date().toISOString(),
      declined: !!i.declined, status: i.status || null, note: i.note || null,
    };
  });
  return { ok: true, bank, template, items };
}

/** Primera transacción aprobada (atajo usado por pruebas y benchmark). */
export function parseEmail(mail) {
  const r = parseEmailAll(mail);
  if (!r.ok) return r;
  const it = r.items.find((i) => !i.declined);
  if (!it) return { ok: false, bank: r.bank, template: r.template, declined: true, reason: 'El banco negó la transacción.' };
  return { ok: true, bank: r.bank, template: r.template, ...it };
}

/** Reglas del usuario primero, luego palabras clave, luego por tipo. */
export function categorize(who, type, dir, userRules = []) {
  if (dir === 'self') return { cat: 'propias', origin: 'mismo titular' };
  if (dir === 'in') return { cat: 'ingreso', origin: 'regla automática' };
  const key = normKey(who);
  for (const r of userRules) if (r.match && key.includes(r.match)) return { cat: r.cat, origin: 'tu regla' };
  for (const [cat, re] of KEYWORDS) if (re.test(key)) return { cat, origin: 'regla automática' };
  return { cat: type === 'sinpe' ? 'transfer' : 'otros', origin: 'regla automática' };
}
