// Service worker do PWA. Estratégia deliberadamente conservadora: só cacheia
// assets estáticos com hash no nome (JS/CSS/fontes/imagens do build), nunca
// navegação (HTML) nem chamadas de API — os dados do CRM têm que ser sempre
// frescos, e o app shell (HTML) precisa sempre buscar a versão atual pra não
// prender o usuário numa build antiga depois de um deploy.
const CACHE_NAME = "zapediu-assets-v1";
const STATIC_ASSET_RE = /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_ASSET_RE.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    })
  );
});
