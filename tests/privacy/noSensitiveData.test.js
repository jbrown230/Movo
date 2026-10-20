// Guardia de privacidad: falla si en el repositorio aparece algo que parezca un dato real.
//
// Revisa correos de ejemplo, documentación y código buscando: correos personales,
// teléfonos, números de tarjeta, referencias de transacciones, secretos y nombres de
// personas. Todo dato de prueba debe ser ficticio y estar en las listas de permitidos
// de este archivo. Si esta prueba falla con un dato que SÍ es ficticio, agrégalo a la
// lista correspondiente; si es real, anonimízalo (ver docs/CONTRIBUIR.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'privacy']);
const BINARY_OR_GENERATED = /\.(png|jpg|jpeg|gif|ico|wasm|webp|woff2?|lock)$|package-lock\.json$/i;

function listFiles(path) {
  const stats = statSync(path);
  if (stats.isFile()) return BINARY_OR_GENERATED.test(path) ? [] : [path];
  return readdirSync(path)
    .filter((name) => !SKIPPED_DIRS.has(name))
    .flatMap((name) => listFiles(join(path, name)));
}

const filesIn = (...paths) => paths.flatMap((path) => listFiles(join(ROOT, path)));
const readText = (file) => readFileSync(file, 'utf8');
const label = (file) => relative(ROOT, file).split(sep).join('/');

/** Busca `pattern` en cada archivo y devuelve "archivo: coincidencia" por cada hallazgo no permitido. */
function findings(files, pattern, isAllowed = () => false) {
  const found = [];
  for (const file of files) {
    for (const match of readText(file).matchAll(pattern)) {
      if (!isAllowed(match[0], match, label(file))) found.push(`${label(file)}: ${match[0]}`);
    }
  }
  return found;
}

// Dónde buscar cada cosa.
const EVERYTHING = filesIn(
  'tests',
  'docs',
  'web/src',
  'web/index.html',
  'scripts',
  'server/src',
  'server/test',
  'README.md',
  'CHANGELOG.md',
  '.env.example',
  'docker-compose.yml',
  'Caddyfile',
);
const SAMPLE_DATA = filesIn('tests/fixtures', 'docs', 'web/src/demo', 'README.md', 'CHANGELOG.md', '.env.example');
const FIXTURES = filesIn('tests/fixtures');

// ---- Valores ficticios o públicos que SÍ se permiten ----
const ALLOWED_EMAIL_DOMAINS = [
  'bancobcr.com', // direcciones públicas del banco (remitente de las notificaciones)
  'bncr.fi.cr', // remitente público de los vouchers del Banco Nacional
  'baccredomatic.cr', // remitente de notificaciones de BAC Credomatic
  'baccredomatic.com',
  'davivienda.cr', // remitentes y correo de atención públicos de Davivienda
  'bancobcr.demo',
  'bac.demo',
  'bn.demo', // remitentes del modo demo
  'users.noreply.github.com',
];
const ALLOWED_EMAIL_SUFFIXES = ['.example', '.invalid', '.test', 'tudominio.com'];
const PUBLIC_BANK_NUMBERS = [
  '22111135', // WhatsApp público del BCR
  '50622111135',
  '22078600', // centro de tarjetas del Banco Nacional
  '22122000', // centro de llamadas del Banco Nacional
  '87429595', // WhatsApp público del BAC
  '50687429595',
  '22959797', // teléfono público del BAC
  '22871111', // "Teléfono Rojo" público de Davivienda
  '50622871111',
];
const FAKE_NAMES = new Set([
  'CLIENTE DE PRUEBA',
  'APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2',
  'PERSONA DESTINO PRUEBA',
  'PERSONA ORIGEN PRUEBA',
  'CLIENTE',
]);

test('no hay correos personales: solo direcciones públicas del banco o de ejemplo', () => {
  const emailPattern = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
  const unexpected = findings(EVERYTHING, emailPattern, (_, match) => {
    const domain = match[1].toLowerCase();
    return ALLOWED_EMAIL_DOMAINS.includes(domain) || ALLOWED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
  });
  assert.deepEqual(unexpected, [], 'correos que parecen reales');
});

test('no hay teléfonos reales: solo los ficticios que empiezan con 8000', () => {
  const phonePattern = /(?<!\d)[25678]\d{3}[- ]?\d{4}(?!\d)/g;
  const unexpected = findings(SAMPLE_DATA, phonePattern, (text) => {
    const digits = text.replace(/\D/g, '');
    return digits.startsWith('8000') || /^0+$/.test(digits) || PUBLIC_BANK_NUMBERS.includes(digits);
  });
  assert.deepEqual(unexpected, [], 'teléfonos que parecen reales');
});

