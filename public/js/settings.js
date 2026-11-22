/* settings.js — halaman Kamu + semua layar pengaturan */
import {
  S, save, esc, toast, resetAll, exportData, importData, confirmSheet, openSheet, applyTheme, emit,
  downloadFile, isAndroidApp, androidBridge,
} from "./core.js";
import { setVolume, setRate } from "./player.js";
import { renderLibrary } from "./library.js";

const set = (k, v) => {
  S.settings[k] = v;
  save();
};

/* ---------------------------- komponen kontrol --------------------------- */
function switchEl(key) {
  return `<span class="switch ${S.settings[key] ? "on" : ""}" data-switch="${key}" role="switch" aria-checked="${!!S.settings[key]}"></span>`;
}
function rowSwitch(key, label, desc = "", icon = null) {
  return `<button class="set-row" data-toggle="${key}">
    ${icon ? window.icon(icon, 22) : ""}
    <span class="txt"><span class="t">${esc(label)}</span>${desc ? `<span class="d">${desc}</span>` : ""}</span>
    ${switchEl(key)}
  </button>`;
}
function rowLink(label, sub, href, icon = null, extra = "") {
  return `<button class="set-row" data-href="${href}">
    ${icon ? window.icon(icon, 22) : ""}
    <span class="txt"><span class="t">${esc(label)}</span></span>
    <span class="val"><span class="v">${esc(sub || "")}</span>${extra}${window.icon("arrowRight", 18)}</span>
  </button>`;
}
function rowValue(label, value, key, icon = null) {
  return `<button class="set-row" data-choice="${key}">
    ${icon ? window.icon(icon, 22) : ""}
    <span class="txt"><span class="t">${esc(label)}</span></span>
    <span class="val"><span class="v">${esc(value)}</span>${window.icon("arrowRight", 18)}</span>
  </button>`;
}
function rowSlider(key, label, sub = "", { min = 0, max = 100, step = 1, fmt = (v) => v, icon = null } = {}) {
  const v = S.settings[key];
  const pct = ((v - min) / (max - min)) * 100;
  return `<div class="set-row stack" data-slider-row="${key}">
    <div class="head">
      ${icon ? window.icon(icon, 22) : ""}
      <span class="txt"><span class="t">${esc(label)}</span>${sub ? `<span class="d">${esc(sub)}</span>` : ""}</span>
      <span class="val"><span class="v" data-slider-val="${key}">${esc(fmt(v))}</span></span>
    </div>
    <div class="slider-row">
      <input type="range" data-slider="${key}" min="${min}" max="${max}" step="${step}" value="${v}" style="--pct:${pct}%" />
    </div>
  </div>`;
}
function group(label) {
  return label ? `<div class="set-group-label">${esc(label)}</div>` : "";
}
function card(inner) {
  return `<div class="set-card">${inner}</div>`;
}

const CHOICES = {
  kualitasAudio: ["Otomatis", "Selalu tinggi", "Selalu rendah", "Hanya audio", "Hanya Wi-Fi"],
  tingkatKelantangan: ["Rendah (-14 dB)", "Sedang (-11 dB)", "Agresif (-7 dB)"],
  gayaMiniPlayer: ["Ikuti tema", "Terang", "Gelap", "Transparan"],
  gayaPemutar: ["Ikuti tema", "Terang", "Gelap", "Dinamis"],
  warnaTombolPemutar: ["Bawaan", "Putih", "Hitam", "Dinamis"],
  gayaSlider: ["Bawaan", "Garis tipis", "Gelombang"],
  bahasaKonten: ["Bawaan sistem", "Indonesia", "Inggris", "Melayu", "Jawa"],
  negaraKonten: ["Bawaan sistem", "Indonesia", "Malaysia", "Singapura", "Amerika Serikat"],
  bahasaAplikasi: ["Indonesia", "English", "Melayu", "Jawa", "Sunda"],
  posisiPlaylist: ["Awal playlist", "Akhir playlist"],
  tema: ["ikuti sistem", "terang", "gelap", "hitam"],
  kualitasUnduhan: ["Otomatis (disarankan)", "Selalu tinggi", "Selalu rendah"],
};

