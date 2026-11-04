// L'application d'ESJBM a déménagé sur Easy School (un produit Angy Company).
// Ce service worker efface l'ancienne copie hors ligne et se retire : les pages vont désormais vers Easy School.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("https://easyschool-sn.vercel.app/?ecole=esjbm");
  })());
});
