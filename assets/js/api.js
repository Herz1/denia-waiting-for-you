/**
 * 客户端数据层：优先走后端 /api，失败时回落到 localStorage + 种子 JSON（纯静态部署可用）。
 * 对外暴露 window.DeniaAPI。
 */
/** 站点根路径（由本模块 URL 推导，子目录部署也能用） */
export const BASE = new URL("../..", import.meta.url).pathname;
export const asset = (p) => (p && p.startsWith("assets/")) ? BASE + p : p;

const LS = {
  works: "denia.fanworks.works.v2",
  favs: "denia.fanworks.favs.v2",
  cakes: "denia.cakes.v2",
  memo: "denia.pet.memo.v2"
};

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function timedFetch(url, opts, ms = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error("http " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const API = {
  mode: "connecting", // connecting | server | local
  listeners: new Set(),
  onMode(fn) {
    this.listeners.add(fn);
    fn(this.mode);
    return () => this.listeners.delete(fn);
  },
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.listeners.forEach((fn) => fn(mode));
  },

  async probe() {
    try {
      await timedFetch(BASE + "api/health", {}, 1800);
      this.setMode("server");
    } catch {
      this.setMode("local");
    }
    return this.mode;
  },

  /* ---- 状态 / 蛋糕 ---- */
  async state() {
    if (this.mode === "server") {
      try {
        return await timedFetch(BASE + "api/state");
      } catch { /* fallthrough */ }
    }
    const cakes = lsGet(LS.cakes, { total: 0, days: {} });
    const today = new Date().toISOString().slice(0, 10);
    const epoch = Date.UTC(2026, 4, 20);
    const now = new Date();
    const day = Math.max(0, Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - epoch) / 86400000));
    return { day, cakes: { total: cakes.total || 0, today: cakes.days?.[today] || 0 }, source: "local" };
  },
  async leaveCake() {
    if (this.mode === "server") {
      try {
        return await timedFetch(BASE + "api/cake", { method: "POST" });
      } catch { /* fallthrough */ }
    }
    const cakes = lsGet(LS.cakes, { total: 0, days: {} });
    const today = new Date().toISOString().slice(0, 10);
    cakes.total = (cakes.total || 0) + 1;
    cakes.days = cakes.days || {};
    cakes.days[today] = (cakes.days[today] || 0) + 1;
    lsSet(LS.cakes, cakes);
    return { total: cakes.total, today: cakes.days[today], line: "", source: "local" };
  },

  /* ---- 二创收录 ---- */
  async loadWorks() {
    if (this.mode === "server") {
      try {
        const r = await timedFetch(BASE + "api/works");
        return { works: r.works, source: r.source === "seed" ? "seed" : "server" };
      } catch { /* fallthrough */ }
    }
    const local = lsGet(LS.works, null);
    if (local) return { works: local, source: "local" };
    try {
      const seed = await timedFetch(BASE + "data/works.seed.json", {}, 4000);
      return { works: seed, source: "seed" };
    } catch {
      return { works: [], source: "empty" };
    }
  },
  async saveWorks(works) {
    if (this.mode === "server") {
      try {
        await timedFetch(BASE + "api/works", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(works) }, 6000);
        return { ok: true, where: "server" };
      } catch { /* fallthrough */ }
    }
    lsSet(LS.works, works);
    try { window.dispatchEvent(new StorageEvent(LS.works)); } catch { /* ignore */ }
    return { ok: true, where: "local" };
  },
  resetLocalWorks() {
    try { localStorage.removeItem(LS.works); } catch { /* ignore */ }
  },

  /* ---- 收藏 ---- */
  loadFavs() { return lsGet(LS.favs, []); },
  saveFavs(list) {
    lsSet(LS.favs, list);
    try { window.dispatchEvent(new StorageEvent(LS.favs)); } catch { /* ignore */ }
  },

  /* ---- 画廊 /  trivia ---- */
  async gallery() {
    if (this.mode === "server") {
      try { return await timedFetch(BASE + "api/gallery"); } catch { /* fallthrough */ }
    }
    return timedFetch(BASE + "data/gallery.seed.json", {}, 4000);
  },
  async trivia() {
    if (this.mode === "server") {
      try { return await timedFetch(BASE + "api/trivia"); } catch { /* fallthrough */ }
    }
    return timedFetch(BASE + "data/trivia.json", {}, 4000);
  },

  /* ---- 聊天 ---- */
  async chat(message, ctx) {
    if (this.mode === "server") {
      try {
        return await timedFetch(BASE + "api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, ...ctx }) });
      } catch { /* fallthrough */ }
    }
    const mod = await import("./chat-engine.js");
    const state = lsGet(LS.cakes, { total: 0 });
    return mod.reply(message, { ...ctx, cakes: state.total || 0 });
  },

  /* ---- 桌宠记忆 ---- */
  memo: {
    load() { return lsGet(LS.memo, { userName: "", affection: 0, pets: 0 }); },
    save(m) { lsSet(LS.memo, m); }
  }
};

window.DeniaAPI = API;