/* ------------------------------- halaman Kamu ---------------------------- */
export function renderYou(root, nav) {
  root.innerHTML = `
    <div class="page">
      <div class="prof-head">
        <div class="prof-avatar">${esc(S.settings.namaAkun.slice(0, 1).toUpperCase())}</div>
        <div><h2>${esc(S.settings.namaAkun)}</h2><div class="mail">bukan.bukan@auralys.app</div></div>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${S.liked.length}</b><span>Disukai</span></div>
        <div class="stat"><b>${S.playlists.length}</b><span>Playlist</span></div>
        <div class="stat"><b>${S.history.length}</b><span>Diputar</span></div>
      </div>
      <div class="set-group-label">Playlist cepat</div>
      <div class="chips">
        <button class="chip" data-quick="liked">Disukai</button>
        <button class="chip" data-quick="history">Diputar terakhir</button>
        <button class="chip" data-quick="downloads">Diunduh</button>
      </div>
      <div class="set-group-label">Pengaturan</div>
      <div class="set-card">
        <button class="set-row" data-href="/settings/account">
          ${window.icon("user", 22)}<span class="txt"><span class="t">${esc(S.settings.namaAkun)}</span><span class="d">Sinkronkan lagu disukai, pustaka, dan playlist</span></span>
          ${window.icon("arrowRight", 18)}
        </button>
        ${rowSwitch("sinkronOtomatis", "Sinkronisasi otomatis dengan akun", "", "refresh")}
      </div>
      <div class="set-card" style="margin-top:14px">
        ${rowLink("Suara dan pemutaran", "", "/settings/audio", "play")}
        ${rowLink("Tampilan", "", "/settings/appearance", "palette")}
        ${rowLink("Bahasa dan konten", "", "/settings/content", "globe")}
        ${rowLink("Lirik dan terjemahan", "", "/settings/lyrics", "translate")}
      </div>
      <div class="set-card" style="margin-top:14px">
        ${rowLink("Privasi dan riwayat", "", "/settings/privacy", "shield")}
        ${rowLink("Penyimpanan", "", "/settings/storage", "storage")}
        ${rowLink("Cadangan dan impor", "", "/settings/backup", "cloudSync")}
      </div>
      <div class="set-card" style="margin-top:14px">
        ${rowLink("Android Auto", "", "/settings/auto", "car")}
        ${rowLink("Tautan", "", "/settings/links", "link")}
        ${rowLink("Tentang Auralys", "v1.0.0", "/settings/about", "info")}
      </div>
      <div style="height:130px"></div>
    </div>`;

  root.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => nav(`/library/${b.dataset.quick}`))
  );
  root.querySelectorAll("[data-href]").forEach((b) =>
    b.addEventListener("click", () => nav(b.dataset.href))
  );
  bindToggles(root);
  nav.setTitle("Kamu", true);
}

