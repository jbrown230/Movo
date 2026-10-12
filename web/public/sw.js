// Service worker: hace que la app abra sin Internet.
//
// Estrategia:
//   - Páginas (navegación): primero la red; si falla, la última copia guardada.
//   - Archivos de la app (JS, CSS, imágenes): se guardan la primera vez que se piden y después
//     salen de la copia. Sus nombres llevan un código que cambia con cada versión, así que
//     una versión nueva siempre baja archivos nuevos.
//   - Tipografías de Google: se guardan la primera vez.
//   - /api y Google (correo, inicio de sesión): nunca se guardan. Siempre van directo a la red.
//
// Sube VERSION cuando cambies esta lógica, para que los teléfonos descarguen la nueva.
const VERSION = 'movo-v2.0.0';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    cache.put('/', response.clone()); // la app es de una sola página: todas las rutas usan la misma
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
