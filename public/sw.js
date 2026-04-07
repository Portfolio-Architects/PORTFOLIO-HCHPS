const CACHE_NAME = 'hchps-cache-v4';

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

// Stale-While-Revalidate & Network-First Hybrid Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // chrome-extension 등 기타 프로토콜 및 실시간 통신 스트림 우회
  if (!event.request.url.startsWith('http') || event.request.url.includes('/partykit') || event.request.url.includes('/ws')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 네트워크 백그라운드 페치 (항상 최신화 시도)
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((error) => {
        console.warn('[SW] Network fetch failed, relying on cache', error);
        return null;
      });

      // 2. 캐시가 있으면 즉각 렌더링 (Stale), 없으면 Network 응답 대기
      return cachedResponse || fetchPromise.then(res => {
        if (!res) throw new Error('Network and cache unavailable');
        return res;
      });
    }).catch(() => {
      return caches.match('./'); // Fallback to root index.html
    })
  );
});
