/* library.js — halaman Pustaka lengkap */
import { S, save, esc, art, toast, createPlaylist, addToPlaylist, openSheet, confirmSheet, trackKey } from "./core.js";
import { playTracks, playTrack, trackMenu } from "./player.js";
import { rowHTML, cardHTML, sectionTitleHTML, emptyHTML, bindRows } from "./ui.js";

const TABS = [
  { id: "semua", label: "Semua" },
  { id: "playlist", label: "Playlist" },
  { id: "lagu", label: "Lagu" },
  { id: "album", label: "Album" },
  { id: "artis", label: "Artis" },
  { id: "podcast", label: "Podcast" },
];

let activeTab = "semua";
let sortMode = "Tanggal ditambahkan";
let listMode = "grid";

export function renderLibrary(root, nav, sub = null) {
  if (sub) return renderCollection(root, nav, sub);

  root.innerHTML = `
    <div class="page">
      <div class="topbar" style="padding:10px 20px 0"><h1>Pustaka</h1><div class="spacer"></div>
        <button class="icon-btn" id="lib-search">${window.icon("search", 22)}</button></div>
      <div class="lib-tabs" id="lib-tabs">${TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === activeTab ? "on" : ""}">${esc(t.label)}</button>`).join("")}</div>
      <div class="lib-bar">
        <button class="sort-pill" id="sort">${esc(sortMode)} ${window.icon("chevronDown", 16)}</button>
        <button class="sort-pill" id="dir" style="padding:8px 10px">${window.icon("arrowDown", 16)}</button>
        <div class="grow"></div>
        <span id="count" style="font-size:12.5px;color:var(--text-3)"></span>
        <button class="icon-btn" id="toggle-view" style="width:34px;height:34px;display:grid;place-items:center;color:var(--text-2)">${window.icon(listMode === "grid" ? "grid" : "list", 22)}</button>
      </div>
      <div id="lib-body"></div>
      <button id="fab-add" style="position:fixed;right:calc(50% - 215px + 16px);bottom:170px;width:52px;height:52px;border-radius:50%;background:var(--accent);color:var(--accent-text);display:none"></button>
    </div>`;

  root.querySelector("#lib-search").addEventListener("click", () => nav("/search"));
  root.querySelector("#lib-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    activeTab = b.dataset.tab;
    root.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
    drawBody();
  });
  root.querySelector("#sort").addEventListener("click", () =>
    openSheet("Urutkan berdasarkan", ["Tanggal ditambahkan", "Tanggal diubah", "Nama", "Artis", "Tahun"].map((l) => ({
      label: l,
      check: l === sortMode,
      icon: "sort",
      onClick: () => {
        sortMode = l;
        root.querySelector("#sort").innerHTML = `${esc(sortMode)} ${window.icon("chevronDown", 16)}`;
        drawBody();
      },
    })).concat([])
  ));
  root.querySelector("#dir").addEventListener("click", () => {
    sortMode = sortMode.startsWith("Tanggal") ? sortMode : sortMode;
    toast("Urutan dibalik");
  });
  root.querySelector("#toggle-view").addEventListener("click", () => {
    listMode = listMode === "grid" ? "list" : "grid";
    root.querySelector("#toggle-view").innerHTML = window.icon(listMode === "grid" ? "grid" : "list", 22);
    drawBody();
  });

  function drawBody() {
    const body = root.querySelector("#lib-body");
    body.innerHTML = "";
    const myPl = S.playlists;
    const cards = [
      { id: "col:disukai", title: "Disukai", sub: `${S.liked.length} lagu`, thumb: S.liked[0]?.thumb, auto: true },
      { id: "col:diunduh", title: "Diunduh", sub: `${S.downloads.length} lagu`, thumb: S.downloads[0]?.thumb, auto: true },
      { id: "col:recent", title: "Diputar terakhir", sub: `${S.history.length} lagu`, thumb: S.history[0]?.thumb, auto: true },
    ];

    if (activeTab === "semua") {
      body.innerHTML = `
        ${cards.length ? `<div class="tile-grid">${cards
          .map(
            (c) => `<div class="tile" data-col="${esc(c.id.replace("col:", ""))}">
              <div class="art">${c.thumb ? `<img src="${esc(art(c.thumb, 300))}" alt="">` : `<div class="stack-icon"><i></i><i></i><i></i></div>`}</div>
              <div class="t">${esc(c.title)}</div><div class="s">${esc(c.sub)}</div></div>`
          )
          .join("")}</div>` : ""}
        ${sectionTitleHTML("Playlist")}
        ${myPl.length ? playlistTiles(myPl) : `<div style="padding:0 20px;color:var(--text-2);font-size:13.5px">Belum ada playlist. Buat dengan tombol + di kanan bawah.</div>`}
        ${S.uploaded.length ? sectionTitleHTML("Lagu saya") + `<div class="rows">${S.uploaded.map((t) => rowHTML(t)).join("")}</div>` : ""}
        <div class="set-group-label">Koleksi</div>
        <div class="collection">
          ${collRow("heart", "Disukai", S.liked.length, "liked")}
          ${collRow("download", "Diunduh", S.downloads.length, "downloads")}
          ${collRow("checkCircle", "Tersimpan di cache", S.cached.length, "cache")}
          ${collRow("device", "Di perangkat", S.uploaded.length, "device")}
          ${collRow("trending", "Teratas saya 50", S.history.length, "top")}
          ${collRow("upload", "Diunggah", S.uploaded.length, "uploaded")}
        </div>
        <div style="height:120px"></div>`;
      bindTileClicks(body, nav);
      bindCollRows(body, nav);
    }

    if (activeTab === "playlist") {
      const plus = `<div class="tile" id="new-pl"><div class="art" style="border-style:dashed"><span style="color:var(--text-2)">${window.icon("plus", 30)}</span></div><div class="t">Playlist baru</div><div class="s">Buat playlist</div></div>`;
      body.innerHTML = `<div class="tile-grid">${plus}${myPl
        .map(
          (p) => `<div class="tile" data-pl="${esc(p.id)}">
            <div class="art">${p.tracks[0]?.thumb ? `<img src="${esc(art(p.tracks[0].thumb, 300))}" alt="">` : `<div class="stack-icon"><i></i><i></i><i></i></div>`}</div>
            <div class="t">${esc(p.name)}</div><div class="s">${p.tracks.length} lagu</div></div>`
        )
        .join("")}</div>`;
      body.querySelector("#new-pl")?.addEventListener("click", newPlaylistFlow);
      body.querySelectorAll("[data-pl]").forEach((el) =>
        el.addEventListener("click", () => nav(`/playlist/${el.dataset.pl}`))
      );
      setupFab(root, true);
    }

    if (activeTab === "lagu") {
      const all = [...S.uploaded, ...S.downloads, ...S.liked];
      body.innerHTML = all.length
        ? `<div class="rows">${all.map((t) => rowHTML(t)).join("")}</div>`
        : emptyHTML({ icon: "music", title: "Belum ada lagu", text: "Lagu yang kamu sukai atau unduh akan muncul di sini." });
      bindRows(body, all, { onPlay: (it, i) => playTracks(all, i), onDots: (it) => trackMenu(it) });
    }

    if (activeTab === "album") {
      body.innerHTML = `<div class="rows">${
        [...new Map(S.liked.filter((t) => t.subtitle).map((t) => [t.subtitle, t])).values()]
          .map((t) => rowHTML({ ...t, id: "alb:" + t.subtitle, title: t.subtitle.split(" • ").pop() || t.subtitle, thumb: t.thumb }))
          .join("") || ""
      }</div>${!S.liked.length ? emptyHTML({ icon: "music", title: "Belum ada album", text: "Sukai lagu untuk mengisi pustaka album." }) : ""}`;
    }

    if (activeTab === "artis") {
      const top = Object.entries(S.topCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
      body.innerHTML = top.length
        ? `<div class="rows">${top
            .map(([aid, n]) => {
              const t = [...S.liked, ...S.history].find((x) => x.artistId === aid);
              return rowHTML({ id: aid, browseId: aid, type: "artist", title: t?.artists?.[0] || "Artis", subtitle: `${n} pemutaran`, thumb: t?.thumb }, { rounded: true });
            })
            .join("")}</div>`
        : emptyHTML({ icon: "user", title: "Pustaka artis akan muncul di sini", text: "Dengarkan musik untuk melihat artis yang sering kamu putar." });
      body.querySelectorAll(".row").forEach((el, i) => {
        el.addEventListener("click", () => nav(`/browse/${top[i][0]}`));
      });
    }

    if (activeTab === "podcast") {
      body.innerHTML = emptyHTML({ icon: "mic", title: "Belum ada podcast", text: "Podcast yang kamu ikuti akan muncul di sini." });
    }

    root.querySelector("#count").textContent =
      activeTab === "playlist" ? `${S.playlists.length} playlist` : "";

    if (activeTab === "semua") setupFab(root, true);
    else setupFab(root, activeTab === "playlist");
  }

  function setupFab(r, show) {
    const fab = r.querySelector("#fab-add");
    if (!fab) return;
    fab.style.display = "grid";
    fab.style.placeItems = "center";
    fab.style.position = "absolute";
    fab.innerHTML = window.icon("plus", 26);
    fab.onclick = newPlaylistFlow;
  }

  function newPlaylistFlow() {
    openSheet("Playlist baru", [
      {
        label: "Buat playlist kosong",
        icon: "plus",
        onClick: () => {
          const name = prompt("Nama playlist:");
          if (!name) return;
          const pl = createPlaylist(name);
          toast(`Playlist "${name}" dibuat`);
          nav(`/playlist/${pl.id}`);
        },
      },
      { label: "Putar semua lagu yang disukai", icon: "heart", onClick: () => playTracks(S.liked, 0) },
    ]);
  }

  function playlistTiles(list) {
    return `<div class="tile-grid">${list
      .map(
        (p) => `<div class="tile" data-pl="${esc(p.id)}">
          <div class="art">${p.tracks[0]?.thumb ? `<img src="${esc(art(p.tracks[0].thumb, 300))}" alt="">` : `<div class="stack-icon"><i></i><i></i><i></i></div>`}</div>
          <div class="t">${esc(p.name)}</div><div class="s">${p.tracks.length} lagu</div></div>`
      )
      .join("")}</div>`;
  }

  function collRow(icon, label, count, sub) {
    return `<button class="coll-row" data-col="${sub}">${window.icon(icon, 22)}<span>${esc(label)}</span>
      <span class="count">${count ? count : ""}${window.icon("arrowRight", 18)}</span></button>`;
  }

  function bindTileClicks(scope, nav) {
    scope.querySelectorAll("[data-pl]").forEach((el) =>
      el.addEventListener("click", () => nav(`/playlist/${el.dataset.pl}`))
    );
    scope.querySelectorAll("[data-col]").forEach((el) =>
      el.addEventListener("click", () => nav(`/library/${el.dataset.col}`))
    );
  }
  function bindCollRows(scope, nav) {
    scope.querySelectorAll("[data-col]").forEach((el) =>
      el.addEventListener("click", () => nav(`/library/${el.dataset.col}`))
    );
  }

  drawBody();
}

/* ----------------------------- koleksi turunan --------------------------- */
const COLLECTIONS = {
  liked: { title: "Disukai", get: () => S.liked },
  downloads: { title: "Diunduh", get: () => S.downloads },
  cache: { title: "Tersimpan di cache", get: () => S.cached },
  device: { title: "Di perangkat", get: () => S.uploaded },
  uploaded: { title: "Diunggah", get: () => S.uploaded },
  history: { title: "Diputar terakhir", get: () => S.history },
  top: { title: "Teratas saya 50", get: () => Object.values(S.history.reduce((a, t) => ((a[trackKey(t)] ||= { ...t, plays: 0 }).plays++, a), {})) },
};

function renderCollection(root, nav, sub) {
  if (sub.startsWith("pl:")) return;
  const conf = COLLECTIONS[sub];
  if (!conf) return renderLibrary(root, nav);
  const list = conf.get();
  root.innerHTML = `
    <div class="page">
      <div class="topbar"><button class="icon-btn" id="back">${window.icon("arrowLeft", 23)}</button>
        <h1 style="font-size:19px">${esc(conf.title)}</h1></div>
      <div style="padding:0 20px 6px;color:var(--text-2);font-size:13px">${list.length} lagu</div>
      ${
        list.length
          ? `<div class="hero-actions"><button class="ghost" id="sh">${window.icon("shuffle", 21)}</button>
             <button class="pill-play" id="playall">${window.icon("play", 18)} Putar</button></div>
             <div class="rows">${list.map((t, i) => rowHTML(t, { index: i })).join("")}</div>`
          : emptyHTML({ icon: "music", title: "Masih kosong", text: "Lagu yang kamu tambahkan akan muncul di sini." })
      }
      <div style="height:120px"></div>
    </div>`;
  root.querySelector("#back").addEventListener("click", () => nav("/library"));
  root.querySelector("#playall")?.addEventListener("click", () => playTracks(list, 0));
  root.querySelector("#sh")?.addEventListener("click", () => playTracks([...list].sort(() => Math.random() - 0.5), 0));
  bindRows(root.querySelector(".page"), list, { onPlay: (it, i) => playTracks(list, i), onDots: (it) => trackMenu(it) });
}

/* -------------------------------- playlist ------------------------------- */
export function renderPlaylistPage(root, nav, id) {
  const pl = S.playlists.find((p) => p.id === id);
  if (!pl) {
    root.innerHTML = `<div class="page"><div class="empty"><h3>Playlist tidak ditemukan</h3></div></div>`;
    return;
  }
  root.innerHTML = `
    <div class="page">
      <div class="topbar"><button class="icon-btn" id="back">${window.icon("arrowLeft", 23)}</button><div class="spacer"></div>
        <button class="icon-btn" id="edit-name">${window.icon("edit", 20)}</button>
        <button class="icon-btn" id="del">${window.icon("trash", 20)}</button></div>
      <div class="hero">
        <div class="art-wrap">
          <div class="art">${pl.tracks[0]?.thumb ? `<img src="${esc(art(pl.tracks[0].thumb, 400))}" alt="">` : `<div style="height:100%;display:grid;place-items:center;color:var(--text-3)">${window.icon("note", 44)}</div>`}</div>
          <div style="min-width:0"><h2>${esc(pl.name)}</h2><div class="meta">Playlist • ${pl.tracks.length} lagu</div></div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="ghost" id="sh">${window.icon("shuffle", 21)}</button>
        <button class="ghost" id="add">${window.icon("plus", 22)}</button>
        <button class="pill-play" id="playall">${window.icon("play", 18)} Putar</button>
      </div>
      ${
        pl.tracks.length
          ? `<div class="rows" id="pl-rows">${pl.tracks.map((t, i) => rowHTML(t, { index: i })).join("")}</div>`
          : emptyHTML({ icon: "note", title: "Playlist masih kosong", text: "Tambahkan lagu dari menu ⋮ pada lagu mana pun." })
      }
      <div style="height:120px"></div>
    </div>`;
  root.querySelector("#back").addEventListener("click", () => nav("/library", { tab: "playlist" }));
  root.querySelector("#playall")?.addEventListener("click", () => playTracks(pl.tracks, 0));
  root.querySelector("#sh")?.addEventListener("click", () => playTracks([...pl.tracks].sort(() => Math.random() - 0.5), 0));
  root.querySelector("#add")?.addEventListener("click", () => nav("/search"));
  root.querySelector("#edit-name").addEventListener("click", () => {
    const n = prompt("Nama playlist:", pl.name);
    if (n) {
      pl.name = n;
      save();
      renderPlaylistPage(root, nav, id);
    }
  });
  root.querySelector("#del").addEventListener("click", () =>
    confirmSheet("Hapus playlist?", `"${pl.name}" akan dihapus permanen.`, "Hapus", () => {
      S.playlists = S.playlists.filter((p) => p.id !== id);
      save();
      toast("Playlist dihapus");
      nav("/library", { tab: "playlist", replace: true });
    }, true)
  );
  const rowsWrap = root.querySelector("#pl-rows");
  if (rowsWrap) {
    rowsWrap.querySelectorAll(".row").forEach((el, i) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-dots]")) return;
        playTracks(pl.tracks, i);
      });
      el.querySelector("[data-dots]")?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const t = pl.tracks[i];
        import("./player.js").then((m) => m.trackMenu({ ...t, _playlist: pl.id }));
      });
    });
  }
}

/* ------------------------------- unduhan -------------------------------- */
export function downloadTrack(track) {
  const key = trackKey(track);
  if (S.downloads.some((t) => trackKey(t) === key)) return toast("Sudah diunduh");
  S.downloads.unshift({ ...track, downloadedAt: Date.now() });
  save();
  toast("Diunduh untuk offline");
  document.dispatchEvent(new CustomEvent("auralys:storage"));
}
export function cacheTrack(track) {
  const key = trackKey(track);
  if (S.cached.some((t) => trackKey(t) === key)) return;
  S.cached.unshift({ ...track, cachedAt: Date.now() });
  save();
}
