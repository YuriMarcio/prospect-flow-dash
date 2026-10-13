// Service worker do PWA. Estratégia deliberadamente conservadora: só cacheia
// assets estáticos com hash no nome (JS/CSS/fontes/imagens do build), nunca
// navegação (HTML) nem chamadas de API — os dados do CRM têm que ser sempre
// frescos, e o app shell (HTML) precisa sempre buscar a versão atual pra não
// prender o usuário numa build antiga depois de um deploy.
const CACHE_NAME = "zapediu-assets-v2";
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

// Notificações push (lembretes de tarefas, vencimentos e metas), enviadas pela API.
// O payload é JSON: { title, body, tag?, url? }. O navegador exige mostrar uma notificação
// para cada push recebido, então aqui sempre chamamos showNotification.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Zapediu", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Mesma tag = substitui a notificação anterior do mesmo tipo em vez de empilhar.
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        // Se já está na tela certa não recarrega; senão leva o app até lá.
        if (open.url !== target && "navigate" in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })
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
