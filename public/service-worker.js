const CACHE_NAME = 'newszoid-v1';
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/','/index.html','/style.css','/script.js']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // simple cache-first for assets
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Newszoid', body: 'New update' };
  const options = { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: data.url || '/' };
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

const OFFLINE_EDITION_CACHE = 'newszoid-offline-edition-v1';

self.addEventListener('message', async (event) => {
  if (event.data === 'download-today') {
    const urlsToCache = [
      '/', '/index.html', '/style.css', '/script.js',
      '/navigation-style.css', '/navigation-script.js'
    ];

    const cache = await caches.open(OFFLINE_EDITION_CACHE);

    await cache.addAll(urlsToCache);

    event.ports[0].postMessage({ status: 'success' });
  }
});


