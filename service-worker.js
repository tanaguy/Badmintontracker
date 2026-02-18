// Badminton Tracker - Service Worker
// Version: 20260218_01
// Strategy: Cache-bust on every deploy, network-always for app files

const CACHE_VERSION = '20260218_01';
const CACHE_NAME = 'badminton-20260217_01';

// Only cache these for offline fallback - NOT the main app files
const OFFLINE_FALLBACK = './index.html';

// On install: claim immediately, wipe ALL old caches
self.addEventListener('install', event => {
  console.log('[SW] Installing version', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    // Delete every old cache unconditionally
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_FALLBACK)))
  );
});

// On activate: take control of all tabs immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activating version', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: ALWAYS go to network, never serve stale cache for app files
// Only use cache if completely offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })  // tell browser: bypass HTTP cache too
      .then(response => {
        return response;
      })
      .catch(() => {
        // Truly offline — serve cached fallback
        return caches.match(event.request)
          .then(cached => cached || caches.match(OFFLINE_FALLBACK));
      })
  );
});
