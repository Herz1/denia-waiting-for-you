import { API } from "./api.js";
import { h, icon, toast, confirmDialog, bindStatusBadge, fmtDate } from "./ui.js";

const KIND_LABEL = { video: "视频", fiction: "同人文", game: "同人游戏", daily: "二创日报", meme: "表情包", tool: "工具与桌宠" };
const KIND_SUB = {
  video: "手书 · 剪辑 · MMD · 音乐", fiction: "故事与文字", game: "可游玩的世界与同人企划",
  daily: "按期回看", meme: "聊天里的小小陪伴", tool: "开源工具 · 皮肤 · 变声器 · 桌宠"
};
const KIND_ICON = { video: "video", fiction: "book", game: "gamepad", daily: "news", meme: "smile", tool: "wrench" };
const KINDS = Object.keys(KIND_LABEL);
const PAGE_SIZE = 12;

document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon, 15)));
(function bubbles() {
  const root = document.getElementById("bubbles");
  for (let i = 0; i < 10; i++) {
    const b = h("i");
    const size = 10 + Math.random() * 46;
    b.style.width = b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 18 + Math.random() * 20 + "s";
    b.style.animationDelay = -Math.random() * 30 + "s";
    root.append(b);
  }
})();
bindStatusBadge(document.getElementById("status"));

/* ---------------- 状态 ---------------- */
const S = {
  works: [], favs: [], source: "",
  kind: "all", q: "", access: "all", sort: "new", favOnly: false, page: 1,
  draft: null, dirty: false, msg: ""
};
const $ = (id) => document.getElementById(id);

const isURL = (u) => { try { const g = new URL(u); return ["https:", "http:"].includes(g.protocol) && !g.username && !g.password; } catch { return false; } };
const isLocal = (u) => typeof u === "string" && u.startsWith("./");

function setMsg(t) { S.msg = t; $("manager-msg").textContent = t; }

