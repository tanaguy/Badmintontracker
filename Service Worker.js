// Service Worker for Badminton Tracker PWA
// ⚠️ Bump this version every time you deploy new files
const CACHE_NAME = 'badminton-tracker-v3';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

// Install — cache all files, activate immediately
self.addEventListener('install', event => {
  self.skipWaiting(); // take over right away, don't wait for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate — delete ALL old caches so stale files are gone
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// Fetch — NETWORK FIRST strategy
// Always try the network first so updates are picked up instantly.
// Only fall back to cache if offline.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Got fresh response — update the cache too
        if (networkResponse && networkResponse.status === 200) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request);
      })
  );
});
