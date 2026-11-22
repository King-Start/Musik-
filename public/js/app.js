/* app.js — router + kerangka aplikasi */
import { S, applyTheme, save, toast, esc } from "./core.js";
import { renderHome } from "./home.js";
import { renderSearch } from "./search.js";
import { renderBrowse } from "./browse.js";
import { renderLibrary, renderPlaylistPage } from "./library.js";
import {
  renderYou, renderAudio, renderAppearance, renderContent, renderLyricsSettings,
  renderPrivacy, renderStorage, renderBackup, renderAuto, renderLinks, renderAbout, renderAccount,
} from "./settings.js";
import { renderMini, restorePlayerPrefs, openFullPlayer, closeFullPlayer, isFullPlayerOpen, P } from "./player.js";

const view = document.getElementById("view");
const topbar = document.getElementById("topbar");
const tabbar = document.getElementById("tabbar");

applyTheme();
restorePlayerPrefs();

/* ------------------------------- navigation ----------------------------- */
const TAB_ROUTES = [
  { path: "/", label: "Beranda", icon: "home" },
  { path: "/search", label: "Cari", icon: "search" },
  { path: "/library", label: "Pustaka", icon: "library" },
  { path: "/you", label: "Kamu", icon: "user" },
];

let historyStack = [location.pathname + location.search];
let titleState = { text: "", hidden: false };

const nav = (path, { replace = false } = {}) => {
  if (replace) history.replaceState({}, "", path);
  else {
    history.pushState({}, "", path);
    historyStack.push(path);
  }
  render();
};
nav.setTitle = (text, hidden = false) => {
  titleState = { text, hidden: false };
  renderTopbar();
};

window.addEventListener("popstate", () => {
  if (isFullPlayerOpen()) {
    closeFullPlayer();
    return;
  }
  render();
});

function renderTopbar() {
  const path = location.pathname;
  const isTabRoot = TAB_ROUTES.some((t) => t.path === path);
  if (isTabRoot || titleState.hidden) {
    topbar.innerHTML = "";
    topbar.style.display = "none";
    return;
  }
  topbar.style.display = "flex";
  topbar.innerHTML = `<button class="icon-btn" id="tb-back">${window.icon("arrowLeft", 23)}</button>
    <h1 style="font-size:19px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(titleState.text || "")}</h1>
    <button class="icon-btn" id="tb-home">${window.icon("home", 21)}</button>`;
  document.getElementById("tb-back").onclick = () => {
    const cur = location.pathname + location.search;
    if (cur.startsWith("/browse/") || historyStack.length <= 1) {
      if (historyStack.length > 1) {
        historyStack.pop();
        return nav(historyStack[historyStack.length - 1], { replace: true });
      }
      return nav("/");
    }
    historyStack.pop();
    nav(historyStack[historyStack.length - 1] || "/", { replace: true });
  };
  document.getElementById("tb-home").onclick = () => {
    historyStack = ["/"];
    nav("/", { replace: true });
  };
}

function renderTabbar() {
  const path = location.pathname;
  const active = path === "/" ? "/" : path.startsWith("/search") ? "/search" : path.startsWith("/library") || path.startsWith("/playlist") ? "/library" : path.startsWith("/you") || path.startsWith("/settings") ? "/you" : "/";
  tabbar.innerHTML = TAB_ROUTES.map(
    (t) => `<button class="tab ${t.path === active ? "active" : ""}" data-tab="${t.path}">
      ${window.icon(t.path === active ? (t.icon === "home" ? "homeFill" : t.icon) : t.icon, 23)}
      <span>${t.label}</span></button>`
  ).join("");
  tabbar.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      historyStack = [b.dataset.tab];
      nav(b.dataset.tab, { replace: true });
    })
  );
}

/* --------------------------------- router ------------------------------- */
const SETTINGS_ROUTES = {
  "/settings/audio": renderAudio,
  "/settings/appearance": renderAppearance,
  "/settings/content": renderContent,
  "/settings/lyrics": renderLyricsSettings,
  "/settings/privacy": renderPrivacy,
  "/settings/storage": renderStorage,
  "/settings/backup": renderBackup,
  "/settings/auto": renderAuto,
  "/settings/links": renderLinks,
  "/settings/about": renderAbout,
  "/settings/account": renderAccount,
};

function render() {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  titleState = { text: "", hidden: false };

  view.innerHTML = "";
  view.scrollTop = 0;

  if (path === "/" || path === "") renderHomePage();
  else if (path === "/search") renderSearch(view, nav, params);
  else if (path === "/library") renderLibrary(view, nav);
  else if (path.startsWith("/library/")) renderLibrary(view, nav, path.split("/")[2]);
  else if (path.startsWith("/playlist/")) renderPlaylistPage(view, nav, path.split("/")[2]);
  else if (path.startsWith("/browse/")) renderBrowsePage(decodeURIComponent(path.split("/")[2]));
  else if (path === "/you") renderYouPage();
  else if (SETTINGS_ROUTES[path]) SETTINGS_ROUTES[path](view, nav);
  else renderHomePage();

  if (!titleState.text) {
    const map = {
      "/": "Beranda",
      "/search": "Cari",
      "/library": "Pustaka",
      "/you": "Kamu",
    };
    titleState = { text: map[path] || "", hidden: true };
  }
  renderTopbar();
  renderTabbar();
}

function renderHomePage() {
  renderHome(view, nav);
  nav.setTitle("", true);
}
function renderYouPage() {
  renderYou(view, nav);
}
function renderBrowsePage(id) {
  renderBrowse(view, nav, id);
  nav.setTitle("");
  // judul diisi setelah data datang; gunakan judul generik dulu
  const t = setInterval(() => {
    const h2 = view.querySelector(".hero h2");
    if (h2) {
      titleState = { text: h2.textContent, hidden: false };
      renderTopbar();
      clearInterval(t);
    }
  }, 250);
  setTimeout(() => clearInterval(t), 6000);
}

/* --------------------------- gesture / sinkronisasi --------------------- */
// tombol back hardware (Android) menutup pemutar penuh lebih dulu
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (isFullPlayerOpen()) closeFullPlayer();
  }
  if (e.code === "Space" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && P.current) {
    e.preventDefault();
    import("./player.js").then((m) => m.togglePlay());
  }
});

/* mini player selalu ter-render */
renderMini();

/* splash */
setTimeout(() => {
  document.getElementById("splash")?.classList.add("hide");
  setTimeout(() => document.getElementById("splash")?.remove(), 500);
}, 700);

render();

/* layar tetap menyala */
let wakeLock = null;
async function requestWakeLock() {
  if (!S.settings.jagaLayarMenyala) {
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    return;
  }
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
});
requestWakeLock();

/* hentikan musik saat aplikasi ditutup (perilaku PWA) */
window.addEventListener("pagehide", () => {
  if (S.settings.hentikanSaatDitutup) {
    import("./player.js").then((m) => m.stopAll?.());
  }
});

/* registrasi service worker (PWA) */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/* ekspos untuk debugging & uji otomatis (aktif dengan ?debug=1) */
window.AURALYS = { S, nav };
if (new URLSearchParams(location.search).has("debug")) {
  import("./player.js").then((m) => (window.__A = { ...m }));
}
