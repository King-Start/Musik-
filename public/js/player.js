/* player.js — mesin pemutar (YouTube IFrame API) + antrean + mini player + pemutar penuh */
import {
  S, save, emit, on, toast, S as state, art, esc, fmtTime, isLiked, toggleLike,
  addHistory, openSheet, openMenu, createPlaylist, addToPlaylist, trackKey,
} from "./core.js";
import { api } from "./api.js";

/* --------------------------- wrapper HTML5 <audio> ----------------------- */
class AudioEngine {
  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.volume = 1;
    this.el.addEventListener("timeupdate", () => this.onTime?.());
    this.el.addEventListener("ended", () => this.onEnded?.());
    this.el.addEventListener("playing", () => this.onPlayState?.(true));
    this.el.addEventListener("pause", () => this.onPlayState?.(false));
    this.el.addEventListener("loadedmetadata", () => this.onTime?.());
    this.el.addEventListener("error", () => this.onError?.());
  }
  load(url, { autoplay = true } = {}) {
    this.el.src = url;
    this.el.load();
    if (autoplay) this.play();
  }
  play() {
    this.el.play().catch(() => {});
  }
  pause() {
    this.el.pause();
  }
  seek(t) {
    try {
      this.el.currentTime = t;
    } catch {}
  }
  setVolume(v) {
    this.el.volume = Math.max(0, Math.min(1, v));
  }
  get currentTime() {
    return this.el.currentTime || 0;
  }
  get duration() {
    return this.el.duration || 0;
  }
  setRate(r) {
    this.el.playbackRate = r;
  }
}

/* ------------------------------- YT engine ------------------------------- */
class YTEngine {
  constructor() {
    this.ready = false;
    this.player = null;
    this.pending = null;
    this.volume = 100;
    this.onTime = null;
    this.onEnded = null;
    this.onPlayState = null;
  }
  async init() {
    if (this.ready) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await new Promise((resolve) => {
          if (window.YT && window.YT.Player) return resolve();
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
          window.onYouTubeIframeAPIReady = resolve;
        });
        await new Promise((resolve) => {
          this.readyResolve = resolve;
          this.player = this.createPlayer();
          setTimeout(resolve, 8000); // jangan menggantung bila iframe diblokir
        });
      })();
    }
    await this.initPromise;
  }
  createPlayer() {
    return new window.YT.Player("ytplayer", {
      width: 320,
      height: 180,
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        origin: location.origin,
      },
      events: {
        onReady: (e) => {
          this.player = e.target;
          this.ready = true;
          this.readyResolve?.();
          try {
            if (typeof this.player?.setVolume === "function") this.player.setVolume(this.volume);
          } catch {}
          if (this.pending) {
            const p = this.pending;
            this.pending = null;
            this.load(p.videoId, p);
          }
        },
        onStateChange: (e) => {
          const s = e.data;
          if (s === 1) this.onPlayState?.(true);
          if (s === 2) this.onPlayState?.(false);
          if (s === 0) this.onEnded?.();
        },
        onError: () => this.onError?.(),
      },
    });
  }
  load(videoId, { autoplay = true, start = 0 } = {}) {
    if (!this.ready || typeof this.player?.loadVideoById !== "function") {
      this.pending = { videoId, autoplay, start };
      this.init();
      return;
    }
    this.player.loadVideoById({ videoId, startSeconds: start });
    if (!autoplay) setTimeout(() => this.pause(), 400);
  }
  play() {
    try {
      this.player?.playVideo?.();
    } catch {}
  }
  pause() {
    try {
      this.player?.pauseVideo?.();
    } catch {}
  }
  seek(t) {
    try {
      this.player?.seekTo?.(t, true);
    } catch {}
  }
  setVolume(v) {
    this.volume = v;
    try {
      if (typeof this.player?.setVolume === "function") this.player.setVolume(v);
    } catch {}
  }
  setRate(r) {
    try {
      if (typeof this.player?.setPlaybackRate === "function") this.player.setPlaybackRate(r);
    } catch {}
  }
  get currentTime() {
    try {
      return this.player?.getCurrentTime?.() || 0;
    } catch {
      return 0;
    }
  }
  get duration() {
    try {
      return this.player?.getDuration?.() || 0;
    } catch {
      return 0;
    }
  }
}

