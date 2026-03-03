"use client";

import { useEffect } from "react";

/**
 * Registra o Service Worker para PWA (offline-first).
 * Deve ser montado uma vez no RootLayout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.info("[SW] Registrado com sucesso:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Falha ao registrar:", err);
        });
    }
  }, []);

  return null;
}
