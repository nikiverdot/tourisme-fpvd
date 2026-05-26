const CACHE = 'fp-planning-v2';
const ASSETS = ['/', '/index.html', '/icon.svg', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let title = '📅 Planning du jour';
  let body  = 'Consultez le planning.';
  let url   = '/';
  try {
    const d = e.data.json();
    title = d.title || title;
    body  = d.body  || body;
    url   = d.url   || url;
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/icon.svg',
      badge:   '/icon.svg',
      data:    { url },
      vibrate: [200, 100, 200],
      tag:     'fpvd-daily'   // remplace la notif précédente si pas encore lue
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('tourisme-fpvd.fr') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