/* ------------------------------ player store ----------------------------- */
export const P = {
  queue: [],
  index: -1,
  playing: false,
  shuffle: false,
  repeat: "off", // off | all | one
  engine: null,
  engineKind: null,
  current: null,
  radioSeed: null,
  loadingTrack: null,
};

const yt = new YTEngine();
const html5 = new AudioEngine();

function bindEngine(engine) {
  engine.onTime = () => {
    updateProgress();
    saveLastTrack();
  };
  engine.onEnded = () => next(true);
  engine.onPlayState = (p) => {
    P.playing = p;
    renderMini();
    renderFullPlayerState();
    updateMediaSessionState();
  };
  engine.onError = () => {
    if (S.settings.lewatiOtomatisKesalahan) next(true);
    else toast("Lagu ini tidak dapat diputar");
  };
}

/* --------------------------- media session (OS) -------------------------- */
function updateMediaSession() {
  const t = P.current;
  if (!t || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: t.title || "",
      artist: (t.artists || []).join(", ") || t.subtitle || "",
      album: t.album || "Auralys",
      artwork: [{ src: art(t.thumb, 512), sizes: "512x512", type: "image/jpeg" }],
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (P.engine) P.engine.seek(Math.max(0, P.engine.currentTime - 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (P.engine) P.engine.seek(Math.min(P.engine.duration || 0, P.engine.currentTime + 10));
    });
  } catch {}
}
function updateMediaSessionState() {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = P.playing ? "playing" : "paused";
  } catch {}
}

/* ------------------------------- core play ------------------------------- */
export async function playTracks(tracks, startIndex = 0, { radioSeed = null } = {}) {
  P.queue = tracks.map((t) => ({ ...t }));
  P.index = Math.max(0, Math.min(startIndex, P.queue.length - 1));
  P.radioSeed = radioSeed;
  await loadCurrent({ autoplay: true });
}

export function playTrack(track, queue = null) {
  if (queue && queue.length) {
    const i = queue.findIndex((t) => trackKey(t) === trackKey(track));
    return playTracks(queue, i >= 0 ? i : 0);
  }
  const existing = P.queue.findIndex((t) => trackKey(t) === trackKey(track));
  if (existing >= 0) {
    P.index = existing;
    return loadCurrent({ autoplay: true });
  }
  P.queue.splice(P.index + 1, 0, { ...track });
  P.index = P.index + 1;
  return loadCurrent({ autoplay: true });
}

export function enqueue(track, next_ = false) {
  if (next_) P.queue.splice(P.index + 1, 0, { ...track });
  else P.queue.push({ ...track });
  emit("queue", P.queue);
  toast(next_ ? "Diputar berikutnya" : "Ditambahkan ke antrean");
  renderFullPlayerState();
}

async function resolveAudio(track) {
  // 1) trek lokal (audio yang diunggah pengguna) -> pakai elemen <audio>
  if (track.localUrl) return { kind: "local", url: track.localUrl };
  // 2) lagu dari YouTube Music -> pemutar resmi YouTube (IFrame Player).
  //    Ini cara paling andal: audio diputar oleh YouTube langsung di perangkat,
  //    tanpa perlu mengekstrak/streaming manual (yang dibatasi YouTube).
  if (track.videoId) return { kind: "youtube", videoId: track.videoId };
  throw new Error("Sumber audio tidak dikenal");
}

async function loadCurrent({ autoplay = true } = {}) {
  const t = P.queue[P.index];
  if (!t) return;
  P.current = t;
  P.loadingTrack = t;
  renderMini(true);
  renderFullPlayer();
  setLoading(true);
  try {
    const src = await resolveAudio(t);
    P.engineKind = src.kind;
    P.engine = src.kind === "local" ? html5 : yt;
    bindEngine(P.engine);
    if (src.kind === "local") {
      html5.setVolume(S.settings.volume / 100);
      html5.setRate(S.settings.kecepatan || 1);
      html5.load(src.url, { autoplay });
    } else {
      yt.setVolume(S.settings.volume);
      yt.setRate(S.settings.kecepatan || 1);
      await yt.init();
      yt.load(src.videoId, { autoplay });
    }
    P.playing = autoplay;
    startTicker();
    addHistory(t);
    updateMediaSession();
    emit("track", t);
    // ambil lirik + antrean terkait
    refreshExtras(t);
  } catch (e) {
    toast("Tidak bisa memutar lagu ini");
    console.error(e);
  } finally {
    setLoading(false);
    renderMini();
    renderFullPlayerState();
  }
}

