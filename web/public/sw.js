// Service worker: hace que la app abra sin Internet.
//
// Estrategia:
//   - Al instalarse guarda todos los archivos de la app (PRECACHE), también los que se cargan solo
//     cuando hacen falta, como ExcelJS al exportar: así funcionan sin conexión desde la primera vez.
//   - Páginas (navegación): primero la red; si falla, la última copia guardada.
//   - Archivos de la app (JS, CSS, imágenes): salen de la copia; lo que no esté guardado se guarda
//     la primera vez que se pide. Sus nombres llevan un código que cambia con cada versión, así que
//     una versión nueva siempre baja archivos nuevos, y los de versiones anteriores se borran.
//   - Tipografías de Google: se guardan la primera vez.
//   - /api y Google (correo, inicio de sesión): nunca se guardan. Siempre van directo a la red.
//
// Sube VERSION cuando cambies esta lógica, para que los teléfonos descarguen la nueva.
const VERSION = 'movo-v0.1.0-logo4'; // cambia cuando hay que descartar lo guardado (por ejemplo, al cambiar los íconos)
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const PRECACHE = []; // la compilación escribe aquí los archivos de la app (scripts/precache.mjs); en desarrollo queda vacía

/** Guarda los archivos de la app. Uno por uno: si alguno falla, los demás quedan guardados igual. */
async function precacheAppFiles() {
  const cache = await caches.open(VERSION);
  await Promise.all(PRECACHE.map((path) => cache.add(path).catch(() => {})));
}

/** Borra los archivos de versiones anteriores (/assets/ con otro código), para que la copia no crezca sin fin. */
async function dropOldAppFiles() {
  if (!PRECACHE.length) return;
  const current = new Set(PRECACHE);
  const cache = await caches.open(VERSION);
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/assets/') && !current.has(pathname)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppFiles().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))))
      .then(dropOldAppFiles)
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    // "no-cache": pregunta siempre al servidor, sin fiarse de la caché HTTP del navegador.
    const response = await fetch(request, { cache: 'no-cache' });
    const isPage = response.ok && (response.headers.get('content-type') || '').includes('text/html');
    // La app es de una sola página: todas las rutas usan la misma. Solo se guarda si es la página
    // (y no, por ejemplo, una imagen que alguien abrió directamente).
    if (isPage) cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && url.pathname.startsWith('/api/')) return; // red directa
  if (isSameOrigin && request.mode === 'navigate') return event.respondWith(networkFirst(request));
  if (isSameOrigin || FONT_HOSTS.includes(url.hostname)) return event.respondWith(cacheFirst(request));
});
