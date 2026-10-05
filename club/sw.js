// Fit Pulse : service worker minimal. Pages et scripts toujours pris sur le
// réseau d'abord (une mise à jour passe au chargement suivant), icônes et
// polices en cache. Au clic sur une alerte : ouvre la bonne page.
const VERSION = 'fp-v2';
const STATIC = /\.(png|woff2?|ttf|svg|webp)$/;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (STATIC.test(u.pathname)) {
    e.respondWith(caches.open(VERSION).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (u.pathname.endsWith('/') || /\.(html|js|css|webmanifest)$/.test(u.pathname))) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./'))));
});
// Notification envoyée par le serveur Fit Pulse (téléphone fermé compris).
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Fit Pulse', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Fit Pulse', { body: d.body || '', tag: d.tag || 'fitpulse', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || '#/home' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) { w.postMessage({ type: 'notif-click', url }); return w.focus(); }
    return self.clients.openWindow(self.registration.scope + url.replace(/^\.?\//, ''));
  }));
});