let extrasToken = 0;
async function refreshExtras(track) {
  const token = ++extrasToken;
  P.lyrics = null;
  P.related = [];
  renderFullPlayerState();
  try {
    const l = await api.lyrics(track.videoId, track.title, (track.artists || [])[0] || "");
    if (token === extrasToken) {
      P.lyrics = l.lyrics || null;
      P.lyricsSynced = l.synced || null;
      P.lyricsSource = l.source || null;
      renderFullPlayerState();
    }
  } catch {}
  try {
    const n = await api.next(track.videoId);
    if (token !== extrasToken) return;
    P.related = (n.related || []).filter((x) => x.videoId && x.videoId !== track.videoId);
    renderFullPlayerState();
  } catch {}
}

function saveLastTrack() {
  if (!P.current) return;
  S.lastTrack = { ...P.current, position: P.engine?.currentTime || 0 };
  save();
}

export function togglePlay() {
  if (!P.engine) {
    if (P.queue.length) loadCurrent({ autoplay: true });
    return;
  }
  if (P.playing) {
    P.engine.pause();
    P.playing = false;
  } else {
    if (P.engine === yt) yt.play();
    else P.engine.play();
    P.playing = true;
  }
  renderMini();
  renderFullPlayerState();
}

export function next(auto = false) {
  if (!P.queue.length) return;
  if (P.repeat === "one" && auto) {
    P.engine?.seek(0);
    if (P.engine === yt) yt.play();
    else P.engine.play();
    return;
  }
  if (S.settings.cegahLaguSama && P.current) {
    // pindahkan lagu yang sama (bila ada di depan) ke belakang
    const key = trackKey(P.current);
    P.queue = P.queue.filter((t, i) => i === P.index || trackKey(t) !== key);
    if (P.index >= P.queue.length) P.index = 0;
  }
  let ni = P.index + 1;
  if (P.shuffle) {
    if (P.queue.length <= 1) ni = 0;
    else {
      do {
        ni = Math.floor(Math.random() * P.queue.length);
      } while (ni === P.index);
    }
  }
  if (ni >= P.queue.length) {
    if (P.repeat === "all") ni = 0;
    else if (P.radioSeed || P.related?.length) {
      // radio: lanjutkan dengan lagu terkait
      const add = P.related?.length ? P.related : [];
      if (add.length) {
        P.queue.push(...add.slice(0, 12));
        ni = P.index + 1;
      } else return;
    } else {
      P.playing = false;
      P.engine?.pause();
      renderMini();
      renderFullPlayerState();
      return;
    }
  }
  P.index = ni;
  loadCurrent({ autoplay: true });
}
export function prev() {
  if (!P.queue.length) return;
  if ((P.engine?.currentTime || 0) > 4) {
    P.engine.seek(0);
    return;
  }
  P.index = P.index <= 0 ? P.queue.length - 1 : P.index - 1;
  loadCurrent({ autoplay: true });
}

export function seekTo(sec) {
  P.engine?.seek(sec);
  updateProgress();
}
export function setVolume(v) {
  S.settings.volume = v;
  save();
  if (P.engineKind === "local") html5.setVolume(v / 100);
  else yt.setVolume(v);
  renderFullPlayerState();
}
export function setRate(r) {
  S.settings.kecepatan = r;
  save();
  if (P.engineKind === "local") html5.setVolume(S.settings.volume / 100), html5.setRate(r);
  else yt.setRate(r);
  renderFullPlayerState();
  toast(`Kecepatan ${r}×`);
}
export function toggleShuffle() {
  P.shuffle = !P.shuffle;
  if (S.settings.ingatStatusAcakUlang) {
    S.settings.acakAktif = P.shuffle;
    save();
  }
  toast(P.shuffle ? "Acak aktif" : "Acak nonaktif");
  renderFullPlayerState();
}
export function cycleRepeat() {
  P.repeat = P.repeat === "off" ? "all" : P.repeat === "all" ? "one" : "off";
  S.settings.ulangiAktif = P.repeat;
  save();
  toast(P.repeat === "off" ? "Ulang nonaktif" : P.repeat === "all" ? "Ulangi semua" : "Ulangi satu lagu");
  renderFullPlayerState();
}

