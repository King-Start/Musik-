// ytmusic.mjs — klien InnerTube (YouTube Music) tanpa API key.
const YT = "https://music.youtube.com/youtubei/v1";
const CLIENT = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20240101.01.00",
  hl: "id",
  gl: "ID",
};

const HEADERS = {
  "content-type": "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  origin: "https://music.youtube.com",
  "x-youtube-client-name": "67",
  "x-youtube-client-version": "1.20240101.01.00",
};

let visitorData = null;

async function innertube(endpoint, body) {
  const payload = {
    context: { client: { ...CLIENT, ...(visitorData ? { visitorData } : {}) } },
    ...body,
  };
  const res = await fetch(`${YT}/${endpoint}?prettyPrint=false`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} -> ${res.status}`);
  const json = await res.json();
  if (json.responseContext?.visitorData) visitorData = json.responseContext.visitorData;
  return json;
}

/* ------------------------------- helpers ------------------------------- */

const txt = (o) =>
  o?.runs?.map((r) => r.text).join("") ?? o?.simpleText ?? o?.text ?? "";

const thumbOf = (r) => {
  const th =
    r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    r?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    r?.thumbnail?.thumbnails ||
    r?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    r?.thumbnails ||
    [];
  if (!th.length) return null;
  // pilih resolusi ~226px bila ada
  const best =
    [...th].reverse().find((t) => t.width >= 180) || th[th.length - 1];
  return best?.url?.replace(/=w\d+-h\d+/, "=w544-h544") || best?.url;
};

function navOf(r) {
  const navs = [];
  const push = (n) => n && navs.push(n);
  push(r?.navigationEndpoint);
  push(r?.title?.runs?.[0]?.navigationEndpoint);
  push(r?.onTap?.watchEndpoint ? { watchEndpoint: r.onTap.watchEndpoint } : null);
  push(r?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint);
  (r?.flexColumns || []).forEach((c) =>
    (c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).forEach((run) =>
      push(run.navigationEndpoint)
    )
  );
  (r?.subtitle?.runs || []).forEach((run) => push(run.navigationEndpoint));
  (r?.menu?.menuRenderer?.items || []).forEach((it) =>
    push(it?.menuNavigationItemRenderer?.navigationEndpoint)
  );
  return navs;
}

function idsOf(r) {
  const navs = navOf(r);
  let videoId = null;
  let browseId = null;
  let pageType = null;
  let playlistId = null;
  for (const n of navs) {
    if (!videoId && n?.watchEndpoint?.videoId) videoId = n.watchEndpoint.videoId;
    if (!playlistId && n?.watchEndpoint?.playlistId) playlistId = n.watchEndpoint.playlistId;
    if (!browseId && n?.browseEndpoint?.browseId) browseId = n.browseEndpoint.browseId;
    if (!pageType && n?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType)
      pageType =
        n.browseEndpoint.browseEndpointContextSupportedConfigs
          .browseEndpointContextMusicConfig.pageType;
  }
  return { videoId, browseId, pageType, playlistId };
}

const DUR = /[0-9]{1,2}[:.][0-9]{2}([:.][0-9]{2})?/;

function resolveType(first, pageType, videoId, browseId) {
  const t = (first || "").toLowerCase();
  if (["lagu", "song", "music"].includes(t)) return videoId ? "song" : "song";
  if (["video", "video musik"].includes(t)) return "video";
  if (["album", "single", "ep"].includes(t)) return "album";
  if (["playlist", "daftar putar"].includes(t)) return "playlist";
  if (["artis", "artist", "profil", "profile"].includes(t)) return "artist";
  if (["podcast", "episode", "acara"].includes(t)) return "podcast";
  if (["lagu populer", "lagu yang disukai"].includes(t)) return "song";
  switch (pageType) {
    case "MUSIC_PAGE_TYPE_ARTIST": return "artist";
    case "MUSIC_PAGE_TYPE_ALBUM": return "album";
    case "MUSIC_PAGE_TYPE_PLAYLIST": return "playlist";
    case "MUSIC_PAGE_TYPE_USER_CHANNEL": return "playlist";
    case "MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_PODCAST_EPISODE": return "podcast";
  }
  if (videoId) return "song";
  const b = browseId || "";
  if (b.startsWith("UC")) return "artist";
  if (b.startsWith("MPRE")) return "album";
  if (b.startsWith("VL") || b.startsWith("RD") || b.startsWith("PL")) return "playlist";
  if (b.startsWith("FEmusic")) return "playlist";
  return videoId ? "song" : "album";
}

function segments(runs = []) {
  const out = [];
  let cur = [];
  const flush = () => {
    if (cur.length) {
      const text = cur.map((x) => x.text).join("").trim();
      if (text) out.push({ text, nav: cur.find((x) => x.navigationEndpoint)?.navigationEndpoint });
    }
    cur = [];
  };
  runs.forEach((r) => {
    if ((r.text || "").trim() === "•") flush();
    else cur.push(r);
  });
  flush();
  return out;
}

function parseDuration(r) {
  const segs = [];
  (r?.flexColumns || []).forEach((c) =>
    segs.push(...segments(c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []))
  );
  segs.push(...segments(r?.subtitle?.runs || []));
  const found = segs.find((x) => DUR.test(x.text));
  return found ? found.text : null;
}

const TYPE_WORDS = new Set([
  "lagu", "song", "video", "video musik", "album", "single", "ep", "playlist",
  "daftar putar", "artis", "artist", "profil", "profile", "podcast", "episode", "acara",
]);

function isArtistNav(n) {
  return (
    n?.browseEndpoint?.browseEndpointContextSupportedConfigs
      ?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ARTIST"
  );
}

function artistsOf(r) {
  const out = [];
  const collect = (runs = []) => {
    runs.forEach((run) => {
      const n = run.navigationEndpoint;
      if (isArtistNav(n)) out.push({ name: run.text.trim(), id: n.browseEndpoint.browseId });
    });
  };
  (r?.flexColumns || []).slice(1, 2).forEach((c) =>
    collect(c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
  );
  collect(r?.subtitle?.runs || []);
  collect(r?.shortBylineText?.runs || []);
  return out.filter((a, i, arr) => arr.findIndex((b) => b.name === a.name) === i);
}

function itemFromListRow(r) {
  const { videoId, browseId, pageType, playlistId } = idsOf(r);
  const title = txt(r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
  const colRuns = r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const segs = segments(colRuns);
  const subText = colRuns.map((x) => x.text).join("");
  const first = (segs[0]?.text || "").toLowerCase();
  const type = resolveType(first, pageType, videoId, browseId);
  const artists = artistsOf(r);
  const duration = parseDuration(r);

  // sisa segmen setelah membuang kata jenis, durasi, dan statistik
  const rest = segs
    .filter((x, i) => !(i === 0 && TYPE_WORDS.has(x.text.toLowerCase())))
    .filter((x) => !DUR.test(x.text))
    .filter((x) => !(x.text.includes("ditonton") || x.text.includes("pemutaran") || /^[0-9]{4}$/.test(x.text)))
    .map((x) => x.text);
  let subtitle = rest.slice(0, 2).join(" • ");
  const artistNames = artists.length ? artists.map((a) => a.name) : rest.slice(0, 1);
  if (!subtitle) subtitle = artistNames.join(", ");

  return {
    id: type === "song" || type === "video" ? videoId || browseId : browseId || videoId || playlistId,
    videoId,
    browseId,
    playlistId,
    type,
    title,
    subtitle,
    artists: artistNames,
    artistId: artists[0]?.id || null,
    thumb: thumbOf(r),
    duration,
    explicit:
      (r?.badges || []).some((b) => /eksplisit|explicit/i.test(JSON.stringify(b))) ||
      /eksplisit/i.test(subText),
  };
}

function itemFromTwoRow(r) {
  const { videoId, browseId, pageType, playlistId } = idsOf(r);
  const title = txt(r?.title);
  const subRuns = r?.subtitle?.runs || [];
  const subtitle = subRuns.map((x) => x.text).join("");
  let type = resolveType("", pageType, videoId, browseId);
  // kartu carousel yang punya videoId hampir selalu lagu/video yang bisa diputar,
  // meski navigasi pertamanya mengarah ke halaman artis.
  if (videoId && (type === "artist" || type === "album")) type = "song";
  if (videoId && /NON_MUSIC|PODCAST/i.test(pageType || "")) type = "podcast";
  const artists = subRuns
    .filter(
      (run) =>
        run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ARTIST"
    )
    .map((run) => run.text);
  return {
    id: type === "song" || type === "video" ? videoId || browseId : browseId || videoId,
    videoId,
    browseId,
    playlistId,
    type,
    title,
    subtitle: type === "song" || type === "video" ? artists.join(", ") || subtitle : subtitle,
    artists,
    artistId:
      subRuns.find((x) => x.navigationEndpoint?.browseEndpoint?.browseId)?.navigationEndpoint
        ?.browseEndpoint?.browseId || null,
    thumb: thumbOf(r),
    duration: null,
    year: /^\d{4}$/.test(subtitle.trim()) ? subtitle.trim() : null,
  };
}

function itemFromPlaylistRow(r) {
  const videoId = idsOf(r).videoId;
  const title = txt(r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
  if (!title) return null;
  const colText = (i) =>
    txt(r?.flexColumns?.[i]?.musicResponsiveListItemFlexColumnRenderer?.text);
  const artistsRuns = r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const artists = artistsRuns
    .map((x) => x.text)
    .join("")
    .split("•")
    .map((x) => x.trim())
    .filter(Boolean);
  const album = colText(2);
  const duration = colText(3) || txt(r?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text);
  return {
    id: videoId,
    videoId,
    browseId: null,
    playlistId: null,
    type: "song",
    title,
    subtitle: [artists.join(", "), album].filter(Boolean).join(" • "),
    artists,
    artistId:
      artistsRuns.find((x) => x.navigationEndpoint?.browseEndpoint?.browseId)?.navigationEndpoint
        ?.browseEndpoint?.browseId || null,
    album: album || null,
    thumb: thumbOf(r),
    duration: DUR.test(duration || "") ? duration : null,
    explicit: (r?.badges || []).some((b) => /eksplisit|explicit/i.test(JSON.stringify(b))),
  };
}

function parseListItem(node) {
  const wrap = node.musicResponsiveListItemRenderer;
  if (!wrap) return null;
  // header baris/artis ("Lagu •") kadang kosong -> skip
  const it = itemFromListRow(wrap);
  if (!it.title) return null;
  return it;
}

/* ------------------------------ endpoints ------------------------------ */

const FILTER_PARAMS = {
  semua: null,
  lagu: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
  video: "EgWKAQIQAWoMEA4QChADEAQQCRAF",
  album: "EgWKAQIYAWoMEA4QChADEAQQCRAF",
  artis: "EgWKAQIgAWoMEA4QChADEAQQCRAF",
  playlist: "EgWKAQIoAWoMEA4QChADEAQQCRAF",
  podcast: "EgWKAQJYAWoMEA4QChADEAQQCRAF",
};

export async function search(q, filter = "semua") {
  const body = { query: q };
  const p = FILTER_PARAMS[filter];
  if (p) body.params = p;
  const json = await innertube("search", body);

  const out = { songs: [], videos: [], albums: [], artists: [], playlists: [], top: null };
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.musicCardShelfRenderer) {
      const c = o.musicCardShelfRenderer;
      out.top = {
        id: idsOf(c).browseId || idsOf(c).videoId,
        videoId: idsOf(c).videoId,
        browseId: idsOf(c).browseId,
        type: "artist",
        title: txt(c.title),
        subtitle: txt(c.subtitle),
        thumb: thumbOf(c),
      };
    }
    if (o.musicResponsiveListItemRenderer) {
      const it = parseListItem(o);
      if (it) {
        const first =
          it.subtitle.split("•")[0].trim().toLowerCase() ||
          "";
        const typ = it.type;
        if (typ === "album") out.albums.push(it);
        else if (typ === "playlist") out.playlists.push(it);
        else if (typ === "artist") out.artists.push(it);
        else if (typ === "video") out.videos.push(it);
        else out.songs.push(it);
      }
    }
    if (o.musicTwoRowItemRenderer) {
      const it = itemFromTwoRow(o.musicTwoRowItemRenderer);
      if (it.title) {
        if (it.type === "album") out.albums.push(it);
        else if (it.type === "artist") out.artists.push(it);
        else if (it.type === "playlist") out.playlists.push(it);
        else out.songs.push(it);
      }
    }
    for (const k in o) walk(o[k]);
  };
  walk(json);

  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = `${x.id}|${x.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  Object.keys(out).forEach((k) => {
    if (Array.isArray(out[k])) out[k] = dedupe(out[k]);
  });

  if (filter !== "semua") {
    const map = {
      lagu: "songs",
      video: "videos",
      album: "albums",
      artis: "artists",
      playlist: "playlists",
      podcast: "playlists",
    };
    const key = map[filter];
    return { ...out, primary: out[key] || [] };
  }
  out.primary = [
    ...out.songs,
    ...out.videos,
    ...out.albums,
    ...out.artists,
    ...out.playlists,
  ];
  return out;
}

export async function home() {
  const json = await innertube("browse", { browseId: "FEmusic_home" });
  return parseSections(json);
}

export function parseSections(json) {
  const sections = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.musicCarouselShelfRenderer) {
      const c = o.musicCarouselShelfRenderer;
      const title = txt(c.header?.musicCarouselShelfBasicHeaderRenderer?.title);
      const items = [];
      (c.contents || []).forEach((ci) => {
        if (ci.musicTwoRowItemRenderer)
          items.push(itemFromTwoRow(ci.musicTwoRowItemRenderer));
        if (ci.musicResponsiveListItemRenderer) {
          const it = parseListItem(ci);
          if (it) items.push(it);
        }
      });
      const subtitle = txt(
        c.header?.musicCarouselShelfBasicHeaderRenderer?.strapline
      );
      const more = (
        c.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton
          ?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId || null
      );
      if (items.length)
        sections.push({
          type: "carousel",
          title: title || "Untukmu",
          subtitle,
          more,
          items: items.filter((i) => i && i.title),
        });
    }
    if (o.musicShelfRenderer) {
      const s = o.musicShelfRenderer;
      const title = txt(s.title);
      const items = (s.contents || [])
        .map((ci) => parseListItem(ci))
        .filter(Boolean);
      if (items.length)
        sections.push({
          type: "list",
          title: title || "Pilihan",
          items,
          more:
            s.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint
              ?.browseId || null,
        });
    }
    for (const k in o) walk(o[k]);
  };
  walk(json);
  return { sections };
}

