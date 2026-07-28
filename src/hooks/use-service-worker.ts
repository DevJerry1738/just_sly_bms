import { useEffect, useState } from "react";

export function useServiceWorker() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setNeedRefresh(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
  }, []);

  const updateServiceWorker = () => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.location.reload();
    }
  };

  return {
    needRefresh,
    updateServiceWorker,
  };
}
