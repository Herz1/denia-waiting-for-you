/**
 * 网页桌宠 · 娅娅
 * - 立绘全部取自真人绘制的同人图（见 data/gallery.seed.json），按心情裁切面部
 * - 交互：拖拽（带抛掷惯性）、点击摸摸头、喂蛋糕、长时间不理她会睡着、深夜自动睡觉
 * - 完整模式追加：聊天面板、表情包、贴图、吹泡泡小游戏
 */
import { h, icon, toast } from "./ui.js";
import { API, asset } from "./api.js";
import { REACTIONS, pick, extractName } from "./chat-engine.js";

export const PET_ART_RAW = {
  idle:   { src: "assets/art/wink.webp",          crop: "50% 16%", label: "清醒" },
  happy:  { src: "assets/art/fan-minglu.webp",    crop: "40% 12%", label: "开心" },
  sleep:  { src: "assets/art/hero-sleep.webp",    crop: "24% 34%", label: "睡觉" },
  cheeky: { src: "assets/art/fan-hirohenuri.png", crop: "66% 26%", label: "坏笑" },
  love:   { src: "assets/art/fan-stardust.webp",  crop: "52% 14%", label: "喜欢" }
};
export const PET_ART = Object.fromEntries(Object.entries(PET_ART_RAW).map(([k, v]) => [k, { ...v, src: asset(v.src) }]));

const NIGHT_START = 23, NIGHT_END = 6;
const isNight = () => { const hr = new Date().getHours(); return hr >= NIGHT_START || hr < NIGHT_END; };

