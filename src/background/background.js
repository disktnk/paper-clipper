// MV3 service worker. We don't run translators here yet; the popup does all
// the work. The worker is kept for future extension (e.g. context-menu save,
// background queue, scheduled refresh of identifiers).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