/* ---------------- 过滤 ---------------- */
function filtered() {
  const q = S.q.trim().toLowerCase();
  let list = S.works.filter((w) => {
    if (S.kind !== "all" && w.kind !== S.kind) return false;
    if (S.access !== "all" && w.access !== S.access) return false;
    if (S.favOnly && !S.favs.includes(w.id)) return false;
    if (q) {
      const hay = [w.title, w.author, w.summary, ...(w.tags || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const by = {
    new: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    title: (a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"),
    kind: (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  };
  return list.sort(by[S.sort]);
}

/* ---------------- 渲染 ---------------- */
function card(w, featured = false) {
  const faved = S.favs.includes(w.id);
  const dailySelf = w.kind === "daily" && !!w.author && (w.title === w.author || w.title.startsWith(w.author + " · "));
  return h("article", { class: "fw-card" + (featured ? " fw-featured" : "") },
    h("div", { class: "fw-art fw-art-" + w.kind, "aria-hidden": "true" },
      h("span", { class: "fw-kind-icon", html: icon(KIND_ICON[w.kind], featured ? 26 : 22) }),
      h("span", {}, KIND_LABEL[w.kind])),
    h("div", { class: "fw-card-body" },
      h("div", { class: "fw-meta" },
        h("span", {}, KIND_LABEL[w.kind]),
        h("span", {}, (w.access === "paid" ? "购买渠道" : w.access === "open" ? "开源" : "免费") + (w.restricted ? " · 限龄外链" : ""))),
      h("button", { class: "fw-title", onclick: () => openDetail(w) }, w.title),
      !dailySelf && w.author ? h("p", { class: "fw-author" }, w.author) : null,
      (!featured || w.restricted) ? h("p", { class: "fw-excerpt" }, w.restricted ? "仅收录来源入口，阅读要求以原平台为准。" : w.summary) : null,
      h("div", { class: "fw-tags" }, (w.tags || []).slice(0, 4).map((t) =>
        h("button", { onclick: () => { S.q = t; $("q").value = t; S.page = 1; render(); $("fw-library").scrollIntoView({ behavior: "smooth" }); } }, "#", t))),
      h("div", { class: "fw-card-foot" },
        h("button", { onclick: () => openDetail(w) }, featured ? "轻叩门扉 " : "查看详情 ", h("span", { html: icon("arrow", 13) })),
        h("button", {
          class: "fw-favorite", "aria-pressed": String(faved),
          "aria-label": (faved ? "取消收藏：" : "收藏：") + w.title,
          onclick: () => toggleFav(w)
        }, h("span", { html: icon("heart", 14) }), faved ? "已收藏" : "收藏"))
    )
  );
}

function renderFeatured() {
  const dates = [...new Set(S.works.map((w) => w.recommendDate).filter(Boolean))].sort().reverse();
  const box = $("featured");
  if (!dates.length) { box.replaceChildren(); box.hidden = true; return; }
  box.hidden = false;
  const date = dates[0];
  const picks = S.works.filter((w) => w.recommendDate === date);
  box.replaceChildren(
    h("div", { class: "fw-section-head" },
      h("div", {}, h("p", { class: "fw-eyebrow" }, "FEATURED"), h("h2", {}, `精选 · ${date}`)),
      h("span", {}, `共 ${picks.length} 条推荐`)),
    h("div", { class: "fw-recommendations" }, picks.slice(0, 4).map((w) => card(w, true)))
  );
}

function renderCategories() {
  $("categories").replaceChildren(...KINDS.map((k) => {
    const n = S.works.filter((w) => w.kind === k).length;
    return h("button", { "aria-pressed": String(S.kind === k), onclick: () => { S.kind = S.kind === k ? "all" : k; S.page = 1; render(); } },
      h("span", { html: icon(KIND_ICON[k], 22) }),
      h("div", {}, h("strong", {}, KIND_LABEL[k]), h("small", {}, ` ${n}`)),
      h("span", {}, KIND_SUB[k]));
  }));
}

function renderTagcloud() {
  const count = new Map();
  S.works.forEach((w) => (w.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  $("tagcloud").replaceChildren(...top.map(([t, n]) =>
    h("button", { "aria-pressed": String(S.q === t), onclick: () => { S.q = S.q === t ? "" : t; $("q").value = S.q; S.page = 1; render(); } }, `#${t} ×${n}`)));
}

function render() {
  renderFeatured();
  renderCategories();
  renderTagcloud();
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  S.page = Math.min(S.page, pages);
  const slice = list.slice((S.page - 1) * PAGE_SIZE, S.page * PAGE_SIZE);
  $("result-count").textContent = `共 ${S.works.length} 条收录 · 当前筛选 ${list.length} 条`;
  $("fw-result").textContent = list.length
    ? `第 ${S.page} / ${pages} 页${S.favOnly ? " · 只看收藏" : ""}${S.q ? ` · 关键词「${S.q}」` : ""}`
    : "";
  $("grid").replaceChildren(slice.length ? slice.map((w) => card(w)) :
    h("div", { class: "fw-empty", style: "grid-column:1/-1" },
      h("h3", {}, "这一格书架还空着"),
      h("p", {}, "没有匹配的收录。换个关键词，或者由你把第一件作品放上来。"),
      h("div", { class: "fw-empty-actions" },
        h("button", { onclick: () => { S.kind = "all"; S.q = ""; S.access = "all"; S.favOnly = false; $("q").value = ""; $("access").value = "all"; $("fav-only").setAttribute("aria-pressed", "false"); render(); } }, "清空筛选"),
        h("button", { onclick: () => openEditor(null) }, "新增收录"))));
  $("pagination").replaceChildren(
    h("button", { disabled: S.page <= 1, onclick: () => { S.page -= 1; render(); scrollLib(); } }, "← 上一页"),
    h("span", {}, `${S.page} / ${pages}`),
    h("button", { disabled: S.page >= pages, onclick: () => { S.page += 1; render(); scrollLib(); } }, "下一页 →"));
  $("fav-only").setAttribute("aria-pressed", String(S.favOnly));
}
const scrollLib = () => $("fw-library").scrollIntoView({ behavior: "smooth", block: "start" });

/* ---------------- 收藏 ---------------- */
function toggleFav(w) {
  const has = S.favs.includes(w.id);
  S.favs = has ? S.favs.filter((x) => x !== w.id) : [...S.favs, w.id];
  API.saveFavs(S.favs);
  render();
  toast(has ? "已取消收藏" : `已收藏：${w.title}`);
}
window.addEventListener("storage", (e) => {
  if (e.key === "denia.fanworks.favs.v2") { S.favs = API.loadFavs(); render(); }
});

/* ---------------- 详情 ---------------- */
function openDetail(w) {
  const old = document.querySelector("#detail-dlg");
  old?.remove();
  const dlg = h("dialog", { class: "dlg fw-dialog", id: "detail-dlg" },
    h("button", { class: "dlg-close", "aria-label": "关闭", onclick: () => dlg.close(), html: icon("x", 16) }),
    h("p", { class: "fw-eyebrow" }, KIND_LABEL[w.kind] + " · " + fmtDate(w.createdAt)),
    h("h2", {}, w.title),
    w.author ? h("p", { class: "fw-author", style: "margin:-8px 0 14px" }, w.author) : null,
    h("p", { class: "fw-description" }, w.restricted ? "仅收录来源入口，阅读要求以原平台为准。" : (w.summary || "（无简介）")),
    w.reason ? h("blockquote", {}, "推荐理由：" + w.reason) : null,
    h("div", { class: "fw-tags", style: "margin-bottom:18px" }, (w.tags || []).map((t) => h("span", { class: "fw-pill", style: "cursor:default" }, "#", t))),
    h("div", { class: "fw-actions" },
      w.url ? h("a", { class: "fw-primary", href: w.url, target: isLocal(w.url) ? "" : "_blank", rel: "noopener noreferrer" },
        isLocal(w.url) ? "站内前往" : "前往原投稿", h("span", { html: icon("external", 14) })) : null,
      h("button", { class: "btn-ghost", onclick: () => { toggleFav(w); dlg.close(); } }, S.favs.includes(w.id) ? "取消收藏" : "收藏"),
      h("button", { class: "btn-ghost", onclick: () => { dlg.close(); openEditor(w); } }, "编辑")),
    h("p", { class: "fw-hint", style: "margin-top:14px" }, `ID：${w.id}${w.recommendDate ? " · 推荐日 " + w.recommendDate : ""}`)
  );
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------------- 编辑器 ---------------- */
function openEditor(w) {
  const old = document.querySelector("#editor-dlg");
  old?.remove();
  const d = w ? { ...w, tags: (w.tags || []).join("，") } : {
    id: "", kind: "video", title: "", author: "", url: "", summary: "", tags: "",
    access: "free", restricted: false, recommendDate: "", reason: ""
  };
  const f = (name, label, type = "input", attrs = {}) =>
    h("label", {}, label,
      type === "textarea" ? h("textarea", { rows: 4, name, ...attrs }) :
      type === "select" ? h("select", { name }, ...Object.entries(attrs.options).map(([v, t]) => h("option", { value: v, selected: d[name] === v }, t))) :
      h("input", { type, name, ...attrs })) ;
  const form = h("form", { class: "fw-editor", onsubmit: (e) => { e.preventDefault(); save(); } },
    h("div", { class: "fw-form-row" },
      f("kind", "类型", "select", { options: KIND_LABEL }),
      f("access", "获取方式", "select", { options: { free: "免费", paid: "购买渠道", open: "开源" } })),
    f("title", "标题 *"),
    f("author", "作者 / 社团"),
    f("url", "链接（http(s) 或 ./ 站内路径）"),
    f("summary", "简介", "textarea"),
    f("tags", "标签（逗号分隔）"),
    h("div", { class: "fw-form-row" },
      f("recommendDate", "推荐日期（YYYY-MM-DD，留空不推荐）"),
      f("reason", "推荐理由", "textarea", { rows: 2 })),
    h("label", { class: "fw-checkbox" }, h("input", { type: "checkbox", name: "restricted", checked: !!d.restricted }), "限龄外链（仅保留来源入口）"),
    h("p", { class: "fw-hint" }, "带 * 为必填。保存后写入" + "（后端在线：服务器；否则：本浏览器）" + "。"),
    h("p", { role: "alert", id: "editor-error", style: "min-height:18px" }),
    h("div", { class: "fw-actions" },
      h("button", { class: "fw-primary", type: "submit" }, "保存收录"),
      w ? h("button", { type: "button", class: "fw-delete", onclick: async () => { if (await confirmDialog(`删除「${w.title}」？此操作会写入收录数据。`)) { S.works = S.works.filter((x) => x.id !== w.id); await persist(); dlg.close(); render(); toast("已删除"); } } }, "删除") : null,
      h("button", { type: "button", class: "btn-ghost", onclick: () => dlg.close() }, "取消"))
  );
  // 填充初始值
  requestAnimationFrame(() => {
    for (const [k, v] of Object.entries(d)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? "";
    }
  });
  const dlg = h("dialog", { class: "dlg fw-dialog", id: "editor-dlg" },
    h("button", { class: "dlg-close", "aria-label": "关闭", onclick: () => dlg.close(), html: icon("x", 16) }),
    h("h2", {}, w ? "编辑收录" : "新增收录"), form);
  document.body.append(dlg);
  dlg.showModal();

  async function save() {
    const fd = new FormData(form);
    const rec = {
      id: w?.id || crypto.randomUUID(),
      kind: fd.get("kind"), access: fd.get("access"),
      title: String(fd.get("title") || "").trim(),
      author: String(fd.get("author") || "").trim(),
      url: String(fd.get("url") || "").trim(),
      summary: String(fd.get("summary") || "").trim(),
      tags: String(fd.get("tags") || "").split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      recommendDate: String(fd.get("recommendDate") || "").trim(),
      reason: String(fd.get("reason") || "").trim(),
      restricted: form.elements.restricted.checked,
      createdAt: w?.createdAt || new Date().toISOString()
    };
    const err = [];
    if (!rec.title) err.push("标题必填");
    if (rec.url && !isURL(rec.url) && !isLocal(rec.url)) err.push("链接需为 http(s) 或 ./ 站内路径");
    if (rec.recommendDate && !/^\d{4}-\d{2}-\d{2}$/.test(rec.recommendDate)) err.push("推荐日期格式 YYYY-MM-DD");
    if (err.length) { form.querySelector("#editor-error").textContent = "未保存：" + err.join("；"); return; }
    S.works = w ? S.works.map((x) => (x.id === w.id ? rec : x)) : [rec, ...S.works];
    await persist();
    dlg.close(); render();
    toast(w ? "已更新收录" : "已新增收录");
  }
}

async function persist() {
  const r = await API.saveWorks(S.works);
  setMsg(r.where === "server" ? "已保存到服务器（server/runtime/works.json）。" : "已保存在当前浏览器（本地模式）。可导出 JSON 交接给整理者。");
  return r;
}

/* ---------------- 管理台 ---------------- */
$("btn-new").addEventListener("click", () => openEditor(null));
$("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(S.works, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `denia-fanworks-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setMsg("已请求下载 JSON 备份，请确认浏览器已保存文件。");
});
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("文件超过 5 MiB");
    const list = JSON.parse(await file.text());
    if (!Array.isArray(list)) throw new Error("JSON 顶层需为数组");
    if (!await confirmDialog(`导入 ${list.length} 条作品：同 ID 更新，其余保留。继续？`)) return;
    const map = new Map(S.works.map((w) => [w.id, w]));
    list.forEach((w) => w?.id && map.set(w.id, { ...map.get(w.id), ...w }));
    S.works = [...map.values()];
    await persist(); render();
    setMsg(`导入完成：${S.works.length} 条。`);
  } catch (err) {
    setMsg("导入失败，原数据保留：" + (err?.message || "文件无效"));
  }
});
$("btn-reset").addEventListener("click", async () => {
  if (!await confirmDialog("放弃本机/服务器覆盖数据，恢复随站发布的种子收录？")) return;
  API.resetLocalWorks();
  const r = await API.loadWorks();
  S.works = r.works; S.source = r.source;
  await API.saveWorks(S.works).catch(() => {});
  render(); setMsg("已恢复种子数据。");
});

/* 工具栏 */
$("q").addEventListener("input", (e) => { S.q = e.target.value; S.page = 1; render(); });
$("access").addEventListener("change", (e) => { S.access = e.target.value; S.page = 1; render(); });
$("sort").addEventListener("change", (e) => { S.sort = e.target.value; render(); });
$("fav-only").addEventListener("click", () => { S.favOnly = !S.favOnly; S.page = 1; render(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { e.preventDefault(); $("q").focus(); }
});

/* ---------------- 启动 ---------------- */
(async () => {
  await API.probe();
  const [w, st] = await Promise.all([API.loadWorks(), API.state().catch(() => null)]);
  S.works = w.works; S.source = w.source;
  S.favs = API.loadFavs();
  const note = { server: "数据来源：服务器收录（server）", seed: "数据来源：随站种子收录（seed）", local: "数据来源：本浏览器存档（local）", empty: "数据来源：空（等待第一次导入）" };
  $("source-note").innerHTML = icon("sparkle", 13) + " " + (note[S.source] || "") + (st ? ` · 等待第 ${st.day} 天` : "");
  render();
})();
