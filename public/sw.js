var CAREPLAND_CACHE_VERSION = "carepland-offline-v2";
var CAREPLAND_APP_SHELL = [
  "/",
  "/offline.html",
  "/carepland-logo.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon-32x32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CAREPLAND_CACHE_VERSION)
      .then(function (cache) {
        return cache.addAll(CAREPLAND_APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheName !== CAREPLAND_CACHE_VERSION) {
              return caches.delete(cacheName);
            }
            return undefined;
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.indexOf("/api/") === 0) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline.html");
      })
    );
    return;
  }

  if (
    url.pathname.indexOf("/_next/static/") === 0 ||
    url.pathname.indexOf("/favicon") === 0 ||
    url.pathname.indexOf("/icon-") === 0 ||
    url.pathname.indexOf("/apple-touch-icon") === 0 ||
    url.pathname.indexOf("/carepland-logo.png") === 0 ||
    /\.(?:avif|gif|jpg|jpeg|png|svg|webp|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then(function (networkResponse) {
          if (networkResponse && networkResponse.ok) {
            var responseToCache = networkResponse.clone();
            caches.open(CAREPLAND_CACHE_VERSION).then(function (cache) {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
