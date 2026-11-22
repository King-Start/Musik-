// lyrics.mjs — lirik dari LRCLIB (lirik publik, mendukung lirik tersinkron LRC)
const UA = "Auralys/1.0 (https://example.invalid)";

async function j(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

const clean = (s) =>
  String(s || "")
    .replace(/\(.*?\)|\[.*?\]|official|lyric|lyrics|video|music|mv|hd|4k/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function findLyrics({ artist, title }) {
  if (!title) return { plain: null, synced: null, source: null };
  const a = clean(artist);
  const t = clean(title);

  // 1) pencocokan persis
  if (a) {
    const exact = await j(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(t)}`
    );
    if (exact?.plainLyrics || exact?.syncedLyrics)
      return { plain: exact.plainLyrics, synced: exact.syncedLyrics, source: "lrclib", title: exact.trackName, artist: exact.artistName };
  }

  // 2) pencarian
  const q = encodeURIComponent(`${t} ${a}`.trim());
  const list = await j(`https://lrclib.net/api/search?q=${q}`);
  if (Array.isArray(list) && list.length) {
    const best =
      list.find((x) => x.syncedLyrics && x.trackName?.toLowerCase().includes(t.toLowerCase())) ||
      list.find((x) => x.plainLyrics) ||
      list[0];
    if (best?.plainLyrics || best?.syncedLyrics)
      return { plain: best.plainLyrics, synced: best.syncedLyrics, source: "lrclib", title: best.trackName, artist: best.artistName };
  }
  return { plain: null, synced: null, source: null };
}
