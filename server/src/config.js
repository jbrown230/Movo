// Configuración del servidor, leída de variables de entorno (ver .env.example en la raíz).

const DEFAULT_PORT = 3000;
const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DEFAULT_FALLBACK_EXCHANGE_RATE = 510;
const DEFAULT_NIO_PER_USD = 36.6243; // reserva: la tasa oficial del Banco Central de Nicaragua, fija durante todo 2026

const TRUE_WORDS = /^(1|true|yes|si|sí)$/i;
const readBoolean = (value, defaultValue) =>
  value === undefined || value === '' ? defaultValue : TRUE_WORDS.test(value);

/** Valor de una opción de la línea de comandos, por ejemplo `--static ../web/dist`. */
function readCommandLineOption(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : '';
}

export const config = {
  port: Number(process.env.PORT || DEFAULT_PORT),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  mongoUrl: process.env.MONGO_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  cloudSync: readBoolean(process.env.CLOUD_SYNC, false), // apagado salvo que se active con CLOUD_SYNC=true
  bccrToken: process.env.BCCR_TOKEN || '',
  nioPerUsd: Number(process.env.NIO_PER_USD || DEFAULT_NIO_PER_USD),
  fallbackExchangeRate: Number(process.env.FX_FALLBACK || DEFAULT_FALLBACK_EXCHANGE_RATE),
  requestsPerMinute: Number(process.env.RATE_LIMIT_PER_MIN || DEFAULT_REQUESTS_PER_MINUTE),
  /** Carpeta con la app compilada, para servirla desde la API (opcional). */
  staticDirectory: process.env.SERVE_STATIC || readCommandLineOption('--static'),
};