/* ------------------------------ Suara & audio ---------------------------- */
export function renderAudio(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Pemutar")}
      ${card(
        rowValue("Kualitas audio", S.settings.kualitasAudio, "kualitasAudio", "equalizer") +
          rowSwitch("modeHematData", "Mode hemat data", "Memutar dengan kualitas audio rendah, tanpa sampul bergerak, dan tanpa unduhan sampul di latar. Lagu yang kamu unduh tetap memakai kualitas pilihanmu.", "storage") +
          rowSwitch("crossfade", "Crossfade", "", "wave") +
          rowSlider("durasiRiwayat", "Durasi riwayat", "Detik", { min: 0, max: 120, step: 1, fmt: (v) => `${v} detik`, icon: "history" }) +
          rowSwitch("lewatiKeheningan", "Lewati keheningan", "", "playNext") +
          rowSwitch("lewatiKeheninganSeketika", "Lewati keheningan seketika", "Langsung melompati bagian hening alih-alih mempercepat pemutaran", "next") +
          rowSwitch("normalisasiAudio", "Normalisasi audio", "", "volume") +
          rowValue("Tingkat kelantangan", S.settings.tingkatKelantangan, "tingkatKelantangan", "volume") +
          rowSwitch("aktifkanAudioOffload", "Aktifkan audio offload", "Menggunakan jalur audio offload perangkat keras untuk pemutaran. Menonaktifkan ini dapat meningkatkan penggunaan baterai, tetapi dapat membantu jika mengalami masalah pemutaran atau pemrosesan audio.", "wave") +
          rowSwitch("aktifkanVarispeed", "Aktifkan varispeed", "Kaitkan nada dengan kecepatan pemutaran, menghasilkan efek percepatan dan perlambatan ala kaset", "speed")
      )}
      ${group("Antrean")}
      ${card(
        rowSwitch("aktifkanKontenSerupa", "Aktifkan konten serupa", "", "sparkle") +
          rowSwitch("pertahankanAcak", "Pertahankan acak yang sedang aktif saat memulai lagu atau playlist baru", "", "shuffle") +
          rowSwitch("ingatStatusAcakUlang", "Ingat status acak dan ulang", "", "repeat") +
          rowSwitch("acakPlaylistDahulu", "Acak playlist atau album terlebih dahulu", "Saat mengacak, putar semua lagu dari playlist atau album saat ini sebelum beralih ke konten serupa", "shuffle") +
          rowSwitch("cegahLaguSama", "Cegah lagu yang sama di antrean", "Saat menambahkan lagu yang sudah ada di antrean, lagu tersebut akan dipindahkan dari posisi sebelumnya daripada ditambahkan lagi", "queue") +
          rowSwitch("lewatiOtomatisKesalahan", "Lewati otomatis jika terjadi kesalahan", "", "next")
      )}
      ${group("Lainnya")}
      ${card(
        rowSwitch("hentikanSaatDitutup", "Hentikan musik saat aplikasi ditutup", "", "close") +
          rowSwitch("jedaSaatDibisukan", "Jeda musik saat media dibisukan", "", "volume") +
          rowSwitch("lanjutkanBluetooth", "Lanjutkan saat Bluetooth tersambung", "", "cast") +
          rowSwitch("jagaLayarMenyala", "Jaga layar tetap menyala saat pemutar dibuka", "", "device") +
          rowSwitch("sampulAnimasi", "Sampul animasi", "Video pendek tanpa suara diputar berulang di atas sampul pada pemutar penuh jika tersedia. Data dan baterai tambahan akan terpakai.", "video") +
          rowSwitch("modeVideo", "Mode video", "", "video") +
          rowSwitch("putarVideoOtomatis", "Putar video otomatis dari hasil Video", "", "play")
      )}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  nav.setTitle("Pemutar dan audio");
}

/* -------------------------------- Tampilan ------------------------------- */
export function renderAppearance(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Tampilan mini-player")}
      ${card(
        rowSwitch("desainMiniPlayerBaru", "Desain mini-player baru", "", "play") +
          rowValue("Gaya latar belakang mini-player", S.settings.gayaMiniPlayer, "gayaMiniPlayer", "palette")
      )}
      ${group("Pemutar")}
      ${card(
        rowSwitch("desainPemutarBaru", "Desain pemutar baru", "", "play") +
          rowValue("Gaya latar pemutar", S.settings.gayaPemutar, "gayaPemutar", "palette") +
          rowSwitch("sembunyikanThumbnail", "Sembunyikan thumbnail pemutar", "Ganti gambar album dengan logo aplikasi di pemutar", "wifiOff") +
          rowSwitch("sampulLayarPenuh", "Sampul layar penuh", "", "device") +
          rowSwitch("pangkasSampulAlbum", "Pangkas sampul album", "Paksa rasio aspek persegi dengan memangkas thumbnail video", "grid") +
          rowValue("Warna tombol pemutar", S.settings.warnaTombolPemutar, "warnaTombolPemutar", "palette") +
          rowValue("Gaya slider pemutar", S.settings.gayaSlider, "gayaSlider", "sliders") +
          rowSwitch("geserGantiLagu", "Geser untuk ganti lagu", "", "shuffle") +
          rowSlider("sensitivitasGeser", "Sensitivitas geser mini-player", "", { min: 10, max: 95, step: 1, fmt: (v) => `${v}%` })
      )}
      ${group("Tema")}
      ${card(rowValue("Tema aplikasi", S.settings.tema, "tema", "moon"))}
      ${group("Lirik")}
      ${card(rowSwitch("lirikEksperimental", "Lirik eksperimental", "", "lyrics"))}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  nav.setTitle("Tampilan");
}

