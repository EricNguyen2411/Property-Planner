// Bump this on every deployed change so the browser detects an update.
const CACHE_VERSION = "property-planner-v16";

const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/rates.js",
  "./js/tax.js",
  "./js/glossary.js",
  "./js/calc.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  // Deliberately NOT calling self.skipWaiting() here: a new service worker
  // should wait until every open tab/instance of the app is fully closed
  // before it takes over, so an update never hijacks a page mid-session.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  // Deliberately NOT calling self.clients.claim() here, for the same reason.
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
