/* global self, caches, URL, fetch, Response */
/* Cache offline apenas do próprio dashboard. Fornecedores e proxies externos ficam sempre em rede. */
const CACHE_PREFIX = "dash-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_BASE = new URL("./", self.location.href);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(APP_BASE.href)
    .then(() => cache.add(new URL("pwa-icon.svg", APP_BASE).href))));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname) || url.pathname.includes("/proxy")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) await caches.open(CACHE_NAME).then(cache => cache.put(APP_BASE.href, response.clone()));
      return response;
    }).catch(async () => (await caches.match(APP_BASE.href)) || Response.error()));
    return;
  }

  if (!/\.(?:html|css|js|svg|webmanifest|woff2?)$/i.test(url.pathname)) return;

  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }));
});