export async function browse(browseId) {
  const json = await innertube("browse", { browseId });
  // header
  let header = null;
  const findHeader = (o) => {
    if (!o || typeof o !== "object" || header) return;
    const candidates = [
      o.musicResponsiveHeaderRenderer,
      o.musicDetailHeaderRenderer,
      o.musicImmersiveHeaderRenderer,
      o.musicVisualHeaderRenderer,
      o.musicEditablePlaylistDetailHeaderRenderer?.header?.musicResponsiveHeaderRenderer,
      o.musicEditablePlaylistDetailHeaderRenderer?.header?.musicDetailHeaderRenderer,
    ].filter(Boolean);
    for (const h of candidates) {
      const title = txt(h.title) || txt(h.title?.text);
      if (!title) continue;
      header = {
        title,
        subtitle: txt(h.subtitle) || txt(h.strapline) || txt(h.description),
        thumb: thumbOf(h) || thumbOf(h.thumbnail),
        description: (txt(h.description) || "").slice(0, 220),
        trackCount: txt(h.secondSubtitle),
        meta: (h.subtitle?.runs || []).map((r) => r.text).join(""),
      };
      return;
    }
    for (const k in o) findHeader(o[k]);
  };
  findHeader(json);
  const { sections } = parseSections(json);
  const tracks = [];
  const seen = new Set();
  const collect = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.musicShelfRenderer || o.musicPlaylistShelfRenderer) {
      const shelf = o.musicShelfRenderer || o.musicPlaylistShelfRenderer;
      const sheetTitle = o.musicShelfRenderer ? txt(shelf.title) : txt(o.musicPlaylistShelfRenderer.title);
      (shelf.contents || []).forEach((ci) => {
        const it = ci.musicResponsiveListItemRenderer
          ? o.musicPlaylistShelfRenderer
            ? itemFromPlaylistRow(ci.musicResponsiveListItemRenderer)
            : parseListItem(ci)
          : null;
        if (it && it.videoId && !seen.has(it.videoId)) {
          seen.add(it.videoId);
          tracks.push({ ...it, section: sheetTitle });
        }
      });
    }
    for (const k in o) collect(o[k]);
  };
  collect(json);

  // judul lagu headless (mis. header berbentuk "Lagu" tanpa judul) -> pakai nama playlist dari microformat
  if (header && /^lagu$/i.test(header.title.trim())) {
    const mf = json.microformat?.microformatDataRenderer;
    if (mf?.title) header.title = mf.title.replace(/^Album\s*[-–]\s*/i, "").replace(/\s*[-–]\s*Song.*$/i, "");
  }
  if (!header?.title) {
    const mf = json.microformat?.microformatDataRenderer;
    if (mf?.title) header = { ...(header || {}), title: mf.title, thumb: header?.thumb || mf.thumbnail?.thumbnails?.slice(-1)[0]?.url };
  }
  return { header, sections, tracks };
}

