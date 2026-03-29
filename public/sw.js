const CACHE_NAME = 'hchps-cache-v1';

// Cache basic application assets
const urlsToCache = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Network-first strategy for a dynamic app like this
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback to cache if network fails
      return caches.match(event.request);
    })
  );
});
