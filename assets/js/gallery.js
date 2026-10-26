import { API, asset } from "./api.js";
import { h, icon, bindStatusBadge } from "./ui.js";

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

let DATA = { items: [], categories: [], pledge: "", aiArchiveNotice: "" };
let active = "drawing";

const grid = document.getElementById("grid");
const extra = document.getElementById("extra");
const tabs = document.getElementById("tabs");

function render() {
  const counts = (cat) => DATA.items.filter((i) => i.category === cat).length;
  tabs.replaceChildren(...(DATA.categories || []).map((c) =>
    h("button", {
      class: "pill", role: "tab", "aria-selected": String(active === c.id),
      onclick: () => { active = c.id; render(); }
    }, h("span", { html: icon(c.id === "drawing" ? "brush" : c.id === "photo" ? "camera" : "moon", 14) }),
      `${c.name} · ${c.id === "ai-archive" ? "归档" : counts(c.id)}`)));

  document.getElementById("cam-count").textContent = `${DATA.items.length} 张`;
  const film = document.getElementById("cam-film");
  if (!film.children.length) for (let i = 0; i < 28; i++) film.append(h("i"));

  if (active === "ai-archive") {
    grid.replaceChildren();
    extra.replaceChildren(h("div", { class: "empty", style: "margin-bottom:34px" },
      h("h3", {}, "造梦者泡泡机 · 已归档"),
      h("p", {}, DATA.aiArchiveNotice || ""),
      h("p", {}, h("a", { class: "pill", href: "fanworks.html", style: "display:inline-block;margin-top:14px" }, "去看看二创区的真人作品 →"))));
    return;
  }
  extra.replaceChildren();
  const items = DATA.items.filter((i) => i.category === active);
  if (!items.length) {
    grid.replaceChildren(h("div", { class: "empty", style: "columns:auto;break-inside:auto" },
      h("h3", {}, active === "photo" ? "镜头还盖着盖子" : "这一册还空着"),
      h("p", {}, active === "photo"
        ? "游戏内摄影与镜头里的她，还没有人夹进来。第一张会由你放上吗？"
        : "还没有作品。"),
      h("p", {}, h("a", { class: "pill", href: "fanworks.html#manager", style: "display:inline-block;margin-top:12px" }, "投稿 / 收录入口 →"))));
    return;
  }
  grid.replaceChildren(items.map((it, idx) =>
    h("figure", { class: "gal-item" },
      h("img", {
        src: asset(it.src), alt: `${it.title} —— ${it.artist}`, loading: "lazy",
        onclick: () => openLightbox(items, idx)
      }),
      h("figcaption", { class: "gal-cap" },
        h("div", {},
          h("strong", {}, it.title),
          h("span", { class: "artist" }, it.artist),
          it.sourceUrl ? h("a", { class: "gal-src", href: it.sourceUrl, target: "_blank", rel: "noopener noreferrer" },
            h("span", { html: icon("external", 11) }), "原作链接") : null),
        h("span", { class: "gal-badge" + (active === "photo" ? "" : ""), title: "真人绘制承诺" },
          h("span", { html: icon(active === "photo" ? "camera" : "brush", 11) }),
          active === "photo" ? "游戏内摄影" : "真人绘制"))))
  );
}

function openLightbox(items, idx) {
  let i = idx;
  const img = h("img", { alt: "" });
  const cap = h("figcaption", { class: "lb-cap" });
  const figure = h("figure", { class: "lb-figure" }, img, cap);
  const prev = h("button", { class: "lb-btn lb-prev", "aria-label": "上一张", html: icon("arrow", 20), onclick: () => show(i - 1) });
  const next = h("button", { class: "lb-btn lb-next", "aria-label": "下一张", html: icon("arrow", 20), onclick: () => show(i + 1) });
  const close = h("button", { class: "lb-btn lb-close", "aria-label": "关闭", html: icon("x", 20), onclick: () => dlg.close() });
  prev.style.transform = "translateY(-50%) rotate(-135deg)";
  next.style.transform = "translateY(-50%) rotate(45deg)";
  const dlg = h("dialog", { class: "lightbox" },
    h("div", { class: "lb-wrap", onclick: (e) => { if (e.target === e.currentTarget) dlg.close(); } }, figure), prev, next, close);
  img.addEventListener("click", () => img.classList.toggle("zoomed"));
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(i + 1);
    if (e.key === "ArrowLeft") show(i - 1);
  });
  function show(n) {
    i = (n + items.length) % items.length;
    const it = items[i];
    img.classList.remove("zoomed");
    img.src = asset(it.full || it.src);
    img.alt = `${it.title} —— ${it.artist}`;
    cap.replaceChildren(
      h("strong", {}, it.title),
      h("span", {}, it.artist, it.source ? ` · ${it.source}` : ""),
      it.note ? h("span", {}, it.note) : null,
      it.sourceUrl ? h("span", {}, h("a", { href: it.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "查看原作 →")) : null);
  }
  show(i);
  document.body.append(dlg);
  dlg.showModal();
}

(async () => {
  await API.probe();
  try { DATA = await API.gallery(); } catch { /* 保持空 */ }
  document.getElementById("pledge").replaceChildren(h("span", { html: icon("brush", 16) }), h("span", {}, DATA.pledge || ""));
  render();
})();
