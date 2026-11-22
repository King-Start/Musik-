/* search.js — halaman Cari */
import { S, esc, save, toast, addRecentSearch } from "./core.js";
import { api } from "./api.js";
import { playTracks, playTrack, trackMenu } from "./player.js";
import { cardHTML, rowHTML, sectionTitleHTML, skeletonRows, errorHTML, emptyHTML } from "./ui.js";
import { openItem } from "./home.js";

const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "lagu", label: "Lagu" },
  { id: "video", label: "Video" },
  { id: "album", label: "Album" },
  { id: "artis", label: "Artis" },
  { id: "playlist", label: "Playlist" },
  { id: "podcast", label: "Podcast" },
];

export function renderSearch(root, nav, params) {
  const q0 = params.get("q") || "";
  let filter = "semua";
  let data = null;
  let sugTimer = null;

  const initial = q0
    ? ""
    : `<div class="hist-head"><h2>Telusuri</h2></div>
       <div class="chips" style="padding-bottom:12px">
         ${["Lagu populer", "DJ viral", "Lagu galau", "Dangdut koplo", "Musik tidur", "Indie Indonesia", "K-pop", "Lo-fi"]
           .map((t) => `<button class="chip" data-quick="${esc(t)}">${esc(t)}</button>`)
           .join("")}
       </div>
       ${
         S.recentSearches.length
           ? `<div class="hist-head"><h2>Terakhir ditelusuri</h2><button id="clear-hist">Hapus</button></div>
              <div class="suggests">${S.recentSearches
                .map(
                  (s) => `<button class="suggest" data-recent="${esc(s)}">${window.icon("history", 21)}<span>${esc(s)}</span></button>`
                )
                .join("")}</div>`
           : `<div style="padding:0 20px;color:var(--text-2);font-size:13.5px;line-height:1.6">Cari lagu, artis, album, atau playlist dari YouTube Music.</div>`
       }`;

  root.innerHTML = `
    <div class="page">
      <div class="search-head">
        <div class="search-box">
          ${window.icon("search", 21)}
          <input id="q" type="search" placeholder="Telusuri lagu, artis, album" value="${esc(q0)}" autocomplete="off" enterkeyhint="search" />
          <button id="clear-q" style="display:${q0 ? "grid" : "none"};place-items:center;color:var(--text-3)">${window.icon("close", 18)}</button>
        </div>
      </div>
      <div class="filter-chips" id="filters">
        ${FILTERS.map((f) => `<button class="chip ${f.id === filter ? "active" : ""}" data-f="${f.id}">${esc(f.label)}</button>`).join("")}
      </div>
      <div id="res">${initial}</div>
    </div>`;

  const input = root.querySelector("#q");
  const res = root.querySelector("#res");
  const filters = root.querySelector("#filters");

  const setLoading = () => (res.innerHTML = skeletonRows(7));

  const drawEmptyState = () => {
    res.innerHTML = initial;
    bindInitial();
  };

  function bindInitial() {
    res.querySelectorAll("[data-quick]").forEach((b) =>
      b.addEventListener("click", () => {
        input.value = b.dataset.quick;
        doSearch(b.dataset.quick);
      })
    );
    res.querySelectorAll("[data-recent]").forEach((b) =>
      b.addEventListener("click", () => {
        input.value = b.dataset.recent;
        doSearch(b.dataset.recent);
      })
    );
    res.querySelector("#clear-hist")?.addEventListener("click", () => {
      S.recentSearches = [];
      save();
      nav("/search", { replace: true });
    });
  }
  bindInitial();

  async function doSearch(q, f = filter) {
    q = q.trim();
    if (!q) return drawEmptyState();
    addRecentSearch(q);
    setLoading();
    try {
      data = await api.search(q, f);
      drawResults(q);
    } catch (e) {
      res.innerHTML = errorHTML(e.message);
    }
  }

  function drawResults(q) {
    const d = data;
    if (!d) return;
    let html = "";
    const sec = (title, items, kind, more) => {
      if (!items?.length) return "";
      html += sectionTitleHTML(title, { more });
      html += `<div class="${kind === "cards" ? "carousel" : "rows"}" data-kind="${kind}" data-title="${esc(title)}">
        ${items
          .slice(0, kind === "cards" ? 12 : 8)
          .map((it) => (kind === "cards" ? cardHTML(it, { showPlay: true }) : rowHTML(it)))
          .join("")}
      </div>`;
    };

    if (filter === "semua") {
      if (d.top && d.top.type === "artist") sec("Hasil teratas", [d.top], "cards");
      sec("Lagu", d.songs, "rows");
      sec("Video", d.videos, "rows");
      sec("Album", d.albums, "cards");
      sec("Artis", d.artists, "cards");
      sec("Playlist", d.playlists, "cards");
    } else {
      const map = { lagu: ["Lagu", d.songs, "rows"], video: ["Video", d.videos, "rows"], album: ["Album", d.albums, "cards"], artis: ["Artis", d.artists, "cards"], playlist: ["Playlist", d.playlists, "cards"], podcast: ["Podcast", d.playlists, "cards"] };
      const [t, items, kind] = map[filter] || [];
      sec(t, items, kind);
    }
    if (!html) html = emptyHTML({ icon: "search", title: "Tidak ada hasil", text: `Tidak ditemukan hasil untuk “${q}”. Coba kata kunci lain.` });
    res.innerHTML = html;
    bindResultEls();
  }

  function bindResultEls() {
    res.querySelectorAll("[data-kind]").forEach((wrap) => {
      const items = collectFromTitle(wrap.dataset.title);
      if (wrap.dataset.kind === "cards") {
        wrap.querySelectorAll("[data-card]").forEach((el) =>
          el.addEventListener("click", (e) => {
            const d2 = { id: el.dataset.card, videoId: el.dataset.vid, type: el.dataset.type, browseId: el.dataset.browse };
            const badge = e.target.closest(".play-badge");
            if (badge) {
              const songs = (data?.songs || []).concat(data?.videos || []);
              if (d2.type === "song" || d2.type === "video") {
                const i = songs.findIndex((x) => x.videoId === d2.videoId);
                return playTracks(songs, i >= 0 ? i : 0);
              }
            }
            openItem(d2, { items }, nav);
          })
        );
      } else {
        wrap.querySelectorAll(".row").forEach((el, i) => {
          const item = items[i];
          el.addEventListener("click", (e) => {
            if (e.target.closest("[data-dots]")) return;
            if (!item) return;
            if (d2isPlayable(item)) {
              const list = items.filter(d2isPlayable);
              playTracks(list, list.indexOf(item));
            } else openItem({ id: item.id, type: item.type, browseId: item.browseId, videoId: item.videoId }, { items }, nav);
          });
          el.querySelector("[data-dots]")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (item) trackMenu(item);
          });
        });
      }
    });
  }

  function d2isPlayable(x) {
    return x && (x.type === "song" || x.type === "video") && x.videoId;
  }

  function collectFromTitle(title) {
    const d = data || {};
    switch (title) {
      case "Hasil teratas":
        return [d.top];
      case "Lagu":
        return d.songs || [];
      case "Video":
        return d.videos || [];
      case "Album":
        return d.albums || [];
      case "Artis":
        return d.artists || [];
      case "Playlist":
      case "Podcast":
        return d.playlists || [];
      default:
        return [];
    }
  }

  input.addEventListener("input", () => {
    root.querySelector("#clear-q").style.display = input.value ? "grid" : "none";
    clearTimeout(sugTimer);
    const v = input.value.trim();
    if (!v) return drawEmptyState();
    sugTimer = setTimeout(async () => {
      try {
        const s = await api.suggest(v);
        if (!s.items?.length || document.activeElement !== input) return;
        res.innerHTML = `<div class="suggests">${s.items
          .map((x) => `<button class="suggest" data-sug="${esc(x)}">${window.icon("search", 20)}<span>${esc(x)}</span></button>`)
          .join("")}</div>`;
        res.querySelectorAll("[data-sug]").forEach((b) =>
          b.addEventListener("click", () => {
            input.value = b.dataset.sug;
            doSearch(b.dataset.sug);
            input.blur();
          })
        );
      } catch {}
    }, 260);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      input.blur();
      doSearch(input.value);
    }
  });
  root.querySelector("#clear-q").addEventListener("click", () => {
    input.value = "";
    input.focus();
    drawEmptyState();
  });

  filters.querySelectorAll("[data-f]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.f;
      filters.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("active", x === b));
      if (input.value.trim()) doSearch(input.value, filter);
    })
  );

  if (q0) doSearch(q0);
}
