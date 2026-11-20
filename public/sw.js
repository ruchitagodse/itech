// iTech Care PWA Service Worker
const CACHE_NAME = "itech-care-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/splash/apple-splash-portrait.png"
];

// Install: Cache static app shell assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn("PWA: Pre-caching asset skipped:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up stale caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first strategy for live service data, fallback to cache
self.addEventListener("fetch", event => {
  const req = event.request;

  // Ignore non-GET, API routes, Firebase Auth, and WebSocket requests
  if (
    req.method !== "GET" ||
    req.url.includes("/api/") ||
    req.url.includes("identitytoolkit") ||
    req.url.includes("securetoken") ||
    req.url.includes("firestore.googleapis.com")
  ) {
    return;
  }

  // Handle static assets & images: Stale-while-revalidate / cache-first
  if (req.url.includes("/icons/") || req.url.includes("/splash/") || req.url.includes("/screenshots/")) {
    event.respondWith(
      caches.match(req).then(cached => {
        return cached || fetch(req).then(networkRes => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Network-first for pages
  event.respondWith(
    fetch(req).catch(() => {
      return caches.match(req).then(cached => {
        if (cached) return cached;
        // If navigation request fails, return cached root or standard offline fallback
        if (req.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
