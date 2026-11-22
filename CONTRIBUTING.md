# Kontribusi

Terima kasih sudah tertarik berkontribusi pada Auralys!

## Alur kerja

1. Fork repo, lalu clone: `git clone https://github.com/<username>/auralys.git`
2. Buat branch: `git checkout -b fitur/nama-fitur`
3. Pasang dependensi: `npm install`
4. Jalankan mode pengembangan: `npm run dev` (http://localhost:8080)
5. Commit dengan pesan jelas: `feat: tambahkan ...` / `fix: perbaiki ...`
6. Push dan buka Pull Request.

## Standar kode

- ES Modules, tanpa framework frontend (vanilla JS) — jaga ukuran tetap ringan.
- Frontend di `public/js/*`, backend di `server.mjs` dan `lib/*`.
- Bahasa antarmuka: **Indonesia**; nama variabel/kode: Inggris.
- Jalankan `node --check` pada berkas yang diubah (CI juga melakukannya).

## Melaporkan bug

Sertakan: langkah reproduksi, perilaku yang diharapkan, tangkapan layar (bila ada),
jenis perangkat/browser, dan pesan error dari Console.