export function createPet({ mount, mode = "full", homeHref = "./" } = {}) {
  const memo = API.memo.load();
  const state = {
    mood: isNight() ? "sleep" : "idle",
    affection: memo.affection || 0,
    pets: memo.pets || 0,
    asleep: isNight(),
    dragging: false,
    lastTouch: Date.now(),
    x: 0, y: 0, vx: 0, vy: 0
  };

  /* ---------- DOM ---------- */
  const img = h("img", { alt: "桌宠娅娅的表情（真人绘制同人图裁切）", src: PET_ART[state.mood].src, draggable: "false" });
  const ring = h("span", { class: "pet-ring", "aria-hidden": "true" });
  const zzz = h("span", { class: "pet-zzz", "aria-hidden": "true" }, "z Z");
  const avatar = h("div", { class: "pet-avatar" }, ring, img, zzz);
  const bubble = h("div", { class: "pet-bubble", role: "status", "aria-live": "polite" });
  const tag = h("span", { class: "pet-tag" }, "娅娅 · ", h("b", { class: "pet-mood" }, PET_ART[state.mood].label));
  const shadow = h("span", { class: "pet-shadow", "aria-hidden": "true" });
  const el = h("div", { class: `pet pet-${mode}`, tabindex: "0", role: "button", "aria-label": "桌宠娅娅：可以拖动、点击摸摸头" }, avatar, bubble, tag, shadow);
  mount.append(el);

  let bubbleTimer = 0;
  function speak(text, mood) {
    if (mood) setMood(mood);
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), Math.min(9000, 2600 + text.length * 90));
    state.lastTouch = Date.now();
  }
  function setMood(mood) {
    if (!PET_ART[mood]) return;
    state.mood = mood;
    state.asleep = mood === "sleep";
    img.src = PET_ART[mood].src;
    img.style.objectPosition = PET_ART[mood].crop;
    el.dataset.mood = mood;
    tag.querySelector(".pet-mood").textContent = PET_ART[mood].label;
  }
  function save() { API.memo.save({ ...API.memo.load(), affection: state.affection, pets: state.pets }); }

  /* ---------- 粒子 ---------- */
  function burst(kind = "heart", n = 5) {
    for (let i = 0; i < n; i++) {
      const p = h("span", { class: "pet-particle pet-p-" + kind, "aria-hidden": "true" });
      p.style.setProperty("--dx", (Math.random() * 90 - 45) + "px");
      p.style.setProperty("--dy", -(40 + Math.random() * 70) + "px");
      p.style.setProperty("--r", (Math.random() * 60 - 30) + "deg");
      p.style.animationDelay = (i * 70) + "ms";
      el.append(p);
      setTimeout(() => p.remove(), 1600);
    }
  }

  /* ---------- 交互：摸 / 拖 ---------- */
  let pointer = null, moved = false, downAt = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: state.x, oy: state.y, t: Date.now() };
    moved = false; downAt = Date.now();
    el.setPointerCapture(e.pointerId);
    state.dragging = true;
    el.classList.add("grab");
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) {
      state.vx = dx * 0.35; state.vy = dy * 0.35;
      place(state.x + dx, state.y + dy);
      pointer.x = e.clientX; pointer.y = e.clientY;
    }
  });
  const release = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pointer = null;
    state.dragging = false;
    el.classList.remove("grab");
    if (!moved && Date.now() - downAt < 600) petPat();
    else if (moved) {
      speak(pick(REACTIONS.drop), state.asleep ? "idle" : undefined);
      if (state.asleep) wake();
      coast();
    }
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);

  function place(x, y) {
    const r = mount.getBoundingClientRect(), pr = el.getBoundingClientRect();
    const maxX = r.width - pr.width - 4, maxY = r.height - pr.height - 4;
    state.x = Math.max(2, Math.min(maxX, x));
    state.y = Math.max(2, Math.min(maxY, y));
    el.style.transform = `translate(${state.x}px, ${state.y}px)`;
  }
  /** 抛掷惯性 */
  function coast() {
    const step = () => {
      if (state.dragging) return;
      state.vx *= 0.9; state.vy *= 0.9;
      if (Math.abs(state.vx) + Math.abs(state.vy) < 0.4) return;
      place(state.x + state.vx, state.y + state.vy);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function petPat() {
    state.pets += 1;
    state.affection += 1;
    save();
    burst("heart", 4);
    if (state.asleep) { wake(); return; }
    setMood(Math.random() < 0.35 ? "love" : "happy");
    speak(pick(REACTIONS.pet));
    setTimeout(() => !state.asleep && setMood("idle"), 4200);
    document.dispatchEvent(new CustomEvent("denia:affection", { detail: state.affection }));
  }
  function wake() {
    setMood("idle");
    burst("sparkle", 4);
    speak(pick(REACTIONS.sleepWake));
  }

  async function feedCake() {
    const r = await API.leaveCake();
    burst("cake", 6);
    if (state.asleep) wake(); else setMood("love");
    speak((r.line || pick(REACTIONS.cake)).replaceAll("{cakes}", String(r.total)));
    document.dispatchEvent(new CustomEvent("denia:cakes", { detail: r }));
    return r;
  }

  /* ---------- 行为循环：打盹 / 散步 ---------- */
  setInterval(() => {
    if (state.dragging) return;
    const idleFor = Date.now() - state.lastTouch;
    if (!state.asleep && (isNight() || idleFor > 75000)) {
      setMood("sleep");
      speak("……唔，等你回来我再醒。蛋糕架我抱着。");
    } else if (state.asleep && !isNight() && idleFor < 4000) {
      wake();
    } else if (!state.asleep && mode === "full" && idleFor > 18000 && Math.random() < 0.5) {
      // 小范围散步
      const r = mount.getBoundingClientRect(), pr = el.getBoundingClientRect();
      const nx = state.x + (Math.random() * 160 - 80);
      place(nx, state.y);
      el.classList.add("step");
      setTimeout(() => el.classList.remove("step"), 1200);
      void r; void pr;
    }
  }, 6000);

  /* 初始位置：右下区域 */
  requestAnimationFrame(() => {
    const r = mount.getBoundingClientRect(), pr = el.getBoundingClientRect();
    place(r.width * 0.62, Math.max(8, r.height - pr.height - 24));
  });

  setTimeout(() => speak(mode === "mini" ? "拖动我 · 停留摸摸头" : "嗨，我是娅娅。拖我、摸我、或者和我聊天都可以。"), 900);

  return { el, state, speak, setMood, burst, feedCake, petPat, wake };
}

/* ================= 聊天面板（完整模式） ================= */
export function createChat({ mount, pet, stickers }) {
  const list = h("div", { class: "chat-list", role: "log", "aria-live": "polite" });
  const input = h("input", { type: "text", placeholder: "把小小的日常，慢慢说给她听。", maxlength: "300", "aria-label": "和娅娅说的话" });
  const sendBtn = h("button", { class: "chat-send", "aria-label": "发送", html: icon("send", 17) });
  const stickerBtn = h("button", { class: "chat-tool", "aria-label": "表情包", html: icon("smile", 17) });
  const imgBtn = h("button", { class: "chat-tool", "aria-label": "添加图片", html: icon("image", 17) });
  const fileInput = h("input", { type: "file", accept: "image/*", hidden: true });
  const tray = h("div", { class: "chat-stickers", hidden: true });
  const form = h("form", { class: "chat-form" }, stickerBtn, imgBtn, fileInput, input, sendBtn);
  const panel = h("section", { class: "chat-panel", "aria-label": "和娅娅聊天" },
    h("header", { class: "chat-head" },
      h("strong", {}, "和娅娅聊天"),
      h("span", { class: "chat-sub" }, "今天 · 一起待一会儿"),
      h("button", { class: "chat-collapse", "aria-label": "收起聊天", html: icon("x", 16) })
    ),
    list, tray, form);
  mount.append(panel);

  const memo = API.memo.load();
  const ctx = () => ({ name: memo.userName || "", day: window.DeniaDay ?? 0 });

  function addMsg(who, node) {
    const row = h("div", { class: "msg msg-" + who }, node);
    list.append(row);
    list.scrollTop = list.scrollHeight;
    return row;
  }
  const typing = () => {
    const t = h("div", { class: "msg msg-pet typing" }, h("span", {}, h("i"), h("i"), h("i")));
    list.append(t); list.scrollTop = list.scrollHeight;
    return t;
  };

  async function send(text, attach) {
    if (!text && !attach) return;
    const body = h("div", { class: "msg-body" });
    if (attach) body.append(h("img", { src: attach, alt: "你发送的图片", class: "msg-img" }));
    if (text) body.append(h("p", {}, text));
    addMsg("user", body);
    input.value = "";
    const t = typing();
    const r = await API.chat(text || "[图片]", ctx());
    setTimeout(() => {
      t.remove();
      if (r.action === "remember-name") {
        const n = extractName(text);
        if (n) { memo.userName = n; API.memo.save(memo); }
      }
      if (r.mood) pet.setMood(r.mood);
      addMsg("pet", h("div", { class: "msg-body" }, h("p", {}, r.text)));
      if (attach) { pet.burst("sparkle", 5); setTimeout(() => addMsg("pet", h("div", { class: "msg-body" }, h("p", {}, pick(REACTIONS.image)))), 700); }
      if (r.action === "offer-cake") pet.burst("cake", 4);
      if (r.action === "bubble") document.dispatchEvent(new CustomEvent("denia:blow"));
    }, 500 + Math.random() * 700);
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value.trim()); });

  /* 表情包 */
  stickers.forEach((s) => {
    tray.append(h("button", { class: "sticker", title: s.title, onclick: () => { tray.hidden = true; send("", s.src); petSpeakSticker(s); } },
      h("img", { src: s.src, alt: s.title, loading: "lazy" })));
  });
  function petSpeakSticker(s) { pet.speak(`这一枚是「${s.title}」……轻一点用哦。`, "cheeky"); }
  stickerBtn.addEventListener("click", () => { tray.hidden = !tray.hidden; });

  /* 图片：按钮 / 粘贴 / 拖入 */
  const readFile = (file) => {
    if (!file || !file.type?.startsWith("image/")) return toast("只吃得下图片哦。", "warn");
    if (file.size > 4 * 1024 * 1024) return toast("图片太大啦（4 MiB 以内）。", "warn");
    const reader = new FileReader();
    reader.onload = () => send("", reader.result);
    reader.readAsDataURL(file);
  };
  imgBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => readFile(fileInput.files[0]));
  panel.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])][0]; if (f) { e.preventDefault(); readFile(f); } });
  panel.addEventListener("dragover", (e) => { e.preventDefault(); panel.classList.add("dragover"); });
  panel.addEventListener("dragleave", () => panel.classList.remove("dragover"));
  panel.addEventListener("drop", (e) => { e.preventDefault(); panel.classList.remove("dragover"); readFile(e.dataTransfer?.files?.[0]); });

  panel.querySelector(".chat-collapse").addEventListener("click", () => {
    panel.classList.toggle("collapsed");
  });

  addMsg("pet", h("div", { class: "msg-body" }, h("p", {}, "把小小的日常，慢慢说给她听。我在听。")));
  return { panel, send, addMsg };
}

/* ================= 吹泡泡小游戏 ================= */
export function createBubbleGame({ mount, getTrivia }) {
  const field = h("div", { class: "bubble-field", "aria-hidden": "false" });
  mount.append(field);
  let combo = 0;
  function blow() {
    if (field.children.length > 8) return;
    const b = h("button", { class: "game-bubble", "aria-label": "戳破泡泡" });
    const size = 46 + Math.random() * 60;
    b.style.width = b.style.height = size + "px";
    b.style.left = (6 + Math.random() * 84) + "%";
    b.style.animationDuration = (9 + Math.random() * 7) + "s";
    b.addEventListener("click", () => {
      combo += 1;
      const trivia = pick(getTrivia() || ["泡泡里什么也没有，但很好看。"]);
      b.classList.add("pop");
      setTimeout(() => b.remove(), 320);
      toast(`#${combo} 泡泡碎屑：${trivia}`);
      document.dispatchEvent(new CustomEvent("denia:bubblepop", { detail: combo }));
    });
    b.addEventListener("animationend", () => { combo = 0; b.remove(); });
    field.append(b);
  }
  document.addEventListener("denia:blow", blow);
  return { blow, field };
}
