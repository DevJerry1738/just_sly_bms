/**
 * Service Worker — Just Sly Business Management Suite
 * Enterprise Offline-First PWA Caching & Navigation Fallback Shell
 */

const CACHE_NAME = "just-sly-suite-v2";

// Static core assets to pre-cache on SW installation
const CORE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/offline.html",
];

// 1. Install Event — Pre-cache core assets individually to prevent atomic failure
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "no-cache" });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn(`[SW] Could not pre-cache ${url}:`, err);
          }
        })
      );
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event — Clean up outdated caches and claim clients immediately
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

// 3. Fetch Event — Intelligent caching strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip external API requests & Supabase auth endpoints
  if (
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/rest/v1/") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  const acceptHeader = request.headers.get("accept") || "";
  const isNavigation =
    request.mode === "navigate" ||
    (acceptHeader.includes("text/html") && request.method === "GET");

  // A. Navigation Requests (HTML Page Navigation)
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          // Attempt network load first
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            // Cache successful HTML page navigation for offline reuse
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Network failed (Device is Offline)
        }

        // Offline Fallback Chain:
        const cache = await caches.open(CACHE_NAME);
        
        // 1. Try exact requested page from cache
        const cachedPage = await cache.match(request);
        if (cachedPage) return cachedPage;

        // 2. Try root '/' page shell from cache
        const rootShell = await cache.match("/");
        if (rootShell) return rootShell;

        // 3. Fallback to styled offline.html page
        const offlinePage = await cache.match("/offline.html");
        if (offlinePage) return offlinePage;

        // 4. Final safety response
        return new Response(
          `<!DOCTYPE html>
          <html>
            <head><title>Offline — Just Sly</title></head>
            <body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
              <div style="background:#1e293b;border:1px solid #334155;padding:2rem;border-radius:12px;max-width:380px;">
                <h2 style="margin:0 0 0.5rem;">Working Offline</h2>
                <p style="color:#94a3b8;font-size:0.875rem;">You are currently offline. Your data is safely stored in local storage and will sync automatically when connection is restored.</p>
                <button onclick="window.location.reload()" style="background:#3b82f6;color:white;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-weight:500;">Retry</button>
              </div>
            </body>
          </html>`,
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      })()
    );
    return;
  }

  // B. Asset Requests (JS, CSS, Images, Fonts) — Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Background Sync Listener
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
