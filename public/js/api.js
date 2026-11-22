/* api.js — pembungkus endpoint backend Auralys */
const cache = new Map();

async function get(path, params = {}, { ttl = 5 * 60_000 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/${path}${qs ? `?${qs}` : ""}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Gagal memuat (${res.status}) ${msg.slice(0, 120)}`);
  }
  const v = await res.json();
  cache.set(url, { t: Date.now(), v });
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  return v;
}

export const api = {
  home: () => get("home", {}, { ttl: 10 * 60_000 }),
  search: (q, filter = "semua") => get("search", { q, filter }),
  suggest: (q) => get("suggest", { q }, { ttl: 60_000 }),
  browse: (id) => get("browse", { id }, { ttl: 10 * 60_000 }),
  next: (videoId, playlistId) => get("next", { videoId, ...(playlistId ? { playlistId } : {}) }),
  lyrics: (videoId, title = "", artist = "") =>
    get("lyrics", { videoId, title, artist }, { ttl: 30 * 60_000 }),
  stream: (videoId) => get("stream", { videoId }, { ttl: 60_000 }),
};

export const YT_EMBED = "https://www.youtube.com/embed/";