/* -------------------------------- rendering ------------------------------ */
let miniEl, sheetEl;

function progressPct() {
  const cur = P.engine?.currentTime || 0;
  const dur = P.engine?.duration || P.current?.durationSec || 0;
  return dur ? (cur / dur) * 100 : 0;
}
function updateProgress() {
  const cur = P.engine?.currentTime || 0;
  let dur = P.engine?.duration || 0;
  if (!dur && P.current?.duration) {
    const p = P.current.duration.split(":").map(Number);
    dur = p.reduce((a, b) => a * 60 + b, 0);
  }
  const pct = dur ? (cur / dur) * 100 : 0;
  const bar = document.querySelector("#miniplayer .progress i");
  if (bar) bar.style.width = pct + "%";
  const pf = document.querySelector("#ps-fill");
  if (pf) pf.style.width = pct + "%";
  const knob = document.querySelector("#ps-knob");
  if (knob) knob.style.left = pct + "%";
  const ct = document.querySelector("#ps-cur");
  if (ct) ct.textContent = fmtTime(cur);
  const dt = document.querySelector("#ps-dur");
  if (dt) dt.textContent = fmtTime(dur || 0);
  const range = document.querySelector("#ps-range");
  if (range && document.activeElement !== range) range.value = String(pct);
}

export function renderMini(loadingMode = false) {
  miniEl = document.getElementById("miniplayer");
  if (!miniEl) return;
  const t = P.current;
  if (!t) {
    miniEl.hidden = true;
    return;
  }
  miniEl.hidden = false;
  const liked = isLiked(t);
  miniEl.innerHTML = `
    <div class="cover" data-open="1"><img src="${esc(art(t.thumb, 120))}" alt="" /></div>
    <div class="info" data-open="1">
      <div class="t">${esc(t.title || "")}</div>
      <div class="s">${esc((t.artists || []).join(", ") || t.subtitle || "")}</div>
    </div>
    <button class="btn heart ${liked ? "on" : ""}" data-act="like" style="${liked ? "color:#e02b4b" : ""}">${window.icon(liked ? "heartFill" : "heart", 21)}</button>
    <button class="btn play" data-act="play" aria-label="Putar">${window.icon(P.playing ? "pause" : "play", 22)}</button>
    <button class="btn" data-act="next" aria-label="Berikutnya">${window.icon("next", 20)}</button>
    <div class="progress"><i style="width:${progressPct()}%"></i></div>
  `;
  if (!miniEl._bound) {
    miniEl._bound = true;
    miniEl.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "play") return togglePlay();
      if (act === "next") return next();
      if (act === "like") return toggleLike(P.current) && renderMini();
      if (e.target.closest("[data-open]")) openFullPlayer();
      else openFullPlayer();
    });
    // geser untuk ganti lagu
    let x0 = null;
    miniEl.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    miniEl.addEventListener("touchend", (e) => {
      if (x0 == null || !S.settings.geserGantiLagu) return;
      const dx = e.changedTouches[0].clientX - x0;
      const thresh = 180 - (S.settings.sensitivitasGeser || 73);
      if (Math.abs(dx) > thresh) (dx < 0 ? next() : prev());
      x0 = null;
    });
  }
  updateProgress();
}

