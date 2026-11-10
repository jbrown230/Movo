// La lista de archivos que el service worker guarda al instalarse (para usar la app sin conexión).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { injectPrecache, PRECACHE_PLACEHOLDER, precacheList } from '../../scripts/precache.mjs';

test('guarda la página y cada archivo de la compilación, incluida la pieza de ExcelJS', () => {
  const paths = precacheList([
    'index.html',
    'assets/index-a1.js',
    'assets/exceljs.min-b2.js',
    'assets/index-c3.css',
    'assets/sql-wasm-d4.wasm',
  ]);
  assert.deepEqual(paths, [
    '/',
    '/assets/exceljs.min-b2.js',
    '/assets/index-a1.js',
    '/assets/index-c3.css',
    '/assets/sql-wasm-d4.wasm',
  ]);
});

test('no guarda los mapas de código', () => {
  assert.deepEqual(precacheList(['assets/index-a1.js', 'assets/index-a1.js.map']), ['/', '/assets/index-a1.js']);
});

test('escribe la lista en sw.js, en la línea reservada', () => {
  const source = `const VERSION = 'x';\n${PRECACHE_PLACEHOLDER} // comentario\n`;
  const result = injectPrecache(source, ['/', '/assets/index-a1.js']);
  assert.match(result, /const PRECACHE = \["\/","\/assets\/index-a1\.js"\]; \/\/ comentario/);
});

test('falla si sw.js no tiene la línea reservada, en vez de compilar un service worker sin la lista', () => {
  assert.throws(() => injectPrecache('const VERSION = "x";', ['/']), /no tiene la línea/);
});

test('el sw.js de la app tiene la línea reservada una sola vez', () => {
  const source = readFileSync(new URL('../../web/public/sw.js', import.meta.url), 'utf8');
  assert.equal(source.split(PRECACHE_PLACEHOLDER).length - 1, 1);
});
