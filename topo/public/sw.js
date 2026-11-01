/* Axiona Topo · service worker
   En el lote casi nunca hay buena señal. La primera visita guarda todo en el
   telefono y desde ahi la app abre sin conexion.
     - Paginas: red primero, con la copia guardada de respaldo.
     - Codigo, iconos y fuentes: cache primero (los .js llevan hash). */
const VERSION = 'topo-v1';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copia)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  const propio = url.origin === self.location.origin;
  const fuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!propio && !fuente) return;
  e.respondWith(caches.match(req).then(guardada => guardada || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return r;
  })));
});
