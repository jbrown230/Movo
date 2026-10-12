import { config } from './config.js';
import { createCache } from './cache.js';
import { mongoStore } from './store.js';
import { buildApp } from './app.js';

const log = { info: console.log, warn: console.warn };
const cache = createCache(config.redisUrl, log);
const store = config.cloudSync && config.mongoUrl ? mongoStore(config.mongoUrl, log) : null;
const app = buildApp({ cfg: config, cache, store });

const server = app.listen(config.port, () => {
  log.info(`Movo API en :${config.port} · Google ${config.googleClientId ? 'configurado' : 'SIN configurar'} · respaldo ${store ? 'activo' : 'desactivado'} · Redis ${config.redisUrl ? 'configurado' : 'no (memoria)'}`);
});
const stop = async () => { server.close(); await cache.close(); await store?.close(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
