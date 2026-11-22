/* ui.js — potongan HTML yang dipakai di banyak halaman */
import { art, esc, isLiked } from "./core.js";

export function cardHTML(item, { showPlay = false, round = false } = {}) {
  const cls = ["card", round || item.type === "artist" ? "artist round" : "", showPlay ? "show-play" : ""].join(" ");
  return `<div class="${cls}" data-card="${esc(item.id)}" data-vid="${esc(item.videoId || "")}" data-type="${esc(item.type || "song")}" data-browse="${esc(item.browseId || "")}">
    <div class="art"><img loading="lazy" src="${esc(art(item.thumb, 300))}" alt="" />
      <div class="play-badge">${window.icon("play", 18)}</div>
    </div>
    <div class="meta"><div class="t">${esc(item.title || "")}</div><div class="s">${esc(item.subtitle || (item.artists || []).join(", ") || "")}</div></div>
  </div>`;
}

export function rowHTML(item, { index = null, playing = false, rounded = false, showDur = true, eq = false } = {}) {
  const sub = item.subtitle || (item.artists || []).join(", ") || "";
  return `<div class="row ${playing ? "playing" : ""}" data-row="${esc(item.id)}" data-vid="${esc(item.videoId || "")}" data-idx="${index ?? ""}">
    ${index != null ? `<span style="width:16px;color:var(--text-3);font-size:12px;text-align:right;flex:0 0 auto">${eq ? `<span class="eq"><i></i><i></i><i></i></span>` : index + 1}</span>` : ""}
    <div class="thumb ${rounded ? "round" : ""}"><img loading="lazy" src="${esc(art(item.thumb, 100))}" alt="" /></div>
    <div class="info">
      <div class="t">${esc(item.title || "")}${item.explicit ? ' <span class="ex">E</span>' : ""}</div>
      <div class="s">${esc(sub)}</div>
    </div>
    ${showDur && item.duration ? `<span style="font-size:12px;color:var(--text-3);flex:0 0 auto">${esc(item.duration)}</span>` : ""}
    <button class="dots" data-dots="${esc(item.id)}">${window.icon("dots", 20)}</button>
  </div>`;
}

export function sectionTitleHTML(title, { more = null, label = null, id = "" } = {}) {
  return `<div class="section-title" ${id ? `data-title-id="${esc(id)}"` : ""}>
    <div>${label ? `<div class="label">${esc(label)}</div>` : ""}<h2>${esc(title)}</h2></div>
    ${more ? `<button class="more" data-more="${esc(more)}">${esc(more === "putar" ? "Putar semua" : "Lihat semua")}</button>` : ""}
  </div>`;
}

export function carouselHTML(items, opts = {}) {
  return `<div class="carousel ${opts.wide ? "wide" : ""}">${items
    .map((it) => cardHTML(it, opts))
    .join("")}</div>`;
}

export function skeletonRows(n = 6) {
  return `<div class="loading-rows">${Array.from({ length: n })
    .map(() => `<div class="r"><div class="sk"></div><div class="col"><div class="sk"></div><div class="sk"></div></div></div>`)
    .join("")}</div>`;
}

export function skeletonCarousel(n = 4) {
  return `<div class="carousel">${Array.from({ length: n })
    .map(() => `<div class="card"><div class="art sk" style="border-radius:12px"></div><div class="sk" style="height:12px;width:80%;margin-top:10px"></div><div class="sk" style="height:10px;width:50%;margin-top:6px"></div></div>`)
    .join("")}</div>`;
}

export function emptyHTML({ icon = "music", title, text }) {
  return `<div class="empty"><div style="color:var(--text-3)">${window.icon(icon, 54)}</div>
    <h3>${esc(title)}</h3><p>${esc(text || "")}</p></div>`;
}

export function errorHTML(message) {
  return `<div class="error-box"><b>Tidak dapat memuat data.</b><br>${esc(message)}<br><br>
    Periksa koneksi internet, lalu muat ulang halaman.</div>`;
}

export function bindCards(root, onOpen, onPlay) {
  root.querySelectorAll("[data-card]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const badge = e.target.closest(".play-badge");
      const data = { id: el.dataset.card, videoId: el.dataset.vid, type: el.dataset.type, browseId: el.dataset.browse };
      if (badge && onPlay) onPlay(data, el);
      else onOpen(data, el);
    });
  });
}

export function bindRows(root, items, { onPlay, onDots }) {
  root.querySelectorAll(".row").forEach((el) => {
    const i = +el.dataset.idx;
    const item = items[i];
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-dots]")) return;
      onPlay?.(item, i);
    });
    el.querySelector("[data-dots]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      onDots?.(item, i, el);
    });
  });
}