/* --------------------------- Bahasa dan konten --------------------------- */
export function renderContent(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Umum")}
      ${card(
        rowValue("Bahasa konten bawaan", S.settings.bahasaKonten, "bahasaKonten", "globe") +
          rowValue("Negara konten bawaan", S.settings.negaraKonten, "negaraKonten", "pin") +
          rowSwitch("sembunyikanEksplisit", "Sembunyikan konten eksplisit", "", "explicit") +
          rowSwitch("sembunyikanVideoMusik", "Sembunyikan video musik", "", "video") +
          rowSwitch("sembunyikanVideoPencarian", "Sembunyikan video di hasil pencarian", "", "search") +
          rowSwitch("utamakanVersiAudio", "Utamakan versi audio", "", "music") +
          rowSwitch("sembunyikanShorts", "Sembunyikan YouTube Shorts", "", "wifiOff")
      )}
      ${group("Playlist")}
      ${card(rowValue("Posisi penambahan di playlist", S.settings.posisiPlaylist, "posisiPlaylist", "playlist"))}
      ${group("Halaman artis")}
      ${card(
        rowSwitch("tampilkanDeskripsiArtis", "Tampilkan deskripsi artis", "", "info") +
          rowSwitch("tampilkanPelanggan", "Tampilkan jumlah pelanggan", "", "user") +
          rowSwitch("tampilkanPendengarBulanan", "Tampilkan jumlah pendengar bulanan", "", "people")
      )}
      ${group("Bahasa aplikasi")}
      ${card(
        rowValue("Bahasa antarmuka", S.settings.bahasaAplikasi, "bahasaAplikasi", "translate") +
          rowSwitch("terjemahanLirik", "Terjemahan lirik", "", "translate")
      )}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  nav.setTitle("Bahasa dan konten");
}

/* ---------------------------- Lirik terjemahan --------------------------- */
export function renderLyricsSettings(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Lirik")}
      ${card(
        rowSwitch("lirikEksperimental", "Lirik eksperimental", "Tampilkan lirik dengan animasi per baris", "lyrics") +
          rowSwitch("terjemahanLirik", "Terjemahan lirik otomatis", "Terjemahkan lirik ke bahasa aplikasi", "translate")
      )}
      ${group("Tampilan lirik")}
      ${card(rowSlider("ukuranLirik", "Ukuran teks lirik", "", { min: 80, max: 150, step: 5, fmt: (v) => `${v}%`, icon: "note" }))}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  nav.setTitle("Lirik dan terjemahan");
}

/* -------------------------- Privasi dan riwayat -------------------------- */
export function renderPrivacy(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Riwayat")}
      ${card(
        rowSwitch("simpanRiwayat", "Simpan riwayat pemutaran", "Dipakai untuk rekomendasi dan halaman Diputar terakhir", "history") +
          rowSwitch("jedaRiwayatPlaylist", "Jeda riwayat saat memutar playlist", "", "queue")
      )}
      <div class="set-card" style="margin-top:14px">
        <button class="set-row" id="clear-history">${window.icon("trash", 22)}<span class="txt"><span class="t">Hapus riwayat pemutaran</span></span></button>
        <button class="set-row" id="clear-search">${window.icon("trash", 22)}<span class="txt"><span class="t">Hapus riwayat pencarian</span></span></button>
      </div>
      ${group("Data")}
      ${card(rowLink("Kebijakan privasi", "", "/settings/about", "shield"))}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#clear-history").addEventListener("click", () =>
    confirmSheet("Hapus riwayat?", "Semua riwayat pemutaran akan dihapus.", "Hapus", () => {
      S.history = [];
      save();
      toast("Riwayat dihapus");
    }, true)
  );
  root.querySelector("#clear-search").addEventListener("click", () => {
    S.recentSearches = [];
    save();
    toast("Riwayat pencarian dihapus");
  });
  nav.setTitle("Privasi dan riwayat");
}

