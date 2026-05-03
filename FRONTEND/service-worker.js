const CACHE_NAME = 'newszoid-v2026-04-30';
const OFFLINE_EDITION_CACHE = 'newszoid-offline-edition-v2026-04-30';
const PRECACHE_URLS = ['/', '/index.html', '/style.css', '/script.js', '/logo-icon.png', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );

      // Take control immediately
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. API, runtime config, and data: always network-only.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname === '/config.js' ||
    url.hostname.includes('railway.app') ||
    url.hostname.includes('api.newszoid.com') ||
    url.hostname.includes('newsapi.org')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ ok: false, error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Static assets: network-first with cache fallback.
  // This ensures users get updates immediately if online, but works offline.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Update cache with fresh version
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, serve from cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Newszoid', body: 'New update' };
  const options = { body: data.body, icon: '/logo-icon.png', badge: '/logo-icon.png', data: data.url || '/' };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(cList => {
      for (const c of cList) if (c.url === event.notification.data) return c.focus();
      return clients.openWindow(event.notification.data);
    })
  );
});

self.addEventListener('message', async (event) => {
  if (event.data === 'download-today') {
    const cache = await caches.open(OFFLINE_EDITION_CACHE);

    await cache.addAll(PRECACHE_URLS);

    if (event.ports[0]) {
      event.ports[0].postMessage({ status: 'success' });
    }
  }
});


