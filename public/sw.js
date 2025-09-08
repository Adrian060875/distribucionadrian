self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("static-v1").then((c) => c.addAll(["/","/manifest.json"])));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const isGet = r.method === "GET";
  const dest = r.destination;
  const cacheable = ["", "document", "style", "script", "image", "font"].includes(dest);
  if (isGet && cacheable) {
    e.respondWith(
      caches.match(r).then((cached) =>
        cached ||
        fetch(r).then((res) => {
          const copy = res.clone();
          caches.open("static-v1").then((c) => c.put(r, copy));
          return res;
        })
      )
    );
  }
});