test('no hay números de tarjeta ni referencias de transacciones reales', () => {
  // Números largos: solo ceros, o ceros con un último dígito (referencias ficticias como 000...0001).
  const longNumbers = findings(SAMPLE_DATA, /(?<!\d)\d{9,}(?!\d)/g, (text, _match, file) => {
    const isFakeReference = /^0+\d?$/.test(text);
    // La documentación de la API muestra marcas de tiempo de ejemplo (milisegundos desde 1970).
    const isExampleTimestamp = file === 'docs/API.md' && /^1[5-9]\d{11}(\d{3})?$/.test(text);
    return isFakeReference || isExampleTimestamp || PUBLIC_BANK_NUMBERS.includes(text);
  });
  assert.deepEqual(longNumbers, [], 'números largos que parecen referencias o cuentas reales');

  // Tarjetas enmascaradas: los últimos 4 dígitos deben ser 0000.
  const maskedCards = findings(
    SAMPLE_DATA,
    /(?:\*{4}|X{4})-?(?:\*{4}|X{4})-?(?:\*{4}|X{4})-?(\d{4})/g,
    (_, match) => match[1] === '0000',
  );
  assert.deepEqual(maskedCards, [], 'tarjetas con últimos dígitos que parecen reales');

  // Tarjetas completas con separadores (1234 5678 9012 3456).
  const fullCards = findings(SAMPLE_DATA, /(?<!\d)(?:\d{4}[- ]){3}\d{4}(?!\d)/g, (text) => /^[0 -]+$/.test(text));
  assert.deepEqual(fullCards, [], 'números de tarjeta completos');
});

test('no hay secretos: llaves, tokens ni contraseñas en direcciones', () => {
  const secretPatterns = [
    /AIza[0-9A-Za-z_-]{35}/g, // llave de API de Google
    /ya29\.[0-9A-Za-z_-]{20,}/g, // token de acceso de Google
    /GOCSPX-[0-9A-Za-z_-]{10,}/g, // secreto de cliente OAuth
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, // llave privada
    /\d{6,}-[a-z0-9]{10,}\.apps\.googleusercontent\.com/g, // ID de cliente real de Google
    /mongodb(?:\+srv)?:\/\/[^@\s/]+:[^@\s/]+@/g, // contraseña dentro de una URI de Mongo
    /redis:\/\/[^@\s/]*:[^@\s/]+@/g, // contraseña dentro de una URI de Redis
  ];
  for (const pattern of secretPatterns) assert.deepEqual(findings(EVERYTHING, pattern), [], String(pattern));
});

test('.env.example no trae valores secretos', () => {
  const lines = readText(join(ROOT, '.env.example'))
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line));
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (/TOKEN|SECRET|PASSWORD|CLIENT_ID/.test(key)) assert.equal(value.trim(), '', `${key} debe ir vacío`);
  }
});

test('los correos de ejemplo solo usan nombres de personas ficticios', () => {
  const stripTags = (text) => text.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ');
  const nameLine = /(?:Estimado\s*\(a\)|Nombre cliente (?:origen|destino))\s*:\s*([^\n\r]*)/gi;
  // Davivienda: "Estimado(a) Cliente NOMBRE" (sin dos puntos) o "Estimado cliente" con el nombre en la línea
  // siguiente. Solo cuenta una línea en mayúsculas, para no tomar la frase que sigue al saludo del BCR.
  const clientLine = /Estimado\s*(?:\(a\))?\s*[Cc]liente\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+?)[ \t]*(?:\r?\n|$)/g;
  const unexpected = [];
  for (const file of FIXTURES) {
    const text = stripTags(readText(file)).replace(/\s*\r?\n\s*\(a\)/g, ' (a)'); // "Estimado\n(a):" partido por el banco
    for (const match of [...text.matchAll(nameLine), ...text.matchAll(clientLine)]) {
      const name = match[1]
        .replace(/\s+/g, ' ')
        .replace(/[<].*$/, '')
        .trim();
      if (name && !FAKE_NAMES.has(name.toUpperCase())) unexpected.push(`${label(file)}: ${name}`);
    }
  }
  assert.deepEqual(unexpected, [], 'nombres que no están en la lista de nombres ficticios');
});

test('los comercios de los correos de ejemplo no son de compras reales de nadie', () => {
  // Estos textos salieron de un correo real y ya se reemplazaron; no deben volver.
  const blockedTerms = ['14152360599', 'ANTHROPIC  CLAUDE', 'ANTHROPIC++CLAUDE'];
  for (const term of blockedTerms)
    assert.deepEqual(findings(FIXTURES, new RegExp(term.replace(/[+*]/g, '\\$&'), 'g')), []);
});

test('hay archivos que revisar (la prueba no está vacía)', () => {
  assert.ok(EVERYTHING.length > 20);
  assert.ok(FIXTURES.length >= 5);
});