export async function next(videoId, playlistId) {
  const json = await innertube("next", {
    videoId,
    ...(playlistId ? { playlistId } : {}),
  });
  const items = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.playlistPanelVideoRenderer) {
      const p = o.playlistPanelVideoRenderer;
      const { videoId: vid } = idsOf(p);
      const title = txt(p.title);
      if (title)
        items.push({
          id: vid,
          videoId: vid,
          type: "song",
          title,
          subtitle: txt(p.shortBylineText),
          artists: p.shortBylineText?.runs?.map((r) => r.text).filter((t) => t !== " • ") || [],
          thumb: thumbOf(p),
          duration: txt(p.lengthText),
        });
    }
    for (const k in o) walk(o[k]);
  };
  walk(json);
  // fallback dari panel queue
  const queue = [];
  const walk2 = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.playlistPanelVideoWrapperRenderer) {
      const r = o.playlistPanelVideoWrapperRenderer.primaryRenderer?.playlistPanelVideoRenderer;
      if (r) {
        const title = txt(r.title);
        const vid = idsOf(r).videoId;
        if (title && vid)
          queue.push({
            id: vid,
            videoId: vid,
            type: "song",
            title,
            subtitle: txt(r.shortBylineText),
            artists: [],
            thumb: thumbOf(r),
            duration: txt(r.lengthText),
          });
      }
    }
    for (const k in o) walk2(o[k]);
  };
  walk2(json);
  return { related: items, queue: queue.length ? queue : items };
}

export async function lyrics(videoId) {
  try {
    const json = await innertube("next", { videoId });
    let text = null;
    const walk = (o) => {
      if (!o || typeof o !== "object") return;
      if (o.musicDescriptionShelfRenderer) {
        const t = txt(o.musicDescriptionShelfRenderer.description);
        if (t && t.length > 40) text = t;
      }
      for (const k in o) walk(o[k]);
    };
    walk(json);
    return { lyrics: text };
  } catch {
    return { lyrics: null };
  }
}

export async function player(videoId) {
  const json = await innertube("player", { videoId, contentCheckOk: true, racyCheckOk: true });
  return json;
}

export const _internals = { innertube, HEADERS };
