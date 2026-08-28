const CACHE_VERSION = "property-planner-v3";
const ASSETS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/calc.js",
  "js/rates.js",
  "js/tax.js",
  "js/glossary.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  // Deliberately does NOT call self.clients.claim() here — a new service
  // worker should wait until every open instance of the app is fully
  // closed before it takes over, avoiding a mid-session hijack that can
  // crash a page already executing old code.
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
