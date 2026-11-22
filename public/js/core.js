/* core.js — state, penyimpanan, dan helper UI bersama */

const LS_KEY = "auralys.v1";

export const DEFAULT_SETTINGS = {
  /* Suara dan pemutaran — Pemutar */
  kualitasAudio: "Otomatis",
  modeHematData: false,
  crossfade: false,
  durasiRiwayat: 30,
  lewatiKeheningan: false,
  lewatiKeheninganSeketika: false,
  normalisasiAudio: true,
  tingkatKelantangan: "Agresif (-7 dB)",
  aktifkanAudioOffload: false,
  aktifkanVarispeed: false,
  /* Antrean */
  aktifkanKontenSerupa: false,
  pertahankanAcak: false,
  ingatStatusAcakUlang: true,
  acakPlaylistDahulu: false,
  cegahLaguSama: false,
  lewatiOtomatisKesalahan: false,
  /* Lainnya */
  hentikanSaatDitutup: false,
  jedaSaatDibisukan: false,
  lanjutkanBluetooth: false,
  jagaLayarMenyala: false,
  sampulAnimasi: false,
  modeVideo: true,
  putarVideoOtomatis: true,
  /* Tampilan */
  desainMiniPlayerBaru: true,
  gayaMiniPlayer: "Ikuti tema",
  desainPemutarBaru: true,
  gayaPemutar: "Ikuti tema",
  sembunyikanThumbnail: false,
  sampulLayarPenuh: true,
  pangkasSampulAlbum: true,
  warnaTombolPemutar: "Bawaan",
  gayaSlider: "Bawaan",
  geserGantiLagu: true,
  sensitivitasGeser: 73,
  lirikEksperimental: true,
  tema: "ikuti sistem",
  /* Konten */
  bahasaKonten: "Bawaan sistem",
  negaraKonten: "Bawaan sistem",
  sembunyikanEksplisit: false,
  sembunyikanVideoMusik: false,
  sembunyikanVideoPencarian: true,
  utamakanVersiAudio: true,
  sembunyikanShorts: false,
  posisiPlaylist: "Awal playlist",
  tampilkanDeskripsiArtis: true,
  tampilkanPelanggan: true,
  tampilkanPendengarBulanan: true,
  bahasaAplikasi: "Indonesia",
  terjemahanLirik: true,
  /* Akun */
  namaAkun: "Bukan Bukan",
  sinkronOtomatis: true,
  /* Android Auto */
  autoSections: [
    { id: "disukai", label: "Lagu yang disukai", on: false },
    { id: "lagu", label: "Lagu", on: false },
    { id: "artis", label: "Artis", on: false },
    { id: "album", label: "Album", on: false },
    { id: "playlist", label: "Playlist", on: false },
  ],
  tujuanTambahCepat: "Belum diatur",
  tampilkanPlaylistYouTube: false,
  batasPencarianMusik: 75,
  /* Privasi */
  simpanRiwayat: true,
  jedaRiwayatPlaylist: false,
  /* Penyimpanan */
  kualitasUnduhan: "Otomatis (disarankan)",
  unduhViaWifi: true,
  /* pemutar */
  volume: 100,
  kecepatan: 1,
};

const DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  liked: [],
  history: [],
  recentSearches: [],
  playlists: [],
  cached: [],
  downloads: [],
  uploaded: [],
  lastTrack: null,
  topCount: {},
};

function deepMerge(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k in extra) {
    const v = extra[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else out[k] = v;
  }
  return out;
}

let data = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return deepMerge(structuredClone(DEFAULT_STATE), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
})();

export const S = data;

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {}
  }, 120);
}
export function resetAll() {
  data = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(LS_KEY);
  location.reload();
}
export function exportData() {
  return JSON.stringify(data, null, 2);
}
export function importData(text) {
  const parsed = JSON.parse(text);
  data = deepMerge(structuredClone(DEFAULT_STATE), parsed);
  save();
}

/* ------------------------------- event bus ------------------------------ */
const bus = new EventTarget();
export const on = (evt, fn) => bus.addEventListener(evt, (e) => fn(e.detail));
export const emit = (evt, detail) => bus.dispatchEvent(new CustomEvent(evt, { detail }));

/* --------------------------------- utils -------------------------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const uid = () => Math.random().toString(36).slice(2, 10);

export function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return "--:--";
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
export function parseDur(str) {
  if (!str) return 0;
  const p = String(str).split(":").map(Number);
  if (p.some(isNaN)) return 0;
  return p.reduce((a, b) => a * 60 + b, 0);
}
export function timeGreeting() {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 19) return "Selamat sore";
  return "Selamat malam";
}
export function art(url, size = 300) {
  if (!url) return placeholderArt();
  return url.replace(/=w\d+-h\d+.*$/, `=w${size}-h${size}-l90-rj`);
}
export function placeholderArt() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e6e6ea"/><g fill="none" stroke="#b7b7bf" stroke-width="4"><circle cx="100" cy="100" r="46"/><circle cx="100" cy="100" r="24"/></g><circle cx="100" cy="100" r="6" fill="#b7b7bf"/></svg>`
  );
}

/* --------------------------------- toast -------------------------------- */
export function toast(msg, ms = 2200) {
  const host = $("#toast-host");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ---------------------------- bottom sheet API --------------------------- */
let sheetEls = null;
export function openSheet(title, items, { head = null } = {}) {
  closeSheet();
  const host = $("#sheet-host");
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `
    <div class="grabber"></div>
    ${title ? `<h3>${esc(title)}</h3>` : ""}
    ${head || ""}
    <div class="sheet-body">
      ${items
        .map(
          (it, i) =>
            `<button class="sheet-item ${it.danger ? "danger" : ""}" data-i="${i}">${
              it.icon ? window.icon(it.icon, 21) : ""
            }<span class="grow">${esc(it.label)}</span>${it.check ? window.icon("check", 20) : ""}</button>`
        )
        .join("")}
    </div>`;
  host.appendChild(backdrop);
  host.appendChild(sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add("show");
    sheet.classList.add("show");
  });
  const close = () => closeSheet();
  backdrop.addEventListener("click", close);
  sheet.addEventListener("click", (e) => {
    const b = e.target.closest(".sheet-item");
    if (!b) return;
    const it = items[+b.dataset.i];
    closeSheet();
    setTimeout(() => it.onClick?.(), 120);
  });
  sheetEls = { backdrop, sheet };
}
export function closeSheet() {
  if (!sheetEls) return;
  const { backdrop, sheet } = sheetEls;
  sheetEls = null;
  sheet.classList.remove("show");
  backdrop.classList.remove("show");
  setTimeout(() => {
    sheet.remove();
    backdrop.remove();
  }, 300);
}

