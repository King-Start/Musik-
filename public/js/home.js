/* home.js — halaman Beranda */
import { S, esc, art, timeGreeting, toast } from "./core.js";
import { api } from "./api.js";
import { playTracks, playTrack, trackMenu, startRadio } from "./player.js";
import { cardHTML, rowHTML, sectionTitleHTML, skeletonRows, skeletonCarousel, errorHTML, bindCards, bindRows } from "./ui.js";

const MOODS = [
  { label: "Relax", q: "lagu relax indonesia" },
  { label: "Commute", q: "lagu perjalanan" },
  { label: "Energize", q: "lagu semangat" },
  { label: "Sleep", q: "musik tidur" },
  { label: "Sad", q: "lagu galau indonesia" },
  { label: "Feel good", q: "lagu bahagia" },
  { label: "Fokus", q: "musik fokus belajar" },
  { label: "DJ Viral", q: "dj viral tiktok" },
];

export function renderHome(root, nav) {
  root.innerHTML = `
    <div class="page">
      <div class="greeting">
        <div class="hi">Beranda</div>
        <h1>${esc(timeGreeting())}</h1>
      </div>
      <div class="chips" id="mood-chips">
        ${MOODS.map((m, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-q="${esc(m.q)}">${esc(m.label)}</button>`).join("")}
      </div>
      <div id="home-body">${skeletonCarousel()}<div style="height:22px"></div>${skeletonRows(4)}</div>
    </div>`;

  root.querySelectorAll("[data-q]").forEach((b) =>
    b.addEventListener("click", () => {
      root.querySelectorAll("[data-q]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      nav(`/search?q=${encodeURIComponent(b.dataset.q)}`);
    })
  );

  const body = root.querySelector("#home-body");
  const draw = (data) => {
    const sections = data.sections || [];
    let html = "";
    // kartu "Musik yang disukai" buatan sendiri
    if (S.liked.length) {
      html += sectionTitleHTML("Untukmu");
      html += `<div class="carousel">${cardHTML(
        { id: "liked", type: "playlist", title: "Musik yang disukai", subtitle: "Playlist otomatis", thumb: S.liked[0]?.thumb },
        { showPlay: true }
      )}${S.history[0] ? cardHTML({ id: "history", type: "playlist", title: "Diputar terakhir", subtitle: `${S.history.length} lagu`, thumb: S.history[0].thumb }, { showPlay: true }) : ""}</div>`;
    }
    sections.slice(0, 10).forEach((sec, idx) => {
      html += sectionTitleHTML(sec.title, { more: sec.type === "list" ? "putar" : null, id: `sec-${idx}` });
      if (sec.type === "list") {
        html += `<div class="rows" data-sec="${idx}">${sec.items.slice(0, 6).map((it, i) => rowHTML(it, { index: null })).join("")}</div>`;
      } else {
        html += `<div class="carousel" data-sec="${idx}">${sec.items.slice(0, 12).map((it) => cardHTML(it, { showPlay: true })).join("")}</div>`;
      }
    });
    if (!sections.length)
      html += `<div class="error-box">Tidak ada konten yang bisa dimuat dari YouTube Music saat ini. Coba lagi nanti.</div>`;
    body.innerHTML = html;

    body.querySelectorAll("[data-title-id]").forEach((t) => {
      const idx = +t.dataset.titleId.split("-")[1];
      const sec = sections[idx];
      t.querySelector("[data-more]")?.addEventListener("click", () => {
        if (sec.type === "list") playSection(sec);
        else if (sec.more) nav(`/browse/${sec.more}`);
      });
    });

    body.querySelectorAll("[data-sec]").forEach((wrap) => {
      const sec = sections[+wrap.dataset.sec];
      if (!sec) return;
      if (sec.type === "list") {
        bindRows(wrap, sec.items, {
          onPlay: (item, i) => playTracks(sec.items.filter((x) => x.videoId || x.localUrl), i),
          onDots: (item) => handleDots(item, sec, nav),
        });
      } else {
        bindCards(
          wrap,
          (d) => openItem(d, sec, nav),
          (d) => openItem(d, sec, nav, true)
        );
      }
    });
  };

  Promise.allSettled([
    api.home(),
    api.browse("FEmusic_new_releases"),
    api.browse("FEmusic_charts"),
  ])
    .then(([home, releases, charts]) => {
      const sections = [];
      const h = home.status === "fulfilled" ? home.value.sections || [] : [];
      sections.push(...h.slice(0, 2));
      if (releases.status === "fulfilled") {
        (releases.value.sections || []).forEach((s) =>
          sections.push({ ...s, title: s.title === "Album & single" ? "Rilis baru" : "Video musik baru" })
        );
      }
      sections.push(...h.slice(2));
      if (charts.status === "fulfilled") {
        (charts.value.sections || [])
          .filter((s) => s.type === "list" || s.items.length)
          .slice(0, 2)
          .forEach((s) => sections.push({ ...s, title: `${s.title} • Indonesia` }));
      }
      if (!sections.length) return (body.innerHTML = errorHTML("Konten beranda kosong."));
      draw({ sections });
    })
    .catch((e) => (body.innerHTML = errorHTML(e.message)));
}

function playSection(sec) {
  const list = sec.items.filter((x) => x.videoId || x.localUrl);
  if (list.length) playTracks(list, 0);
  else toast("Tidak ada lagu yang bisa diputar");
}

function handleDots(item, sec, nav) {
  trackMenu(item);
}

export function openItem(d, sec, nav, play = false) {
  // cari item lengkap
  const item =
    sec?.items?.find((x) => String(x.id) === String(d.id) || (x.videoId && x.videoId === d.videoId)) || {
      id: d.id,
      videoId: d.videoId,
      browseId: d.browseId,
      type: d.type,
      title: "",
    };
  if (d.id === "liked") {
    if (play) return playTracks(S.liked, 0);
    return nav("/library/liked");
  }
  if (d.id === "history") {
    if (play) return playTracks(S.history, 0);
    return nav("/library/history");
  }
  if (item.type === "song" || item.type === "video") {
    const list = (sec?.items || []).filter((x) => (x.type === "song" || x.videoId) && x.videoId);
    return playTracks(list.length ? list : [item], Math.max(0, list.findIndex((x) => x.videoId === item.videoId)));
  }
  if (item.type === "artist") return nav(`/browse/${item.browseId || item.id}`);
  if (item.type === "playlist") {
    if (play) return playPlaylist(item, nav);
    return nav(`/browse/${item.browseId || item.playlistId || "VL" + item.playlistId}`);
  }
  if (item.type === "album") {
    if (play) return playPlaylist(item, nav);
    return nav(`/browse/${item.browseId}`);
  }
  // fallback
  if (item.browseId) nav(`/browse/${item.browseId}`);
  else if (item.videoId) startRadio(item);
}

async function playPlaylist(item, nav) {
  const id = item.browseId || item.playlistId;
  if (!id) return;
  toast("Memuat playlist…");
  try {
    const data = await api.browse(id);
    const tracks = data.tracks.filter((t) => t.videoId);
    if (tracks.length) playTracks(tracks, 0);
    else toast("Playlist ini belum punya lagu yang bisa diputar");
  } catch {
    toast("Gagal memuat playlist");
  }
}