/* ------------------------------- Penyimpanan ----------------------------- */
export function renderStorage(root, nav) {
  const est = (S.downloads.length * 4.2 + S.cached.length * 3.1 + 12).toFixed(1);
  root.innerHTML = `
    <div class="page settings">
      ${group("Penyimpanan")}
      ${card(
        `<div class="set-row"><span class="txt"><span class="t">Perkiraan pemakaian</span><span class="d">${est} MB • ${S.downloads.length} lagu diunduh, ${S.cached.length} lagu di cache</span></span></div>` +
          rowValue("Kualitas unduhan", S.settings.kualitasUnduhan, "kualitasUnduhan", "download") +
          rowSwitch("unduhViaWifi", "Unduh hanya lewat Wi-Fi", "", "wifiOff")
      )}
      <div class="set-card" style="margin-top:14px">
        <button class="set-row" id="clear-cache">${window.icon("trash", 22)}<span class="txt"><span class="t">Hapus cache</span><span class="d">${S.cached.length} lagu tersimpan</span></span></button>
        <button class="set-row" id="clear-dl">${window.icon("trash", 22)}<span class="txt"><span class="t">Hapus semua unduhan</span><span class="d">${S.downloads.length} lagu</span></span></button>
      </div>
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#clear-cache").addEventListener("click", () => {
    S.cached = [];
    save();
    toast("Cache dibersihkan");
    renderStorage(root, nav);
  });
  root.querySelector("#clear-dl").addEventListener("click", () =>
    confirmSheet("Hapus semua unduhan?", "Lagu offline akan dihapus dari perangkat.", "Hapus", () => {
      S.downloads = [];
      save();
      toast("Unduhan dihapus");
      renderStorage(root, nav);
    }, true)
  );
  nav.setTitle("Penyimpanan");
}

/* ---------------------------- Cadangan dan impor ------------------------- */
export function renderBackup(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Cadangkan data")}
      ${card(
        `<button class="set-row" id="exp">${window.icon("download", 22)}<span class="txt"><span class="t">Ekspor data ke file</span><span class="d">Playlist, lagu disukai, pengaturan</span></span></button>` +
          `<button class="set-row" id="imp">${window.icon("upload", 22)}<span class="txt"><span class="t">Impor dari file</span></span></button>` +
          `<button class="set-row" id="copy">${window.icon("share", 22)}<span class="txt"><span class="t">Salin data ke clipboard</span></span></button>`
      )}
      ${group("Reset")}
      ${card(`<button class="set-row" id="reset" style="color:#d3304b">${window.icon("trash", 22)}<span class="txt"><span class="t">Setel ulang aplikasi</span><span class="d">Hapus semua data lokal dan pengaturan</span></span></button>`)}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#exp").addEventListener("click", () => {
    const saved = downloadFile(
      `auralys-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportData()
    );
    toast(saved ? "Tersimpan di folder Downloads" : "Cadangan diunduh");
  });
  root.querySelector("#imp").addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        importData(await f.text());
        toast("Data berhasil diimpor");
        setTimeout(() => location.reload(), 700);
      } catch {
        toast("File tidak valid");
      }
    };
    inp.click();
  });
  root.querySelector("#copy").addEventListener("click", () => {
    navigator.clipboard?.writeText(exportData()).then(() => toast("Data disalin"), () => toast("Gagal menyalin"));
  });
  root.querySelector("#reset").addEventListener("click", () =>
    confirmSheet("Setel ulang aplikasi?", "Semua playlist, lagu disukai, dan pengaturan akan dihapus.", "Setel ulang", resetAll, true)
  );
  nav.setTitle("Cadangan dan impor");
}

