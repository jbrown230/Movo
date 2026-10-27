// Punto de arranque del servidor. Aquí se eligen las piezas reales (Redis, MongoDB, Google, BCCR)
// y se conectan con los casos de uso. Es el único archivo que conoce todas las capas.

import { createUseCases } from './application/createUseCases.js';
import { createBccrExchangeRateSource } from './adapters/bccr/BccrExchangeRateSource.js';
import { createInMemoryCache } from './adapters/cache/InMemoryCache.js';
import { createRedisCache } from './adapters/cache/RedisCache.js';
import { createResilientCache } from './adapters/cache/ResilientCache.js';
import { createGoogleTokenVerifier } from './adapters/google/GoogleTokenVerifier.js';
import { createExchangeRateApiNioRate } from './adapters/nio/ExchangeRateApiNioRate.js';
import { createHttpApp } from './adapters/http/createHttpApp.js';
import { createMongoBackupStore } from './adapters/mongo/MongoBackupStore.js';
import { config } from './config.js';

const log = { info: console.log, warn: console.warn };

const cache = createResilientCache({
  redis: config.redisUrl ? createRedisCache(config.redisUrl, log) : null,
  memory: createInMemoryCache(),
});
const backupStore = config.cloudSync && config.mongoUrl ? createMongoBackupStore(config.mongoUrl, log) : null;
const exchangeRateSource = config.bccrToken
  ? createBccrExchangeRateSource({
      token: config.bccrToken,
      fetchNioPerUsd: createExchangeRateApiNioRate(),
      nioPerUsd: config.nioPerUsd,
      log,
    })
  : null;

const useCases = createUseCases({
  settings: config,
  cache,
  backupStore,
  tokenVerifier: createGoogleTokenVerifier(),
  exchangeRateSource,
  log,
});
const app = createHttpApp({ useCases, staticDirectory: config.staticDirectory });

const server = app.listen(config.port, () => {
  const google = config.googleClientId ? 'configurado' : 'SIN configurar';
  const backup = backupStore ? 'activo' : 'desactivado';
  const redis = config.redisUrl ? 'configurado' : 'no (memoria)';
  log.info(`Movo API en :${config.port} · Google ${google} · respaldo ${backup} · Redis ${redis}`);
});

async function shutDown() {
  server.close();
  await cache.close();
  await backupStore?.close();
  process.exit(0);
}
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
