const CACHE_NAME = 'hchps-cache-v3';

// Cache basic application assets
const urlsToCache = [
  './',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 즉시 새 버전 활성화
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      }).catch(err => console.error('SW Cache Error:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // 기존 구버전 캐시 삭제
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy with Dynamic Caching
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // chrome-extension 등 기타 프로토콜 무시
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
