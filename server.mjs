import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ytm from "./lib/ytmusic.mjs";
import { findLyrics } from "./lib/lyrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

/* cache sederhana */
const cache = new Map();
const TTL = 1000 * 60 * 10;
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return v;
}

const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    res.json(data);
  } catch (e) {
    console.error("[api]", req.path, e.message);
    res.status(502).json({ error: String(e.message || e) });
  }
};

app.get("/api/health", (req, res) => res.json({ ok: true, at: Date.now() }));

app.get("/api/home", wrap(async () => cached("home", () => ytm.home())));

app.get(
  "/api/search",
  wrap(async (req) => {
    const q = String(req.query.q || "").trim();
    const filter = String(req.query.filter || "semua");
    if (!q) return { songs: [], videos: [], albums: [], artists: [], playlists: [], primary: [] };
    // Filter diterapkan di sisi klien; permintaan ke YouTube Music selalu "semua"
    // agar semua jenis hasil (lagu, video, album, artis, playlist) tersedia.
    return cached(`s:all:${q}`, () => ytm.search(q, "semua"));
  })
);

app.get(
  "/api/suggest",
  wrap(async (req) => {
    const q = String(req.query.q || "").trim();
    if (!q) return { items: [] };
    const j = await ytm._internals.innertube("music/get_search_suggestions", { input: q });
    const items = [];
    const walk = (o) => {
      if (!o || typeof o !== "object") return;
      if (o.searchSuggestionRenderer) {
        const s = o.searchSuggestionRenderer.suggestion?.runs?.map((r) => r.text).join("");
        if (s) items.push(s);
      }
      for (const k in o) walk(o[k]);
    };
    walk(j);
    return { items: items.slice(0, 8) };
  })
);

app.get(
  "/api/browse",
  wrap(async (req) => {
    const id = String(req.query.id || "");
    if (!id) throw new Error("id wajib");
    return cached(`b:${id}`, () => ytm.browse(id));
  })
);

app.get(
  "/api/next",
  wrap(async (req) => {
    const videoId = String(req.query.videoId || "");
    // otomatis pakai radio mix (RDAMVM...) agar antrean berisi puluhan lagu terkait
    const playlistId = req.query.playlistId
      ? String(req.query.playlistId)
      : `RDAMVM${videoId}`;
    if (!videoId) throw new Error("videoId wajib");
    return cached(`n:${videoId}:${playlistId || ""}`, () => ytm.next(videoId, playlistId));
  })
);

app.get(
  "/api/lyrics",
  wrap(async (req) => {
    const videoId = String(req.query.videoId || "");
    const title = String(req.query.title || "");
    const artist = String(req.query.artist || "");
    if (!videoId && !title) throw new Error("videoId/title wajib");
    const key = `l:${videoId}:${title}:${artist}`;
    return cached(key, async () => {
      // 1) coba lirik berwaktu dari LRCLIB
      const l = await findLyrics({ artist, title }).catch(() => null);
      if (l?.plain || l?.synced)
        return { lyrics: l.synced || l.plain, synced: l.synced || null, source: "LRCLIB", title: l.title };
      // 2) fallback: deskripsi dari YouTube Music (kadang berisi lirik)
      if (videoId) {
        const y = await ytm.lyrics(videoId).catch(() => null);
        if (y?.lyrics) return { lyrics: y.lyrics, synced: null, source: "YouTube Music" };
      }
      return { lyrics: null, synced: null, source: null };
    });
  })
);

app.get(
  "/api/stream",
  wrap(async (req) => {
    const videoId = String(req.query.videoId || "");
    if (!videoId) throw new Error("videoId wajib");
    const data = await ytm.player(videoId);
    const formats = data?.streamingData?.adaptiveFormats || data?.streamingData?.formats || [];
    const u = data?.playabilityStatus?.status;
    const audio = formats
      .filter((f) => String(f.mimeType).startsWith("audio"))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const video = formats
      .filter((f) => String(f.mimeType).startsWith("video") && f.mimeType.includes("mp4"))
      .sort((a, b) => (a.height || 9999) - (b.height || 9999));
    return {
      status: u,
      reason: data?.playabilityStatus?.reason,
      title: data?.videoDetails?.title,
      author: data?.videoDetails?.author,
      lengthSeconds: data?.videoDetails?.lengthSeconds,
      audioUrl: audio[0]?.url || null,
      videoUrl: video[0]?.url || null,
      mime: audio[0]?.mimeType,
    };
  })
);

/* proxy stream — supaya bisa diputar dari halaman & mendukung Range */
app.get("/api/proxy", async (req, res) => {
  try {
    const url = String(req.query.url || "");
    if (!/^https:\/\//.test(url)) return res.status(400).end("bad url");
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        ...(req.headers.range ? { range: req.headers.range } : {}),
        origin: "https://www.youtube.com",
      },
    });
    res.status(r.status);
    ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"].forEach(
      (h) => {
        const v = r.headers.get(h);
        if (v) res.setHeader(h, v);
      }
    );
    if (!r.body) return res.end();
    const reader = r.body.getReader();
    const pump = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) await new Promise((r) => res.once("drain", r));
      }
      res.end();
    };
    pump().catch(() => res.end());
  } catch (e) {
    res.status(502).end(String(e.message || e));
  }
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Auralys running on http://0.0.0.0:${PORT}`));