/* ------------------------------ Android Auto ---------------------------- */
export function renderAuto(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Bagian yang terlihat")}
      <div class="pad" style="color:var(--text-2);font-size:13px;line-height:1.55;margin-bottom:10px">
        Ketuk bagian untuk mengaktifkan atau menonaktifkannya. Tekan lama gagang seret untuk mengurutkan ulang.
        Bagian pertama akan ditampilkan secara default.
      </div>
      ${card(
        S.settings.autoSections
          .map(
            (s, i) => `<div class="set-row" data-auto="${s.id}">
              <span class="handle" draggable="true" data-drag="${i}">${window.icon("list", 20)}</span>
              ${window.icon(s.id === "disukai" ? "heart" : s.id === "lagu" ? "music" : s.id === "artis" ? "user" : s.id === "album" ? "music" : "queue", 21)}
              <span class="txt"><span class="t">${esc(s.label)}</span></span>
              ${switchEl("auto_" + s.id)}
            </div>`
          )
          .join("")
      )}
      <div class="set-card" style="margin-top:14px">
        ${rowValue("Tujuan tambah cepat", S.settings.tujuanTambahCepat, "tujuanTambahCepat", "plus")}
      </div>
      ${group("Mix")}
      ${card(rowSwitch("tampilkanPlaylistYouTube", "Tampilkan playlist yang disarankan YouTube", "", "queue"))}
      ${group("Opsi pencarian")}
      ${card(
        rowSlider("batasPencarianMusik", "Batas pencarian musik", "Batasi jumlah lagu lokal yang ditampilkan dalam hasil pencarian. Disarankan untuk tidak mengaturnya menjadi tanpa batas agar aplikasi tidak mengalami crash karena kehabisan memori.", { min: 25, max: 200, step: 25, fmt: (v) => `${v} Lagu`, icon: "search" })
      )}
      <div style="height:120px"></div>
    </div>`;

  // switch untuk bagian auto
  root.querySelectorAll("[data-auto]").forEach((row) => {
    const id = row.dataset.auto;
    const sec = S.settings.autoSections.find((x) => x.id === id);
    const sw = row.querySelector(".switch");
    sw.classList.toggle("on", !!sec.on);
    row.addEventListener("click", (e) => {
      if (e.target.closest(".handle")) return;
      sec.on = !sec.on;
      sw.classList.toggle("on", sec.on);
      save();
    });
  });
  // drag urutan
  let dragIdx = null;
  root.querySelectorAll("[data-drag]").forEach((h) => {
    h.addEventListener("dragstart", () => (dragIdx = +h.dataset.drag));
    h.addEventListener("dragend", () => (dragIdx = null));
  });
  root.querySelectorAll("[data-auto]").forEach((row) => {
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragIdx == null) return;
      const targetId = row.dataset.auto;
      const to = S.settings.autoSections.findIndex((x) => x.id === targetId);
      const [moved] = S.settings.autoSections.splice(dragIdx, 1);
      S.settings.autoSections.splice(to, 0, moved);
      save();
      renderAuto(root, nav);
    });
  });
  bindSettings(root, nav);
  nav.setTitle("Android Auto");
}

/* --------------------------------- Tautan ------------------------------- */
export function renderLinks(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      ${group("Tautan aplikasi")}
      ${card(
        `<div class="pad" style="padding:16px 16px;font-size:13.5px;color:var(--text-2);line-height:1.6">
          Auralys terhubung dengan YouTube Music untuk katalog dan pemutaran. Kamu bisa membuka aplikasi lain untuk memutar musik yang sama.
        </div>`
      )}
      <div class="set-card" style="margin-top:14px">
        <a class="set-row" href="https://music.youtube.com" target="_blank" rel="noopener">${window.icon("link", 22)}<span class="txt"><span class="t">Buka YouTube Music</span></span>${window.icon("arrowRight", 18)}</a>
        <a class="set-row" href="https://www.youtube.com" target="_blank" rel="noopener">${window.icon("link", 22)}<span class="txt"><span class="t">Buka YouTube</span></span>${window.icon("arrowRight", 18)}</a>
        <button class="set-row" id="share-app">${window.icon("share", 22)}<span class="txt"><span class="t">Bagikan aplikasi ini</span></span></button>
      </div>
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#share-app").addEventListener("click", () => {
    if (navigator.share) navigator.share({ title: "Auralys", url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(location.href).then(() => toast("Tautan disalin"));
  });
  nav.setTitle("Tautan");
}

/* --------------------------------- Tentang ------------------------------ */
export function renderAbout(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      <div style="display:grid;place-items:center;gap:10px;padding:26px 0 6px">
        <div style="color:var(--text)">${window.icon("wave", 54)}</div>
        <div style="font-size:20px;font-weight:600">Auralys</div>
        <div style="font-size:12.5px;color:var(--text-2)">Versi 1.0.0 (build 2026.11)</div>
      </div>
      ${group("Tentang")}
      ${card(
        `<div class="pad" style="padding:16px;font-size:13.5px;line-height:1.7;color:var(--text-2)">
          Auralys adalah pemutar musik modern dengan katalog YouTube Music. Dibuat sebagai aplikasi web progresif —
          bisa dipasang ke layar utama dan dipakai seperti aplikasi biasa.
          <br><br>
          <b style="color:var(--text)">Catatan:</b> pemutaran audio memakai pemutar resmi YouTube (IFrame Player),
          sehingga dibutuhkan koneksi internet. Data pribadi (playlist, lagu disukai, pengaturan) hanya disimpan di
          perangkatmu.
        </div>`
      )}
      ${
        isAndroidApp()
          ? `<div class="set-card" style="margin-top:14px">
               ${`<button class="set-row" data-href="/settings/server">${window.icon("link", 22)}<span class="txt"><span class="t">Server aplikasi</span><span class="d">${esc(androidBridge()?.getServerUrl?.() || "")}</span></span>${window.icon("arrowRight", 18)}</button>`}
             </div>`
          : ""
      }
      <div class="set-card" style="margin-top:14px">
        ${rowLink("Kebijakan privasi", "", "/settings/privacy", "shield")}
        ${rowLink("Sumber terbuka", "", "/settings/about", "link")}
      </div>
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  nav.setTitle("Tentang Auralys");
}

/* ---------------------------- Server aplikasi (APK) --------------------- */
export function renderServerInfo(root, nav) {
  const bridge = androidBridge();
  const url = bridge?.getServerUrl?.() || "—";
  const version = bridge?.getVersion?.() || "1.0.0";
  root.innerHTML = `
    <div class="page settings">
      ${group("Aplikasi Android")}
      ${card(
        `<div class="set-row"><span class="txt"><span class="t">Alamat server</span><span class="d">${esc(url)}</span></span></div>` +
          `<div class="set-row"><span class="txt"><span class="t">Versi aplikasi</span><span class="d">${esc(version)}</span></span></div>` +
          (bridge?.openSettings
            ? `<button class="set-row" id="change-server">${window.icon("link", 22)}<span class="txt"><span class="t">Ubah alamat server</span><span class="d">Bila alamat deploy berubah</span></span>${window.icon("arrowRight", 18)}</button>`
            : "")
      )}
      ${group("Tentang")}
      ${card(
        `<div class="pad" style="padding:16px;font-size:13px;line-height:1.7;color:var(--text-2)">
          Versi Android ini adalah pembungkus (WebView) dari aplikasi web Auralys.
          Semua data — playlist, lagu disukai, riwayat, pengaturan — tersimpan di perangkat.
          Musik diputar melalui pemutar resmi YouTube, jadi butuh koneksi internet.
        </div>`
      )}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#change-server")?.addEventListener("click", () => bridge.openSettings());
  nav.setTitle("Server aplikasi");
}

