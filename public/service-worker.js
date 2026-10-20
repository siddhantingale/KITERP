/* EduTrack service worker: installability + notifications.
   Deliberately does NOT cache app files, so every update is picked up immediately. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function show(data) {
  return self.registration.showNotification(data.title || 'EduTrack', {
    body: data.body || data.message || '',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo-192.png',
    tag: data.tag,
    data: data.data || { url: data.url || '/' },
    requireInteraction: !!data.requireInteraction,
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  event.waitUntil(show(data));
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SHOW_NOTIFICATION') event.waitUntil(show(msg.payload || msg));
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
