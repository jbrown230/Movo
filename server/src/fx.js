// Tipo de cambio del dólar (venta) del Banco Central de Costa Rica.
// Se consulta como máximo cada 6 horas y se guarda en Redis; si el BCCR no está
// configurado o falla, se usa el último valor conocido o FX_FALLBACK.
const TTL = 6 * 3600;
const two = (n) => String(n).padStart(2, '0');
const crDate = (d) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;

export async function fetchBccr({ email, token }) {
  const today = new Date(), from = new Date(Date.now() - 7 * 86400e3);
  const u = new URL('https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML');
  u.search = new URLSearchParams({ Indicador: '318', FechaInicio: crDate(from), FechaFinal: crDate(today), Nombre: 'PuraPlata', SubNiveles: 'N', CorreoElectronico: email, Token: token });
  const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('BCCR ' + r.status);
  const xml = (await r.text()).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const vals = [...xml.matchAll(/<DES_FECHA>([^<]+)<\/DES_FECHA>\s*<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/g)];
  if (!vals.length) throw new Error('BCCR sin datos');
  const last = vals.at(-1);
  return { rate: Math.round(Number(last[2]) * 100) / 100, date: last[1].slice(0, 10), source: 'BCCR, tipo de cambio de venta' };
}

export function makeFx({ cache, cfg, fetcher = fetchBccr }) {
  return async function fxHandler(req, res) {
    const cached = await cache.get('fx:usd');
    if (cached) return res.json(JSON.parse(cached));
    let out = null;
    if (cfg.bccrEmail && cfg.bccrToken) {
      try { out = await fetcher({ email: cfg.bccrEmail, token: cfg.bccrToken }); } catch (e) { req.log?.warn?.(e.message); }
    }
    if (!out) {
      const last = await cache.get('fx:usd:last');
      out = last ? JSON.parse(last) : { rate: cfg.fxFallback, date: null, source: 'valor de referencia del servidor' };
      await cache.set('fx:usd', JSON.stringify(out), 1800);
      return res.json(out);
    }
    await cache.set('fx:usd', JSON.stringify(out), TTL);
    await cache.set('fx:usd:last', JSON.stringify(out), 30 * 86400);
    res.json(out);
  };
}
