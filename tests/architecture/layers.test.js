// Hace cumplir la arquitectura: si alguien importa algo que su capa no puede usar, esta prueba falla.
// Las reglas están explicadas en docs/ARQUITECTURA.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_FILE = /\.(js|jsx|mjs)$/;

// ---------------------------------------------------------------- lectura de importaciones

function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return SOURCE_FILE.test(name) ? [path] : [];
  });
}

/** Quita los comentarios, para que una referencia de tipos en un comentario no cuente como importación. */
const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g, // import x from '...' / export { x } from '...'
  /\bimport\s*['"]([^'"]+)['"]/g, // import '...'
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, // import('...')
];

function readImports(file) {
  const code = withoutComments(readFileSync(file, 'utf8'));
  return IMPORT_PATTERNS.flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[1]));
}

const isRelative = (specifier) => specifier.startsWith('.');

// ---------------------------------------------------------------- comprobación de reglas

/**
 * @param {Object} area
 * @param {string} area.name
 * @param {string} area.directory  Carpeta con el código.
 * @param {(relativePath: string) => string|null} area.layerOf  A qué capa pertenece un archivo (ruta dentro de `directory`).
 * @param {Record<string, {mayImport: string[], packages: string[]}>} area.rules
 */
function findViolations(area) {
  const violations = [];

  for (const file of listSourceFiles(area.directory)) {
    const relativePath = relative(area.directory, file).split(sep).join('/');
    const layer = area.layerOf(relativePath);
    const label = `${area.name}/${relativePath}`;

    if (!layer || !area.rules[layer]) {
      violations.push(`${label}: no pertenece a ninguna capa conocida (agrégala en tests/architecture/layers.test.js)`);
      continue;
    }

    const rule = area.rules[layer];
    for (const specifier of readImports(file)) {
      if (isRelative(specifier)) {
        const target = resolve(dirname(file), specifier);
        const targetLayer = target.startsWith(resolve(ROOT, 'shared'))
          ? 'shared'
          : area.layerOf(relative(area.directory, target).split(sep).join('/'));
        if (targetLayer !== layer && !rule.mayImport.includes(targetLayer)) {
          violations.push(`${label}: la capa "${layer}" no puede importar de "${targetLayer}" (${specifier})`);
        }
      } else if (!rule.packages.some((allowed) => specifier === allowed || specifier.startsWith(allowed))) {
        violations.push(`${label}: la capa "${layer}" no puede usar el paquete "${specifier}"`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------- app del teléfono (web/src)

const firstFolder = (path) => (path.includes('/') ? path.split('/')[0] : null);

const CLIENT = {
  name: 'web/src',
  directory: join(ROOT, 'web/src'),
  layerOf: (path) => (path === 'main.jsx' ? 'entry' : firstFolder(path)),
  rules: {
    entry: { mayImport: ['presentation'], packages: ['react', './presentation/styles'] },
    // El corazón: reglas puras. No usa nada de afuera.
    domain: { mayImport: [], packages: [] },
    // Casos de uso: solo conocen el dominio y los "puertos" (formas descritas en application/ports.js).
    application: { mayImport: ['domain'], packages: [] },
    // Datos de ejemplo: solo conocen el dominio.
    demo: { mayImport: ['domain'], packages: [] },
    // Detalles técnicos (SQLite, Gmail, red, navegador). Puede usar el contrato compartido con el servidor.
    infrastructure: { mayImport: ['domain', 'shared'], packages: ['sql.js'] },
    // La interfaz React. No toca infrastructure: usa los casos de uso y composition/platform.js.
    presentation: { mayImport: ['domain', 'application', 'composition', 'demo'], packages: ['react'] },
    // Conecta todo. Es el único lugar que conoce a la vez la aplicación y la infraestructura.
    composition: { mayImport: ['domain', 'application', 'infrastructure', 'demo'], packages: [] },
  },
};

// ---------------------------------------------------------------- servidor (server/src)

function serverLayerOf(path) {
  if (path === 'index.js') return 'index';
  if (path === 'config.js') return 'config';
  const [folder, subfolder] = path.split('/');
  if (folder === 'adapters' && path.split('/').length > 2) return `adapters/${subfolder}`;
  return folder;
}

const SERVER = {
  name: 'server/src',
  directory: join(ROOT, 'server/src'),
  layerOf: serverLayerOf,
  rules: {
    domain: { mayImport: [], packages: [] },
    application: { mayImport: ['domain', 'shared'], packages: ['node:crypto'] },
    // Cada adaptador conoce lo que implementa y nada más: ninguno importa a otro adaptador.
    'adapters/http': { mayImport: ['domain', 'application', 'shared'], packages: ['express'] },
    'adapters/mongo': { mayImport: ['domain', 'application'], packages: ['mongodb'] },
    'adapters/memory': { mayImport: ['domain'], packages: [] },
    'adapters/cache': { mayImport: [], packages: ['redis'] },
    'adapters/bccr': { mayImport: [], packages: [] },
    'adapters/google': { mayImport: [], packages: [] },
    config: { mayImport: [], packages: [] },
    // Punto de arranque: conoce todas las capas.
    index: {
      mayImport: [
        'application',
        'adapters/http',
        'adapters/mongo',
        'adapters/cache',
        'adapters/bccr',
        'adapters/google',
        'config',
      ],
      packages: [],
    },
  },
};

test('la app del teléfono respeta las reglas de capas', () => {
  assert.deepEqual(findViolations(CLIENT), []);
});

test('el servidor respeta las reglas de capas', () => {
  assert.deepEqual(findViolations(SERVER), []);
});

test('el contrato compartido no depende de nada', () => {
  const sharedFiles = listSourceFiles(join(ROOT, 'shared'));
  assert.ok(sharedFiles.length > 0);
  for (const file of sharedFiles) assert.deepEqual(readImports(file), [], relative(ROOT, file));
});

test('la app y el servidor solo comparten el contrato: no se importan entre sí', () => {
  const crossImports = [];
  const checks = [
    { files: listSourceFiles(join(ROOT, 'web/src')), forbidden: `${sep}server${sep}` },
    { files: listSourceFiles(join(ROOT, 'server/src')), forbidden: `${sep}web${sep}` },
  ];
  for (const { files, forbidden } of checks) {
    for (const file of files) {
      for (const specifier of readImports(file).filter(isRelative)) {
        if (resolve(dirname(file), specifier).includes(forbidden))
          crossImports.push(`${relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(crossImports, []);
});

test('el detector de reglas funciona: una importación prohibida se encuentra', () => {
  // Autoprueba: se simula una capa con una regla más estricta que la real.
  const strictClient = {
    ...CLIENT,
    rules: { ...CLIENT.rules, presentation: { mayImport: ['domain'], packages: ['react'] } },
  };
  assert.ok(findViolations(strictClient).length > 0, 'presentation sí importa de application: debería marcarse');
});
