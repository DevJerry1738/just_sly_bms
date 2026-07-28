/**
 * Service Worker — Just Sly Business Management Suite
 * Enterprise Offline-First PWA Caching & Background Sync Shell
 */

const CACHE_NAME = "just-sly-suite-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/offline.html"
];

// 1. Install Event — Pre-cache static App Shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try caching shell files
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn("[SW] Non-critical error pre-caching static assets:", err);
      }
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event — Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Network-First for API/Supabase, Stale-While-Revalidate for static assets
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (handled by SyncQueue in IndexedDB)
  if (request.method !== "GET") return;

  // Never cache authentication or API data responses in Service Worker Cache
  if (
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/rest/v1/") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  // Handle HTML navigation (App Shell fallback)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;
        const offlinePage = await cache.match("/offline.html");
        return offlinePage || new Response("Offline", { status: 503, statusText: "Offline" });
      })
    );
    return;
  }

  // Static Assets / Fonts / Scripts — Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Background Sync Listener Placeholder
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-queue") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "BACKGROUND_SYNC_TRIGGER" });
        });
      })
    );
  }
});
