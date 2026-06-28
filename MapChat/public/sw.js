const CACHE_NAME = "where2go-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/index.css",
  "/src/types.ts",
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell & static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[Service Worker] Some non-essential assets failed to pre-cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event with Network-First falling back to Cache strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or browser extension requests
  if (request.method !== "GET" || url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Skip Google Maps API dynamically loaded scripts as they use JSONP and shouldn't be hard-cached
  if (url.hostname.includes("maps.googleapis.com") || url.hostname.includes("maps.gstatic.com")) {
    return;
  }

  // Network First, with Cache Fallback for general application files & API proxies
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses from our own domain
        if (networkResponse.status === 200 && url.origin === self.location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (poor/no internet), try to serve from cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If we requested index.html / navigation, fallback to root
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
          // If all fails, return a custom offline JSON message for APIs
          if (request.headers.get("accept")?.includes("application/json")) {
            return new Response(
              JSON.stringify({
                error: "You are currently offline. This action requires an active internet connection.",
                offline: true,
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }
        });
      })
  );
});
