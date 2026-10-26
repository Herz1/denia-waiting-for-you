import { API } from "./api.js";
import { h, icon, toast, bindStatusBadge } from "./ui.js";
import { createPet } from "./pet.js";

/* 图标注入 */
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, el.classList.contains("portal-icon") ? 22 : el.classList.contains("portal-arrow") ? 18 : 15);
});

/* 漂浮泡泡背景 */
(function bubbles() {
  const root = document.getElementById("bubbles");
  for (let i = 0; i < 14; i++) {
    const b = h("i");
    const size = 12 + Math.random() * 60;
    b.style.width = b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 16 + Math.random() * 22 + "s";
    b.style.animationDelay = -Math.random() * 30 + "s";
    b.style.opacity = String(0.25 + Math.random() * 0.4);
    root.append(b);
  }
})();

bindStatusBadge(document.getElementById("status"));

/* 蛋糕架 */
const shelf = document.getElementById("cake-shelf");
const chip = document.getElementById("cake-chip");
function renderCakes({ total, today }) {
  chip.innerHTML = icon("cake", 13) + ` 蛋糕 × ${total}`;
  shelf.replaceChildren(
    h("span", {}, "今日蛋糕架"),
    h("span", { class: "cakes", "aria-hidden": "true" },
      ...Array.from({ length: Math.min(today, 12) }, () => h("i"))),
    h("span", {}, today > 12 ? `+${today - 12}` : ""),
    h("span", { style: "opacity:.75" }, `今日 ${today} · 累计 ${total}`)
  );
}

/* 天数 */
function countUp(el, to) {
  const t0 = performance.now(), dur = 1200;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const pet = createPet({ mount: document.getElementById("pet-stage"), mode: "mini" });

document.getElementById("cake-button").addEventListener("click", async () => {
  const r = await pet.feedCake();
  toast(`蛋糕已上架 · 累计 ${r.total} 块`);
});
document.addEventListener("denia:cakes", (e) => renderCakes(e.detail));

(async () => {
  await API.probe();
  const st = await API.state();
  window.DeniaDay = st.day;
  countUp(document.getElementById("day-count"), st.day);
  renderCakes(st.cakes);
})();
