/**
 * До свидания · 站点后端（零依赖 Node HTTP 服务）
 * - 静态托管整站（可退化为纯静态部署：客户端会自动回落到 localStorage / 种子数据）
 * - /api/health  健康检查
 * - /api/state   蛋糕计数 + 等待天数
 * - /api/cake    留一块蛋糕（限流：每 IP 每分钟 10 次）
 * - /api/works   二创收录（GET 读取 / PUT 整体替换，带校验）
 * - /api/gallery 画廊数据
 * - /api/chat    娅娅对话（规则引擎，与前端共用 chat-engine.js）
 * - /api/trivia  泡泡小故事
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reply as chatReply, REACTIONS, pick } from "../assets/js/chat-engine.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = path.join(ROOT, "server", "runtime");
const PORT = Number(process.env.PORT || 4173);
const HOST = "0.0.0.0";

/** 等待计数起点：2026-05-20（与旧站一致） */
export const WAIT_EPOCH = Date.UTC(2026, 4, 20);
export function waitingDay(now = new Date()) {
  return Math.max(0, Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - WAIT_EPOCH) / 86400000));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf"
};

async function ensureRuntime() {
  if (!existsSync(RUNTIME)) await mkdir(RUNTIME, { recursive: true });
}
async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(RUNTIME, file), "utf-8"));
  } catch {
    return fallback;
  }
}
async function writeJSON(file, value) {
  await ensureRuntime();
  await writeFile(path.join(RUNTIME, file), JSON.stringify(value, null, 2), "utf-8");
}
async function seed(name) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, "data", name), "utf-8"));
  } catch {
    return null;
  }
}

/* ---------- 蛋糕 ---------- */
const cakeRate = new Map(); // ip -> [count, windowStart]
async function getCakes() {
  const stored = await readJSON("cakes.json", null);
  if (stored && typeof stored.total === "number") return stored;
  return { total: 0, days: {} };
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- 收录校验（与前端规则一致） ---------- */
const KINDS = ["video", "fiction", "game", "daily", "meme", "tool"];
function validURL(u) {
  try {
    const g = new URL(u, "http://local.invalid/");
    return ["https:", "http:", "file:"].includes(g.protocol) || u.startsWith("./");
  } catch {
    return false;
  }
}
function validateWorks(list) {
  if (!Array.isArray(list) || list.length > 2000) throw new Error("需要最多 2000 条作品的数组");
  return list.map((w, i) => {
    if (!w || typeof w !== "object") throw new Error(`第 ${i + 1} 条不是对象`);
    const kind = KINDS.includes(w.kind) ? w.kind : "video";
    const title = String(w.title || "").trim().slice(0, 200);
    if (!title) throw new Error(`第 ${i + 1} 条缺少标题`);
    return {
      id: String(w.id || crypto.randomUUID()).slice(0, 120),
      kind,
      title,
      author: String(w.author || "").slice(0, 200),
      url: String(w.url || "").slice(0, 500),
      summary: String(w.summary || "").slice(0, 4000),
      tags: Array.isArray(w.tags) ? w.tags.slice(0, 12).map((t) => String(t).slice(0, 40)) : [],
      access: ["free", "paid", "open"].includes(w.access) ? w.access : "free",
      restricted: !!w.restricted,
      recommendDate: /^\d{4}-\d{2}-\d{2}$/.test(w.recommendDate || "") ? w.recommendDate : "",
      reason: String(w.reason || "").slice(0, 2000),
      createdAt: w.createdAt || new Date().toISOString()
    };
  });
}

function send(res, code, body, type = "application/json; charset=utf-8", headers = {}) {
  const buf = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
  res.end(buf);
}

async function handleAPI(req, res, url) {
  const ip = req.socket.remoteAddress || "?";
  if (url.pathname === "/api/health") {
    return send(res, 200, { ok: true, mode: "server", day: waitingDay(), time: new Date().toISOString() });
  }
  if (url.pathname === "/api/state") {
    const cakes = await getCakes();
    return send(res, 200, { day: waitingDay(), cakes: { total: cakes.total, today: cakes.days[todayKey()] || 0 } });
  }
  if (url.pathname === "/api/cake" && req.method === "POST") {
    const [count, start] = cakeRate.get(ip) || [0, Date.now()];
    if (Date.now() - start > 60000) cakeRate.set(ip, [1, Date.now()]);
    else if (count >= 10) return send(res, 429, { error: "蛋糕要一口一口吃，稍等一下再留吧。" });
    else cakeRate.set(ip, [count + 1, start]);
    const cakes = await getCakes();
    cakes.total += 1;
    cakes.days[todayKey()] = (cakes.days[todayKey()] || 0) + 1;
    await writeJSON("cakes.json", cakes);
    return send(res, 200, { total: cakes.total, today: cakes.days[todayKey()], line: pick(REACTIONS.cake).replaceAll("{cakes}", String(cakes.total)) });
  }
  if (url.pathname === "/api/works") {
    if (req.method === "GET") {
      const works = await readJSON("works.json", null);
      if (works) return send(res, 200, { source: "server", works });
      return send(res, 200, { source: "seed", works: (await seed("works.seed.json")) || [] });
    }
    if (req.method === "PUT" || req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      if (raw.length > 5 * 1024 * 1024) return send(res, 413, { error: "文件超过 5 MiB" });
      try {
        const works = validateWorks(JSON.parse(raw));
        await writeJSON("works.json", works);
        return send(res, 200, { ok: true, count: works.length });
      } catch (e) {
        return send(res, 400, { error: e.message || "JSON 无效" });
      }
    }
  }
  if (url.pathname === "/api/gallery" && req.method === "GET") {
    return send(res, 200, (await seed("gallery.seed.json")) || { items: [] });
  }
  if (url.pathname === "/api/trivia" && req.method === "GET") {
    return send(res, 200, (await seed("trivia.json")) || []);
  }
  if (url.pathname === "/api/chat" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let payload = {};
    try {
      payload = JSON.parse(raw || "{}");
    } catch { /* ignore */ }
    const ctx = {
      name: String(payload.name || "").slice(0, 40),
      day: waitingDay(),
      cakes: (await getCakes()).total
    };
    const r = chatReply(String(payload.message || "").slice(0, 500), ctx);
    return send(res, 200, r);
  }
  return send(res, 404, { error: "not found" });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "forbidden", "text/plain");
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) return serveStatic(req, res, new URL(pathname + "/index.html", "http://x"));
    const ext = path.extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    const cache = pathname.startsWith("/assets/art/") ? "public, max-age=86400" : "no-cache";
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": cache });
    res.end(body);
  } catch {
    // 404 页：返回首页片段提示
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8"><title>404 · До свидания</title>
      <body style="font-family:serif;background:#eee6f1;color:#4e4057;display:grid;place-items:center;height:100vh;margin:0">
      <div style="text-align:center"><p style="letter-spacing:4px">404</p><p>这一页漂到泡泡外面去了。</p><a href="/" style="color:#985b83">回门口 →</a></div>`);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://local.invalid/");
  try {
    if (url.pathname.startsWith("/api/")) return await handleAPI(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method not allowed" });
    return await serveStatic(req, res, url);
  } catch (e) {
    return send(res, 500, { error: String(e?.message || e) });
  }
});

ensureRuntime().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`[denia] server listening on http://${HOST}:${PORT} (day ${waitingDay()})`);
  });
});
