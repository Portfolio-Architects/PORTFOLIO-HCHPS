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

// ============ Push Notification Support ============

// 클라이언트에서 postMessage로 알림 요청 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon, badge, data, requireInteraction, silent } = event.data.payload;
    
    self.registration.showNotification(title, {
      body: body || '',
      tag: tag || 'hchps-alert',
      icon: icon || './icon-192x192.png',
      badge: badge || './icon-192x192.png',
      data: data || {},
      requireInteraction: requireInteraction || false,
      silent: silent || false,
      vibrate: [200, 100, 200], // 진동 패턴 (모바일)
      actions: [
        { action: 'open', title: '확인' },
        { action: 'dismiss', title: '닫기' },
      ],
    }).catch(() => {
      // showNotification 실패 시 무시 (권한 미부여 등)
    });
  }
});

// 알림 클릭 시 앱으로 포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // 이미 열려있는 탭이 있으면 포커스, 없으면 새 탭
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./');
    })
  );
});

// Stale-While-Revalidate & Network-First Hybrid Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // chrome-extension 등 기타 프로토콜 및 실시간 통신 스트림, API 요청 우회 (PWA 강제 동기화 보장)
  if (
    !event.request.url.startsWith('http') || 
    event.request.url.includes('/partykit') || 
    event.request.url.includes('/ws') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('docs.google.com') ||
    event.request.url.includes('webpack') ||
    event.request.url.includes('_next/webpack-hmr')
  ) {
    return;
  }

  // HTML 진입점(navigate) 요청 시 항상 네트워크에서 최신 버전을 가져옴
  // -> 캐시된 구버전 index.html이 삭제된 구버전 JS 청크를 요청해 404가 발생하는 문제(ChunkLoadError) 방지
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./'); // 네트워크 오프라인 시 Fallback
      })
    );
    return;
  }

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
    })
  );
});