let lastFull = "";
export function renderFullPlayer() {
  const t = P.current;
  sheetEl = document.getElementById("player-sheet");
  if (!sheetEl) return;
  if (!t) {
    sheetEl.innerHTML = "";
    return;
  }
  const liked = isLiked(t);
  const css = S.settings.desainPemutarBaru ? "" : "gaya-lama";
  sheetEl.innerHTML = `
    <div class="ps-bg" style="background-image:url('${esc(art(t.thumb, 400))}')"></div>
    <div class="ps-scrim"></div>
    <div class="ps-content ${css}">
      <div class="ps-top">
        <button class="icon-btn" data-act="close">${window.icon("chevronDown", 24)}</button>
        <div class="grab"></div>
        <button class="icon-btn" data-act="menu">${window.icon("dots", 22)}</button>
      </div>
      <div class="ps-cover">${
        S.settings.sembunyikanThumbnail
          ? `<div style="display:grid;place-items:center;height:100%;color:var(--text-3)">${window.icon("wave", 64)}</div>`
          : `<img src="${esc(art(t.thumb, 600))}" alt="" style="${S.settings.pangkasSampulAlbum ? "" : "object-fit:contain"}" />`
      }</div>
      <div class="ps-title">
        <div class="meta">
          <h2>${esc(t.title || "")}</h2>
          <div class="a">${esc((t.artists || []).join(", ") || t.subtitle || "")}</div>
        </div>
        <button class="heart ${liked ? "on" : ""}" data-act="like">${window.icon(liked ? "heartFill" : "heart", 24)}</button>
      </div>
      <div class="ps-seek">
        <div class="bar"><i id="ps-fill"></i><span class="knob" id="ps-knob"></span>
          <input id="ps-range" type="range" min="0" max="100" value="0" step="0.1" />
        </div>
        <div class="ps-times"><span id="ps-cur">0:00</span><span id="ps-dur">0:00</span></div>
      </div>
      <div class="ps-controls">
        <button data-act="shuffle" class="${P.shuffle ? "on" : ""}">${window.icon("shuffle", 22)}</button>
        <button data-act="prev">${window.icon("prev", 26)}</button>
        <button class="big" data-act="play">${window.icon(P.playing ? "pause" : "play", 30)}</button>
        <button data-act="next">${window.icon("next", 26)}</button>
        <button data-act="repeat" class="${P.repeat !== "off" ? "on" : ""}">${window.icon("repeat", 22)}</button>
      </div>
      <div class="ps-extra">
        <button data-act="lyrics" class="${P.showLyrics ? "on" : ""}">${window.icon("lyrics", 21)}<span>Lirik</span></button>
        <button data-act="related" class="${P.showRelated ? "on" : ""}">${window.icon("queue", 21)}<span>Terkait</span></button>
        <button data-act="addlib">${window.icon("plus", 21)}<span>Pustaka</span></button>
        <button data-act="share">${window.icon("share", 20)}<span>Bagikan</span></button>
        <button data-act="speed">${window.icon("speed", 20)}<span>${(S.settings.kecepatan || 1)}×</span></button>
      </div>
      <div id="ps-panel"></div>
    </div>`;
  bindFullPlayer();
  renderFullPlayerState();
  updateProgress();
}

function bindFullPlayer() {
  if (sheetEl._bound) return;
  sheetEl._bound = true;
  sheetEl.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    const t = P.current;
    switch (act) {
      case "close": return closeFullPlayer();
      case "play": return togglePlay();
      case "next": return next();
      case "prev": return prev();
      case "shuffle": return toggleShuffle();
      case "repeat": return cycleRepeat();
      case "like": toggleLike(t); renderFullPlayer(); return;
      case "menu": return trackMenu(t);
      case "lyrics": P.showLyrics = !P.showLyrics; if (P.showLyrics) P.showRelated = false; return renderFullPlayerState();
      case "related": P.showRelated = !P.showRelated; if (P.showRelated) P.showLyrics = false; return renderFullPlayerState();
      case "addlib": return addToLibrarySheet(t);
      case "share": return shareTrack(t);
      case "speed": return openSheet("Kecepatan pemutaran", [0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => ({
        label: `${r}×${(S.settings.kecepatan || 1) === r ? " (aktif)" : ""}`,
        icon: "speed", onClick: () => setRate(r),
      })));
    }
  });
  sheetEl.addEventListener("input", (e) => {
    if (e.target.id === "ps-range") {
      const dur = P.engine?.duration || 0;
      if (dur) P.engine.seek((e.target.value / 100) * dur);
    }
  });
}

