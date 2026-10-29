const CACHE = "ninho-shell-v8";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // Cacheia arquivo a arquivo: um asset ausente não derruba a instalação.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL.map((asset) => cache.add(asset)))
      )
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  // APIs e pagamentos nunca passam pelo cache: sempre rede e sempre atuais.
  if (requestUrl.pathname.startsWith("/.netlify/functions/")) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Fontes do Google: cache-first para manter a tipografia offline.
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
              return response;
            })
        )
      );
    }
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
