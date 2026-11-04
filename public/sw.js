// Service worker : rend l'application installable et garde l'interface disponible en cas de coupure.
// Les données (API) sont gardées par l'application elle-même (IndexedDB), pas ici.
const CACHE = "esjbm-v4";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.add("/")).catch(() => {})); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c));
          // Toutes les pages de l'application utilisent le même index.html : on le garde pour le hors ligne.
          if (e.request.mode === "navigate") { const c2 = r.clone(); caches.open(CACHE).then((ca) => ca.put("/", c2)); }
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || (e.request.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
