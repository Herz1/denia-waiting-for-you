import { API, asset } from "./api.js";
import { h, icon, bindStatusBadge } from "./ui.js";

document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon, 15)));
(function bubbles() {
  const root = document.getElementById("bubbles");
  for (let i = 0; i < 10; i++) {
    const b = h("i");
    const size = 10 + Math.random() * 44;
    b.style.width = b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 18 + Math.random() * 20 + "s";
    b.style.animationDelay = -Math.random() * 30 + "s";
    root.append(b);
  }
})();
bindStatusBadge(document.getElementById("status"));

const THUMBS = ["assets/art/wink.webp", "assets/art/fan-minglu.webp", "assets/art/fan-stardust.webp", "assets/art/fan-hirohenuri.png"];

(async () => {
  await API.probe();
  const { works } = await API.loadWorks();
  const vids = works.filter((w) => w.kind === "video");
  document.getElementById("picks").replaceChildren(...vids.map((w, i) =>
    h("article", { class: "card dv-card" },
      h("div", { class: "dv-thumb" },
        h("img", { src: asset(THUMBS[i % THUMBS.length]), alt: "", loading: "lazy" }),
        h("span", { class: "play", html: icon("video", 20) })),
      h("strong", {}, w.title),
      h("span", { class: "by" }, `UP主 · ${w.author || "见原投稿"}`),
      h("p", { class: "sum" }, w.summary),
      h("a", { class: "go", href: w.url, target: w.url.startsWith("./") ? "" : "_blank", rel: "noopener noreferrer" },
        "前往原投稿 ", h("span", { html: icon("external", 13) })))
  ));
})();