/* --------------------------------- Akun --------------------------------- */
export function renderAccount(root, nav) {
  root.innerHTML = `
    <div class="page settings">
      <div class="prof-head" style="padding-top:6px">
        <div class="prof-avatar">${esc(S.settings.namaAkun.slice(0, 1).toUpperCase())}</div>
        <div><h2 style="font-size:20px">${esc(S.settings.namaAkun)}</h2><div class="mail">Akun lokal di perangkat ini</div></div>
      </div>
      ${card(
        rowSwitch("sinkronOtomatis", "Sinkronisasi otomatis dengan akun", "", "refresh") +
          `<button class="set-row" id="rename">${window.icon("edit", 22)}<span class="txt"><span class="t">Ubah nama profil</span></span></button>` +
          `<button class="set-row" id="out" style="color:#d3304b">${window.icon("logout", 22)}<span class="txt"><span class="t">Keluar</span></span></button>`
      )}
      <div style="height:120px"></div>
    </div>`;
  bindSettings(root, nav);
  root.querySelector("#rename").addEventListener("click", () => {
    const n = prompt("Nama profil:", S.settings.namaAkun);
    if (n) {
      set("namaAkun", n);
      renderAccount(root, nav);
      toast("Nama diperbarui");
    }
  });
  root.querySelector("#out").addEventListener("click", () =>
    confirmSheet("Keluar?", "Data lokal tetap tersimpan di perangkat ini.", "Keluar", () => toast("Kamu sudah keluar (mode tamu)"), true)
  );
  nav.setTitle("Akun");
}

