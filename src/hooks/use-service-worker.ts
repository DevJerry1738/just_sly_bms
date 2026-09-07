import { useEffect, useState } from "react";

export function useServiceWorker() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let isCancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration && registration.active) {
            await registration.unregister();
          }
        }

        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (isCancelled) return;

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setNeedRefresh(true);
            }
          });
        });

        if (registration.waiting) {
          setNeedRefresh(true);
        }
      } catch (err) {
        console.warn("[PWA] Service Worker registration failed:", err);
      }
    };

    void registerServiceWorker();

    return () => {
      isCancelled = true;
    };
  }, []);

  const updateServiceWorker = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        if (registration.installing) {
          registration.installing.postMessage({ type: "SKIP_WAITING" });
        }
      }
    } catch (err) {
      console.warn("[PWA] Could not trigger service worker refresh:", err);
    }

    window.location.reload();
  };

  return {
    needRefresh,
    updateServiceWorker,
  };
}
