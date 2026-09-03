// Cache-Busting & Clean Purge Service Worker
// Eradicates all stale asset caching (hchps-cache-*) to ensure 0 hydration mismatch

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Push Notification Support (Pass-through, zero fetch caching)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon, badge, data, requireInteraction, silent } = event.data.payload;
    
    self.registration.showNotification(title, {
      body: body || '',
      tag: tag || 'hchps-alert',
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-192x192.png',
      data: data || {},
      requireInteraction: requireInteraction || false,
      silent: silent || false,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '확인' },
        { action: 'dismiss', title: '닫기' },
      ],
    }).catch(() => {});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

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

// Zero fetch interception: All network requests pass directly to server
