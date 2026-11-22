/* browse.js — halaman album / playlist / artis */
import { S, esc, art, toast, createPlaylist, addToPlaylist, save } from "./core.js";
import { api } from "./api.js";
import { playTracks, playTrack, trackMenu, startRadio } from "./player.js";
import { cardHTML, rowHTML, sectionTitleHTML, skeletonRows, errorHTML, bindCards } from "./ui.js";

export function renderBrowse(root, nav, id) {
  root.innerHTML = `<div class="page"><div style="height:16px"></div>${skeletonRows(8)}</div>`;
  api
    .browse(id)
    .then((data) => draw(root, nav, id, data))
    .catch((e) => (root.querySelector(".page").innerHTML = errorHTML(e.message)));
}

function draw(root, nav, id, data) {
  const h = data.header || { title: "Tanpa judul", subtitle: "" };
  const tracks = data.tracks
    .filter((t) => t.videoId)
    .map((t) => ({ ...t, thumb: t.thumb || h.thumb || null }));
  const isArtist = id.startsWith("UC");
  const songs = tracks.filter((t) => t.type === "song" || t.videoId);
  const albums = [];
  const singles = [];
  const related = [];
  (data.sections || []).forEach((s) => {
    if (s.type !== "carousel") return;
    const t = (s.title || "").toLowerCase();
    s.items.forEach((it) => {
      if (it.type === "album") (t.includes("singel") || t.includes("single") ? singles : albums).push(it);
      else related.push(it);
    });
  });

  const heroArt = h.thumb || tracks[0]?.thumb || related[0]?.thumb;

  root.innerHTML = `
    <div class="page">
      <div class="hero">
        <div class="art-wrap">
          <div class="art ${isArtist ? "round" : ""}" style="${isArtist ? "border-radius:50%" : ""}">
            <img src="${esc(art(heroArt, 400))}" alt="" />
          </div>
          <div class="info">
            <h2>${esc(h.title)}</h2>
            <div class="meta">${esc(h.trackCount || h.subtitle || "")}</div>
            ${h.description ? `<div class="desc">${esc(h.description)}</div>` : ""}
          </div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="ghost" id="shuffle-all" title="Acak">${window.icon("shuffle", 22)}</button>
        <button class="ghost" id="radio" title="Radio">${window.icon("radio", 21)}</button>
        <button class="ghost" id="save-pl" title="Simpan">${window.icon("saveToLib", 21)}</button>
        <button class="pill-play" id="play-all">${window.icon("play", 18)} Putar</button>
      </div>
      ${songs.length ? `<div class="rows" id="track-rows" style="margin-top:6px">${songs
        .map((t, i) => rowHTML(t, { index: i }))
        .join("")}</div>` : ""}
      ${albums.length ? sectionTitleHTML(isArtist ? "Album" : "Lainnya") + `<div class="carousel" id="albums">${albums.map((a) => cardHTML(a, { showPlay: true })).join("")}</div>` : ""}
      ${singles.length ? sectionTitleHTML("Singel & EP") + `<div class="carousel" id="singles">${singles.map((a) => cardHTML(a, { showPlay: true })).join("")}</div>` : ""}
      ${related.length ? sectionTitleHTML(isArtist ? "Terkait" : "Lainnya juga") + `<div class="carousel" id="related">${related.slice(0, 14).map((a) => cardHTML(a, { showPlay: true })).join("")}</div>` : ""}
      ${!songs.length && !albums.length && !related.length ? `<div class="error-box">Konten untuk halaman ini belum bisa ditampilkan. Coba buka item lain.</div>` : ""}
    </div>`;

  root.querySelector("#play-all")?.addEventListener("click", () => {
    if (tracks.length) playTracks(tracks, 0);
    else toast("Tidak ada lagu untuk diputar");
  });
  root.querySelector("#shuffle-all")?.addEventListener("click", () => {
    if (!tracks.length) return toast("Tidak ada lagu");
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTracks(shuffled, 0);
    toast("Memutar secara acak");
  });
  root.querySelector("#radio")?.addEventListener("click", () => {
    const seed = tracks[0] || { videoId: id, title: h.title };
    startRadio(seed);
  });
  root.querySelector("#save-pl")?.addEventListener("click", () => {
    const name = h.title || "Playlist baru";
    const pl = createPlaylist(name);
    tracks.forEach((t) => addToPlaylist(pl.id, t));
    toast(`Disimpan ke playlist "${name}"`);
  });

  const rowsWrap = root.querySelector("#track-rows");
  if (rowsWrap) {
    rowsWrap.querySelectorAll(".row").forEach((el, i) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-dots]")) return;
        playTracks(tracks, i);
      });
      el.querySelector("[data-dots]")?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        trackMenu(tracks[i]);
      });
    });
  }
  const bindCardList = (sel, list) => {
    const el = root.querySelector(sel);
    if (!el) return;
    bindCards(
      el,
      (d) => {
        const item = list.find((x) => x.id === d.id || x.browseId === d.browseId) || d;
        if (item.type === "song" && item.videoId) playTrack(item, list);
        else if (item.browseId) nav(`/browse/${item.browseId}`);
      },
      (d) => {
        const item = list.find((x) => x.id === d.id || x.browseId === d.browseId) || d;
        if (item.type === "song" && item.videoId) playTrack(item, list);
        else if (item.browseId) nav(`/browse/${item.browseId}`);
      }
    );
  };
  bindCardList("#albums", albums);
  bindCardList("#singles", singles);
  bindCardList("#related", related);
}
