// Construcción de la app Express separada del arranque, para poder probarla.
import express from 'express';
import { makeAuth } from './auth.js';
import { makeFx } from './fx.js';
import { validateChanges } from './validate.js';

export function buildApp({ cfg, cache, store, verify }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const requireUser = makeAuth({ clientId: cfg.googleClientId, cache, verify, rateLimitPerMin: cfg.rateLimitPerMin });

  app.get('/api/health', async (req, res) => {
    res.json({ ok: true, redis: cache.ready(), mongo: store ? await store.ping() : null });
  });

  app.get('/api/config', (req, res) => {
    res.json({ googleClientId: cfg.googleClientId || null, cloudSync: !!(cfg.cloudSync && store) });
  });

  // Límite simple por IP para el endpoint público.
  app.get('/api/fx', async (req, res, next) => {
    const n = await cache.hit(`rl:ip:${req.ip}:${Math.floor(Date.now() / 60000)}`, 70);
    if (n > 30) return res.status(429).json({ error: 'Demasiadas solicitudes.' });
    next();
  }, makeFx({ cache, cfg }));

  const needStore = (req, res, next) => (store && cfg.cloudSync ? next() : res.status(404).json({ error: 'El respaldo no está habilitado en este servidor.' }));

  app.post('/api/sync', needStore, requireUser, async (req, res, next) => {
    try {
      const v = validateChanges(req.body);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const since = Math.max(0, Number(req.body.since) || 0);
      await store.push(req.userId, v.changes);
      const rows = await store.pull(req.userId, since, 1000);
      const changes = { tx: [], rule: [], setting: [] };
      for (const r of rows) changes[r.kind]?.push({ id: r.id, updatedAt: r.updatedAt, deleted: r.deleted, data: r.data });
      res.json({ cursor: rows.length ? rows.at(-1).srvAt : since, more: rows.length === 1000, changes });
    } catch (e) { next(e); }
  });

  app.delete('/api/me', needStore, requireUser, async (req, res, next) => {
    try { res.json({ deleted: await store.wipe(req.userId) }); } catch (e) { next(e); }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado.' }));

  if (cfg.serveStatic) app.use(express.static(cfg.serveStatic, { index: 'index.html' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 && !err.status ? 'Error interno.' : err.message });
  });
  return app;
}
