// Identidad del usuario sin contraseñas ni sesiones propias: el teléfono envía
// su token de acceso de Google; el servidor lo valida UNA vez contra Google y
// guarda el resultado en Redis hasta que el token expira.
import { createHash } from 'node:crypto';

export async function googleTokenInfo(token) {
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token));
  if (!r.ok) return null;
  return r.json();
}

export function makeAuth({ clientId, cache, verify = googleTokenInfo, rateLimitPerMin = 60 }) {
  return async function requireUser(req, res, next) {
    const m = /^Bearer\s+(\S{20,4096})$/.exec(req.headers.authorization || '');
    if (!m) return res.status(401).json({ error: 'Falta el token de Google.' });
    const key = 'tok:' + createHash('sha256').update(m[1]).digest('hex');
    let sub = await cache.get(key);
    if (!sub) {
      let info = null;
      try { info = await verify(m[1]); } catch { return res.status(503).json({ error: 'No se pudo validar con Google.' }); }
      if (!info || !info.sub) return res.status(401).json({ error: 'Token inválido o vencido.' });
      if (clientId && info.aud !== clientId && info.azp !== clientId) return res.status(401).json({ error: 'El token es de otra aplicación.' });
      sub = String(info.sub);
      await cache.set(key, sub, Math.min(Number(info.expires_in) || 300, 3600));
    }
    const minute = Math.floor(Date.now() / 60000);
    if ((await cache.hit(`rl:${sub}:${minute}`, 70)) > rateLimitPerMin) return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta en un minuto.' });
    req.userId = sub; // Todo acceso a datos se filtra por este id.
    next();
  };
}
