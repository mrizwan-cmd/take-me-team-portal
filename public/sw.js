const CACHE = "take-me-portal-v4";
const SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/take-me-icon-192.png",
  "/take-me-icon-512.png",
  "/take-me-maskable-512.png",
  "/apple-touch-icon.png",
  "/take-me-logo-black.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const cacheCopy = response.clone();
            caches.open(CACHE).then(cache => cache.put("/", cacheCopy));
          }
          return response;
        })
        .catch(() => caches.match("/").then(response => response || caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const cacheCopy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, cacheCopy));
        }
        return response;
      });
      return cached || network;
    })
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
