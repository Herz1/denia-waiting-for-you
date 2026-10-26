import { API, asset } from "./api.js";
import { h, icon, toast, bindStatusBadge } from "./ui.js";
import { createPet, createChat, createBubbleGame } from "./pet.js";

document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, 15);
});
(function bubbles() {
  const root = document.getElementById("bubbles");
  for (let i = 0; i < 12; i++) {
    const b = h("i");
    const size = 12 + Math.random() * 54;
    b.style.width = b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 16 + Math.random() * 22 + "s";
    b.style.animationDelay = -Math.random() * 30 + "s";
    root.append(b);
  }
})();
bindStatusBadge(document.getElementById("status"));

const stage = document.getElementById("pet-stage");
const pet = createPet({ mount: stage, mode: "full" });
const game = createBubbleGame({ mount: stage, getTrivia: () => window.__trivia });

let stickers = [];
let chat = null;
function openChat() {
  if (!chat) {
    chat = createChat({ mount: document.body, pet, stickers });
    document.getElementById("act-chat").setAttribute("aria-pressed", "true");
  }
  chat.panel.classList.remove("collapsed");
  chat.panel.querySelector("input")?.focus();
}

document.getElementById("act-chat").addEventListener("click", openChat);
document.getElementById("act-cake").addEventListener("click", async () => {
  const r = await pet.feedCake();
  toast(`蛋糕已上架 · 累计 ${r.total} 块`);
});
document.getElementById("act-bubble").addEventListener("click", () => game.blow());
document.getElementById("act-pat").addEventListener("click", () => pet.petPat());

const aff = document.getElementById("affection");
function renderAffection() { aff.innerHTML = icon("heart", 13) + ` 好感 ${pet.state.affection}`; }
document.addEventListener("denia:affection", renderAffection);
renderAffection();

const chip = document.getElementById("cake-chip");
function renderChip(c) { chip.innerHTML = icon("cake", 13) + ` 蛋糕 × ${c.total}`; }
document.addEventListener("denia:cakes", (e) => renderChip(e.detail));

(async () => {
  await API.probe();
  const [st, gal, trivia] = await Promise.all([API.state(), API.gallery().catch(() => ({ items: [] })), API.trivia().catch(() => [])]);
  window.DeniaDay = st.day;
  window.__trivia = trivia;
  renderChip(st.cakes);
  stickers = (gal.items || []).filter((i) => i.category === "drawing").slice(0, 5).map((i) => ({ src: asset(i.src), title: i.title }));
  document.getElementById("stickers-note").textContent =
    `聊天框点「表情」发送 ${stickers.length} 枚小表情（${stickers.map((s) => s.title).join("／")}）；也支持粘贴（Ctrl/⌘+V）或拖入图片给她看。`;
  if (location.hash === "#stickers") openChat();
})();