/* ------------------------- binding umum untuk setting ------------------- */
export function bindSettings(root, nav) {
  bindToggles(root);

  root.querySelectorAll("[data-toggle]").forEach((row) => {
    row.addEventListener("click", () => {
      const key = row.dataset.toggle;
      S.settings[key] = !S.settings[key];
      save();
      const sw = row.querySelector(".switch");
      sw?.classList.toggle("on", S.settings[key]);
      sw?.setAttribute("aria-checked", String(!!S.settings[key]));
      if (key === "tema") applyTheme();
      emit("settings", { key, value: S.settings[key] });
    });
  });

  root.querySelectorAll("[data-choice]").forEach((row) => {
    row.addEventListener("click", () => {
      const key = row.dataset.choice;
      const opts = CHOICES[key] || ["Aktif", "Nonaktif"];
      openSheet("Pilih " + key.replace(/([A-Z])/g, " $1").toLowerCase(), opts.map((o) => ({
        label: o,
        check: String(S.settings[key]) === o,
        onClick: () => {
          S.settings[key] = o;
          save();
          const valEl = row.querySelector(".val .v");
          if (valEl) valEl.textContent = o;
          if (key === "tema") applyTheme();
          toast("Disimpan: " + o);
        },
      })));
    });
  });

  root.querySelectorAll("[data-slider]").forEach((inp) => {
    const key = inp.dataset.slider;
    const valEl = root.querySelector(`[data-slider-val="${key}"]`);
    const min = +inp.min;
    const max = +inp.max;
    const update = () => {
      const v = +inp.value;
      inp.style.setProperty("--pct", ((v - min) / (max - min)) * 100 + "%");
      if (valEl) {
        const isPct = key === "sensitivitasGeser" || key === "ukuranLirik";
        const isSongs = key === "batasPencarianMusik";
        const isSec = key === "durasiRiwayat";
        valEl.textContent = isPct ? `${v}%` : isSongs ? `${v} Lagu` : isSec ? `${v} detik` : String(v);
      }
      S.settings[key] = v;
      save();
      if (key === "volume") setVolume(v);
      if (key === "sensitivitasGeser") emit("settings", { key, value: v });
    };
    inp.addEventListener("input", update);
    update();
  });

  root.querySelectorAll("[data-href]").forEach((b) =>
    b.addEventListener("click", () => nav(b.dataset.href))
  );
}

function bindToggles(root) {
  root.querySelectorAll("[data-switch]").forEach((sw) => {
    sw.classList.toggle("on", !!S.settings[sw.dataset.switch]);
  });
}
