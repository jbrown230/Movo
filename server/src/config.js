// Configuración por variables de entorno (ver .env.example en la raíz).
// Opción de línea de comandos: --static <carpeta> sirve la app compilada desde el propio servidor.
const argumentValue = (name) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : '';
};
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|si|sí)$/i.test(v));

export const config = {
  port: Number(process.env.PORT || 3000),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  mongoUrl: process.env.MONGO_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  cloudSync: bool(process.env.CLOUD_SYNC, !!process.env.MONGO_URL),
  bccrEmail: process.env.BCCR_EMAIL || '',
  bccrToken: process.env.BCCR_TOKEN || '',
  fxFallback: Number(process.env.FX_FALLBACK || 510),
  serveStatic: process.env.SERVE_STATIC || argumentValue('--static'),
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 60),
};
