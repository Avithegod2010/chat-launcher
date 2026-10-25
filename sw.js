/**
 * Chat Launcher service worker — app-shell precache.
 * The whole app is local and tiny, so everything is cached on install and the
 * app works fully offline. Bump CACHE_VERSION whenever any asset changes.
 */
const CACHE_VERSION = 'chatlauncher-v1.2.0';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/theme-boot.js',
  './js/main.js',
  './js/apps.js',
  './js/brand-icons.js',
  './js/countries.js',
  './js/phone.js',
  './js/history.js',
  './js/ui.js',
  './js/i18n.js',
  './js/stats.js',
  './js/qr.js',
  './js/vendor/qrcode-generator.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for everything; navigations fall back to the cached shell.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok && url.pathname.endsWith('/')) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match('./index.html')),
    ),
  );
});
