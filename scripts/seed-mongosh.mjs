// Lanza la carga de mongosh (scripts/mongo/cargar.mongosh.js) contra el MongoDB del .env.
// Uso: npm run seed:mongosh                          (200 movimientos, semilla 7, "persona-de-prueba")
//      npm run seed:mongosh -- 500 42 <usuario>
//
// La URI sale solo de MONGO_URL en el .env: nunca se escribe en el repositorio. Se usa el mongosh
// instalado; si no lo tienes, con Docker: MONGOSH="docker compose exec -T mongo mongosh" npm run seed:mongosh
// (MONGO_URL debe apuntar a como el contenedor ve la base, por ejemplo mongodb://localhost:27017/movo).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { backupRecordSchema } from '../server/src/adapters/mongo/backupRecordSchema.js';

const [count = 200, seed = 7] = process.argv.slice(2, 4).map(Number);
const userId = process.argv[4] || 'persona-de-prueba';
const [command, ...commandArgs] = (process.env.MONGOSH || 'mongosh').split(' ').filter(Boolean);

if (!process.env.MONGO_URL) throw new Error('Falta MONGO_URL en el .env (ver .env.example).');
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(seed)) {
  throw new Error('Uso: npm run seed:mongosh -- <cantidad> <semilla> [usuario]');
}

// mongosh recibe la configuración como una constante al inicio del script; el validador es el mismo de la API.
const config = { count, seed, userId, schema: backupRecordSchema };
const script = readFileSync(new URL('./mongo/cargar.mongosh.js', import.meta.url), 'utf8');
const code = `const CONFIG = ${JSON.stringify(config)};\n${script}`;

const result = spawnSync(command, [...commandArgs, process.env.MONGO_URL, '--quiet', '--eval', code], {
  stdio: 'inherit',
});
if (result.error) {
  throw new Error(
    `No se pudo ejecutar "${command}": ${result.error.message}. Instala mongosh o usa MONGOSH (ver arriba).`,
  );
}
process.exitCode = result.status ?? 1;
