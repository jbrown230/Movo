// Service worker: la app abre sin Internet (app shell en caché).
// Nunca se cachean respuestas de /api ni de Google.
const VERSION = 'pp-v1.3.0';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/css/app.css',
  '/js/app.js', '/js/db.js', '/js/repo.js', '/js/parser.js', '/js/format.js',
  '/js/gmail.js', '/js/html.js', '/js/sync.js', '/js/demo-emails.js',
  '/vendor/sql-wasm.js', '/vendor/sql-wasm.wasm',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // red directa
  if (url.origin === location.origin) {
    if (e.request.mode === 'navigate') {
      e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
      return;
    }
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
  }
});
