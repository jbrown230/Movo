// Lista de archivos que el service worker (web/public/sw.js) guarda al instalarse.
//
// Sin esto, el service worker guarda cada archivo la primera vez que se pide. Las piezas que se cargan
// solo cuando hacen falta, como ExcelJS al exportar, no estaban guardadas hasta usarlas con Internet:
// sin conexión, la primera exportación fallaba. Al compilar, este plugin de Vite escribe en sw.js la
// lista de todos los archivos de la app; así el service worker los guarda todos al instalarse.
//
// Como la lista cambia con cada compilación (los nombres llevan un código), sw.js también cambia, y el
// navegador instala el service worker nuevo con los archivos de esa versión.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** La línea de sw.js que la compilación reemplaza por la lista. */
export const PRECACHE_PLACEHOLDER = 'const PRECACHE = [];';

/**
 * Las rutas que se guardan: la página ('/') y cada archivo de la compilación, sin los mapas de código.
 * @param {string[]} fileNames  Nombres de archivo de la compilación, relativos a la carpeta de salida.
 */
export function precacheList(fileNames) {
  const files = fileNames
    .filter((name) => !name.endsWith('.map') && name !== 'index.html')
    .map((name) => '/' + name.replaceAll('\\', '/'))
    .sort();
  return ['/', ...files];
}

/** El código de sw.js con la lista puesta en su lugar. */
export function injectPrecache(serviceWorkerSource, paths) {
  if (!serviceWorkerSource.includes(PRECACHE_PLACEHOLDER)) {
    throw new Error(`sw.js no tiene la línea "${PRECACHE_PLACEHOLDER}" donde va la lista de archivos.`);
  }
  return serviceWorkerSource.replace(PRECACHE_PLACEHOLDER, `const PRECACHE = ${JSON.stringify(paths)};`);
}

/** Plugin de Vite: al terminar la compilación, escribe la lista en la copia de sw.js de la carpeta de salida. */
export function precachePlugin() {
  let outDir = '';
  let paths = [];
  return {
    name: 'movo-precache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      paths = precacheList(Object.keys(bundle));
    },
    closeBundle() {
      const serviceWorkerPath = join(outDir, 'sw.js');
      writeFileSync(serviceWorkerPath, injectPrecache(readFileSync(serviceWorkerPath, 'utf8'), paths));
    },
  };
}
