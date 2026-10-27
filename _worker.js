const archiveGalleryWorker = { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/gallery/")) return env.ASSETS.fetch(request);
  const fail = (status, error) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!["GET", "HEAD"].includes(request.method)) return fail(405, "图库仅供浏览，上传与分类请前往协作站");
  if (!/^\/api\/gallery\/archive(?:\/groups\/[a-f0-9-]{36}|\/[a-f0-9-]{36}(?:\/thumb)?)?$/.test(url.pathname)) return fail(404, "接口不存在");
  try {
    const origin = new URL(env.GALLERY_ARCHIVE_ORIGIN);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw Error();
    const cacheable = request.method === "GET" && url.pathname.endsWith("/thumb") && !request.headers.has("Range") && !request.headers.has("Authorization") && !request.headers.has("Cookie");
    const cache = cacheable && typeof caches !== "undefined" ? caches.default : null;
    const key = new Request(url.toString());
    if (cache) {
      try {
        const hit = await cache.match(key);
        if (hit) {
          const age = Math.max(0, Math.floor((Date.now() - Number(hit.headers.get("X-Denia-Cached-At") || 0)) / 1e3));
          if (age < 300) {
            const headers2 = new Headers(hit.headers);
            headers2.delete("X-Denia-Cached-At");
            headers2.set("Cache-Control", `public, max-age=${300 - age}`);
            headers2.set("X-Denia-Cache", "HIT");
            headers2.set("Server-Timing", 'archive_cache;desc="HIT"');
            return new Response(hit.body, { status: 200, headers: headers2 });
          }
        }
      } catch {
      }
    }
    const target = new URL(url.pathname + url.search, origin);
    const started = performance.now();
    const response = await fetch(target, { method: request.method, redirect: "manual", signal: AbortSignal.timeout(25e3) });
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "cache-control", "content-disposition"]) if (response.headers.has(name)) headers.set(name, response.headers.get(name));
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Server-Timing", `archive_origin;dur=${(performance.now() - started).toFixed(1)}`);
    headers.set("X-Denia-Cache", cache ? "MISS" : "BYPASS");
    if (!response.ok) return fail(response.status === 404 ? 404 : 503, "归档展示暂时不可用，请稍后刷新");
    const result = new Response(response.body, { status: response.status, headers });
    if (cache && ctx?.waitUntil && response.status === 200 && headers.get("content-type")?.startsWith("image/") && headers.get("cache-control") === "public, max-age=300" && !response.headers.has("Set-Cookie")) {
      const stored = result.clone();
      stored.headers.set("X-Denia-Cached-At", String(Date.now()));
      ctx.waitUntil(cache.put(key, stored).catch(() => {
      }));
    }
    return result;
  } catch {
    return fail(503, "归档电脑暂时未连接，请稍后刷新");
  }
} };
export {
  archiveGalleryWorker as default
};