/* -------------------------- context menu (aksi lagu) -------------------- */
export function openMenu(track, actions, { head = true } = {}) {
  const host = $("#menu-host");
  host.innerHTML = "";
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.innerHTML = `
    ${head ? `<div class="menu-head">
      <img src="${esc(art(track.thumb, 100))}" alt="" />
      <div><div class="t">${esc(track.title || track.name || "Tanpa judul")}</div>
      <div class="s">${esc(track.subtitle || track.artists?.join(", ") || "")}</div></div>
    </div>` : ""}
    ${actions
      .map(
        (a, i) =>
          `<button class="sheet-item ${a.danger ? "danger" : ""}" data-i="${i}">${
            a.icon ? window.icon(a.icon, 21) : ""
          }<span class="grow">${esc(a.label)}</span></button>`
      )
      .join("")}`;
  host.appendChild(backdrop);
  host.appendChild(menu);
  requestAnimationFrame(() => {
    backdrop.classList.add("show");
    menu.classList.add("show");
  });
  const close = () => {
    menu.classList.remove("show");
    backdrop.classList.remove("show");
    setTimeout(() => (host.innerHTML = ""), 300);
  };
  backdrop.addEventListener("click", close);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest(".sheet-item");
    if (!b) return;
    close();
    setTimeout(() => actions[+b.dataset.i].onClick?.(), 120);
  });
}

/* ----------------------------- confirm dialog --------------------------- */
export function confirmSheet(title, message, confirmLabel, onYes, danger = false) {
  openSheet(title, [
    { label: confirmLabel, icon: danger ? "trash" : "check", danger, onClick: onYes },
    { label: "Batal", icon: "close", onClick: () => {} },
  ], { head: `<div class="pad" style="padding:0 20px 12px;color:var(--text-2);font-size:13.5px">${esc(message)}</div>` });
}

/* ------------------------------ theme apply ----------------------------- */
export function applyTheme() {
  const t = S.settings.tema;
  let mode = t;
  if (t === "ikuti sistem" || !t) {
    mode = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "gelap" : "terang";
  }
  const map = { terang: "light", gelap: "dark", hitam: "black" };
  document.documentElement.dataset.theme = map[mode] || "light";
  const bg = map[mode] === "light" ? "#f5f5f6" : "#0c0c0e";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (S.settings.tema === "ikuti sistem") applyTheme();
});

/* --------------------------------- model -------------------------------- */
export function isLiked(track) {
  if (!track) return false;
  const id = track.videoId || track.id;
  return S.liked.some((t) => (t.videoId || t.id) === id);
}
export function toggleLike(track) {
  if (!track) return false;
  const id = track.videoId || track.id;
  const i = S.liked.findIndex((t) => (t.videoId || t.id) === id);
  if (i >= 0) {
    S.liked.splice(i, 1);
    save();
    emit("liked", { track, liked: false });
    toast("Dihapus dari Lagu yang disukai");
    return false;
  }
  S.liked.unshift({ ...track, likedAt: Date.now() });
  save();
  emit("liked", { track, liked: true });
  toast("Ditambahkan ke Lagu yang disukai");
  return true;
}
export function addHistory(track) {
  if (!S.settings.simpanRiwayat) return;
  const id = track.videoId || track.id;
  S.history = [{ ...track, playedAt: Date.now() }, ...S.history.filter((t) => (t.videoId || t.id) !== id)].slice(0, 200);
  S.lastTrack = track;
  if (track.artistId) S.topCount[track.artistId] = (S.topCount[track.artistId] || 0) + 1;
  save();
}
export function addRecentSearch(q) {
  q = q.trim();
  if (!q) return;
  S.recentSearches = [q, ...S.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
  save();
}
export function createPlaylist(name, tracks = []) {
  const pl = { id: "pl_" + uid(), name, tracks, createdAt: Date.now() };
  S.playlists.unshift(pl);
  save();
  emit("playlists", S.playlists);
  return pl;
}
export function addToPlaylist(plId, track) {
  const pl = S.playlists.find((p) => p.id === plId);
  if (!pl) return;
  const id = track.videoId || track.id;
  if (pl.tracks.some((t) => (t.videoId || t.id) === id)) return toast("Lagu sudah ada di playlist");
  if (S.settings.posisiPlaylist === "Awal playlist") pl.tracks.unshift(track);
  else pl.tracks.push(track);
  save();
  toast(`Ditambahkan ke ${pl.name}`);
}
export function trackKey(t) {
  return t?.videoId || t?.id || "";
}
