// ============================================================
// Service Worker — Clínica Psi PWA
// Estratégia: Cache-First para assets estáticos,
//             Network-First para API calls Firebase
// ============================================================

const CACHE_VERSION   = "clinica-psi-v1";
const STATIC_CACHE    = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE   = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  "/",
  "/login",
  "/manifest.json",
  "/favicon.ico",
];

// ─── Install: pré-cacheia assets estáticos ────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Falha ao pré-cachear:", err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: limpa caches antigos ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("clinica-psi-") && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: estratégia de cache ───────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora chamadas não-GET e extensões Chrome
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // Firebase API: Network-First (dados em tempo real)
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com")
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Assets estáticos: Cache-First
  if (
    request.destination === "image" ||
    request.destination === "font"  ||
    url.pathname.startsWith("/_next/static")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            return response;
          })
        );
      })
    );
    return;
  }

  // Páginas: Network-First com fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