export function renderFullPlayerState() {
  if (!sheetEl || !P.current) return;
  const t = P.current;
  const liked = isLiked(t);
  const btn = sheetEl.querySelector('[data-act="play"]');
  if (btn) btn.innerHTML = window.icon(P.playing ? "pause" : "play", 30);
  const heart = sheetEl.querySelector('.ps-title .heart');
  if (heart) {
    heart.classList.toggle("on", liked);
    heart.innerHTML = window.icon(liked ? "heartFill" : "heart", 24);
  }
  const sh = sheetEl.querySelector('[data-act="shuffle"]');
  if (sh) sh.classList.toggle("on", P.shuffle);
  const rp = sheetEl.querySelector('[data-act="repeat"]');
  if (rp) rp.classList.toggle("on", P.repeat !== "off");
  const panel = sheetEl.querySelector("#ps-panel");
  if (!panel) return;
  if (P.showLyrics) {
    P.lyricsLines = parseLRC(P.lyricsSynced || (P.lyrics && P.lyricsSource ? null : null)) || parseLRC(P.lyrics) || null;
    const body = P.lyricsLines
      ? `<div class="lyrics-scroll">${P.lyricsLines
          .map((l, i) => `<div class="lyr-line" data-line="${i}">${esc(l.text)}</div>`)
          .join("")}</div>`
      : P.lyrics
      ? esc(P.lyrics)
      : `<span style="color:var(--text-3)">Lirik tidak tersedia untuk lagu ini.</span>`;
    panel.innerHTML = `<div class="ps-tabs"><button class="on">Lirik</button>${
      S.settings.terjemahanLirik ? `<button data-act="translate">Terjemahan</button>` : ""
    }${P.lyricsSource ? `<span style="margin-left:auto;align-self:center;font-size:11px;color:var(--text-3)">${esc(P.lyricsSource)}</span>` : ""}</div>
    <div class="ps-lyrics ${P.lyricsLines ? "synced" : ""}" id="ps-lyrics">${body}</div>`;
    if (P.lyricsLines) setTimeout(highlightLyrics, 60);
  } else if (P.showRelated) {
    const list = P.related?.length ? P.related : P.queue.slice(P.index + 1);
    panel.innerHTML = `<div class="ps-tabs"><button class="on">Berikutnya di antrean</button></div>
      <div class="queue-list rows">${list
        .slice(0, 25)
        .map(
          (x, i) => `<div class="row" data-q="${i}">
            <div class="thumb"><img src="${esc(art(x.thumb, 100))}" alt=""></div>
            <div class="info"><div class="t">${esc(x.title)}</div><div class="s">${esc((x.artists || []).join(", ") || x.subtitle || "")}</div></div>
            ${x.duration ? `<span style="font-size:12px;color:var(--text-3)">${esc(x.duration)}</span>` : ""}
          </div>`
        )
        .join("")}</div>`;
    panel.querySelectorAll("[data-q]").forEach((el) =>
      el.addEventListener("click", () => playTrack(list[+el.dataset.q], list))
    );
  } else panel.innerHTML = "";
}

let sheetOpen = false;
export function openFullPlayer() {
  const s = document.getElementById("player-sheet");
  if (!s || !P.current) return;
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add("open"));
  sheetOpen = true;
  emit("fullplayer", true);
}
export function closeFullPlayer() {
  const s = document.getElementById("player-sheet");
  if (!s) return;
  s.classList.remove("open");
  sheetOpen = false;
  emit("fullplayer", false);
  setTimeout(() => {
    if (!sheetOpen) s.hidden = true;
  }, 380);
}
export const isFullPlayerOpen = () => sheetOpen;

/* -------------------------------- actions -------------------------------- */
export function trackMenu(track) {
  const liked = isLiked(track);
  const actions = [
    { label: "Putar berikutnya", icon: "playNext", onClick: () => enqueue(track, true) },
    { label: "Tambahkan ke antrean", icon: "queue", onClick: () => enqueue(track) },
    {
      label: liked ? "Hapus dari Lagu yang disukai" : "Suka",
      icon: liked ? "heartFill" : "heart",
      onClick: () => {
        toggleLike(track);
        renderMini();
        renderFullPlayerState();
        emit("liked", {});
      },
    },
    { label: "Tambahkan ke playlist", icon: "plus", onClick: () => addToLibrarySheet(track) },
    {
      label: "Putar radio lagu ini",
      icon: "radio",
      onClick: () => startRadio(track),
    },
    {
      label: "Bagikan",
      icon: "share",
      onClick: () => shareTrack(track),
    },
    {
      label: track.videoId ? "Buka di YouTube Music" : "Buka sumber",
      icon: "link",
      onClick: () => {
        if (track.videoId) window.open(`https://music.youtube.com/watch?v=${track.videoId}`, "_blank");
      },
    },
  ];
  if (track.videoId && !track.localUrl)
    actions.push({
      label: "Unduh untuk offline",
      icon: "download",
      onClick: () => import("./library.js").then((m) => m.downloadTrack(track)),
    });
  openMenu(track, actions);
}

