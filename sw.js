/* EnSelle — service worker : fonctionnement hors ligne + rappels. */
importScripts('logic.js');

var CACHE = 'enselle-v5';
var ASSETS = ['./', 'index.html', 'app.js', 'logic.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/stencil-800.woff2', 'fonts/archivo-400.woff2', 'fonts/archivo-500.woff2', 'fonts/archivo-600.woff2',
  'fonts/archivo-700.woff2', 'fonts/plexmono-400.woff2', 'fonts/plexmono-500.woff2', 'fonts/plexmono-600.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Réponse immédiate depuis le cache, mise à jour en arrière-plan. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});

function checkAndNotify(force) {
  return Promise.all([MotoLogic.idbGet('state'), MotoLogic.idbGet('notified')]).then(function (v) {
    var data = v[0], notified = v[1] || {};
    if (!data || !data.bikes) return;
    MotoLogic.updateBadge(self.navigator, data);
    if (data.settings && data.settings.notif === false) return;
    if (force) notified = {};
    var list = MotoLogic.pendingReminders(data, notified);
    return MotoLogic.idbSet('notified', notified).then(function () {
      return Promise.all(list.map(function (r) {
        return self.registration.showNotification(r.title, {
          body: r.body,
          tag: r.key,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          data: { url: './' }
        });
      }));
    });
  });
}

/* Vérification quotidienne en arrière-plan (Chrome Android, appli installée). */
self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'entretien-check') e.waitUntil(checkAndNotify(false));
});

/* Vérification demandée par l'appli à l'ouverture. */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'check') e.waitUntil(checkAndNotify(!!e.data.force));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
