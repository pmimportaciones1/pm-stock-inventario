// Service worker de PM Stock — permite que la app abra y se pueda seguir
// usando aunque el celular no tenga conexión a internet.
//
// Estrategia: "network first, cache fallback". Cuando hay conexión, siempre
// pide todo a internet (para no quedarse con una versión vieja de la app) y
// de paso va guardando una copia de cada cosa que carga. Cuando NO hay
// conexión, sirve esa última copia guardada en vez de fallar.
//
// Subí este archivo (sw.js) a la RAÍZ del repositorio, al lado de index.html.

const CACHE_NAME = 'pmstock-shell-v1';
const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {}) // si falla el precache inicial, no rompe la instalación
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo nos interesa cachear pedidos GET (páginas, scripts, fuentes).
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Con conexión: usamos la respuesta fresca y de paso actualizamos
        // la copia guardada, para que la próxima vez offline esté al día.
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          try { cache.put(req, resClone); } catch (e) {}
        });
        return res;
      })
      .catch(() => {
        // Sin conexión: buscamos la última copia guardada. Si piden una
        // página (navegación) y no hay copia exacta, servimos index.html
        // igual, para que la app abra en vez de mostrar el error del navegador.
        return caches.match(req).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Sin conexión y sin copia guardada' });
        });
      })
  );
});