export function shareTrack(track) {
  const url = track.videoId ? `https://music.youtube.com/watch?v=${track.videoId}` : location.href;
  if (navigator.share) {
    navigator.share({ title: track.title, text: `${track.title} — ${(track.artists || []).join(", ")}`, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => toast("Tautan disalin"), () => toast(url));
  }
}

export async function startRadio(track) {
  try {
    toast("Menyiapkan radio…");
    const n = await api.next(track.videoId);
    const list = [track, ...(n.related || []).filter((x) => x.videoId)];
    await playTracks(list, 0, { radioSeed: track.videoId });
    openFullPlayer();
  } catch {
    toast("Radio tidak tersedia");
  }
}

export function addToLibrarySheet(track) {
  const items = S.playlists.map((p) => ({
    label: p.name,
    icon: "note",
    onClick: () => addToPlaylist(p.id, track),
  }));
  items.push({
    label: "Playlist baru…",
    icon: "plus",
    onClick: () => createPlaylistFlow(track),
  });
  openSheet("Tambahkan ke playlist", items);
}

function createPlaylistFlow(track) {
  const name = prompt("Nama playlist baru:");
  if (!name) return;
  const pl = createPlaylist(name);
  if (track) addToPlaylist(pl.id, track);
  toast(`Playlist "${name}" dibuat`);
}


/* ------------------------------ lirik LRC ------------------------------- */
function parseLRC(raw) {
  if (!raw || !/\[\d{1,2}:\d{2}/.test(raw)) return null;
  const out = [];
  raw.split("\n").forEach((line) => {
    const m = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!m.length) return;
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!text) return;
    m.forEach((x) => {
      const ms = x[3] ? +x[3].padEnd(3, "0") : 0;
      out.push({ t: +x[1] * 60 + +x[2] + ms / 1000, text });
    });
  });
  return out.length ? out.sort((a, b) => a.t - b.t) : null;
}

function highlightLyrics() {
  const box = document.querySelector("#ps-lyrics");
  if (!box || !P.lyricsLines) return;
  const now = (P.engine?.currentTime || 0) + 0.25;
  let idx = -1;
  P.lyricsLines.forEach((l, i) => {
    if (l.t <= now) idx = i;
  });
  box.querySelectorAll("[data-line]").forEach((el, i) => {
    el.classList.toggle("on", i === idx);
    el.classList.toggle("past", i < idx);
  });
  const active = box.querySelector(".lyr-line.on");
  if (active && P.followLyrics !== false) {
    const boxRect = box.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    if (aRect.top < boxRect.top + 10 || aRect.bottom > boxRect.bottom - 10) {
      box.scrollTop += aRect.top - boxRect.top - boxRect.height / 2.2;
    }
  }
}

/* --------------------------- ticker durasi/times ------------------------ */
let tickTimer = null;
function startTicker() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    updateProgress();
    highlightLyrics();
  }, 500);
}

/* ----------------------- mini player tap → full player ------------------- */
export function setLoading(v) {
  P.loading = v;
  const btn = document.querySelector('#miniplayer [data-act="play"]');
  if (btn && v) btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span>`;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(tickTimer);
    tickTimer = null;
  } else startTicker();
});

export function stopAll() {
  try {
    P.engine?.pause();
  } catch {}
  P.playing = false;
  renderMini();
  renderFullPlayerState();
}

/* restore acak/ulangi dari pengaturan */
export function restorePlayerPrefs() {
  if (S.settings.ingatStatusAcakUlang) {
    P.shuffle = !!S.settings.acakAktif;
    P.repeat = S.settings.ulangiAktif || "off";
  }
}
