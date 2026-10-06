// Validación estricta de lo que llega del teléfono. Solo se aceptan campos
// conocidos y tipos esperados; nada de operadores de MongoDB ni claves extra.
export const KINDS = ['tx', 'rule', 'setting'];
const ID = /^[A-Za-z0-9_\- .*:@]{1,120}$/;
const str = (v, max = 200) => (v === null || v === undefined ? null : String(v).slice(0, max));
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const oneOf = (v, opts, d) => (opts.includes(v) ? v : d);

const SHAPES = {
  tx: (d) => ({
    date: str(d.date, 40), amountCents: int(d.amountCents), cur: oneOf(d.cur, ['CRC', 'USD'], 'CRC'),
    crcCents: int(d.crcCents), fx: num(d.fx), who: str(d.who, 120) || '', cat: str(d.cat, 30) || 'otros',
    catOrigin: str(d.catOrigin, 40), type: oneOf(d.type, ['sinpe', 'tarjeta', 'transferencia', 'efectivo'], 'transferencia'),
    dir: oneOf(d.dir, ['in', 'out', 'self'], 'out'), bank: str(d.bank, 20), messageId: str(d.messageId, 300), note: str(d.note, 300),
  }),
  rule: (d) => ({ match: str(d.match, 120) || '', cat: str(d.cat, 30) || 'otros' }),
  setting: (d) => {
    const v = d.v;
    if (typeof v === 'number' || typeof v === 'boolean') return { v };
    return { v: str(v, 2000) };
  },
};

/** @returns {{ok:true, changes:Array}|{ok:false, error:string}} */
export function validateChanges(body, max = 500) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido.' };
  const out = [];
  for (const kind of KINDS) {
    const list = body.changes?.[kind] ?? [];
    if (!Array.isArray(list)) return { ok: false, error: `"${kind}" debe ser una lista.` };
    for (const r of list) {
      if (!r || typeof r !== 'object' || !ID.test(String(r.id))) return { ok: false, error: 'Id inválido.' };
      const updatedAt = Number(r.updatedAt);
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) return { ok: false, error: 'updatedAt inválido.' };
      if (kind === 'setting' && !['budget', 'gmail_query'].includes(r.id)) continue;
      out.push({ kind, id: String(r.id), updatedAt, deleted: !!r.deleted, data: SHAPES[kind](r.data || {}) });
    }
  }
  if (out.length > max) return { ok: false, error: `Máximo ${max} cambios por solicitud.` };
  return { ok: true, changes: out };
}
