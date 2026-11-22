#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build-apk.sh — build APK Auralys tanpa Android Studio / Gradle.
# Butuh: JDK 17, Android SDK (platform 34 + build-tools 34), zip.
#
# Pemakaian:
#   ./build-apk.sh                 # pakai nama paket default app.auralys.music
#   ./build-apk.sh app.auralys.music 1.0.0
#   SKIP_SIGN=1 ./build-apk.sh     # hasil APK tanpa tanda tangan
#
# Hasil: android/build/Auralys-debug.apk  (sudah ditandatangani & siap install)
# ---------------------------------------------------------------------------
set -euo pipefail

PKG="${1:-app.auralys.music}"
VERSION="${2:-1.0.0}"
VERSION_CODE="${VERSION_CODE:-1}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
OUT="$HERE/build"
WORK="$OUT/tmp"
APK_NAME="Auralys"

if [ ! -f "$PLATFORM" ]; then
  echo "✖ Android platform 34 tidak ditemukan di $PLATFORM"
  echo "  Jalankan: sdkmanager 'platforms;android-34' 'build-tools;34.0.0'"
  exit 1
fi
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/jdk17" ]; then
  export JAVA_HOME="$HOME/jdk17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if ! command -v javac >/dev/null; then
  echo "✖ javac tidak ditemukan (butuh JDK 17)"; exit 1
fi
command -v zip >/dev/null || { echo "✖ butuh perintah 'zip'"; exit 1; }

echo "▶ Bersihkan output lama"
rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$WORK"

echo "▶ 1/6 aapt2: kompilasi resource"
"$BT/aapt2" compile --dir "$HERE/src/main/res" -o "$OUT/res.zip"

echo "▶ 2/6 aapt2: tautkan resource + AndroidManifest"
# aapt2 mewajibkan atribut package; disuntikkan sementara ke manifest salinan
MANIFEST_TMP="$OUT/AndroidManifest.xml"
python3 - "$HERE/src/main/AndroidManifest.xml" "$MANIFEST_TMP" "$PKG" <<'PYEOF'
import sys, re
src, dst, pkg = sys.argv[1], sys.argv[2], sys.argv[3]
xml = open(src, encoding="utf-8").read()
xml = xml.replace("<manifest ", f'<manifest package="{pkg}" ', 1)
open(dst, "w", encoding="utf-8").write(xml)
PYEOF
"$BT/aapt2" link \
  -o "$OUT/app-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$MANIFEST_TMP" \
  --java "$OUT/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION" \
  --auto-add-overlay \
  "$OUT/res.zip"

echo "▶ 3/6 javac: kompilasi Java"
SRC=$(find "$HERE/src/main/java" "$OUT/gen" -name '*.java')
javac -source 11 -target 11 -encoding UTF-8 \
  -classpath "$PLATFORM" \
  -d "$OUT/classes" \
  $SRC
test -f "$OUT/classes/app/auralys/music/MainActivity.class" || { echo "✖ kompilasi gagal"; exit 1; }

echo "▶ 4/6 d8: dex"
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" \
  --output "$WORK" \
  $(find "$OUT/classes" -name '*.class')

echo "▶ 5/6 zip: paket APK"
cp "$OUT/app-unsigned.apk" "$WORK/app.apk"
(cd "$WORK" && zip -q app.apk classes.dex)
"$BT/zipalign" -f -p 4 "$WORK/app.apk" "$OUT/app-aligned.apk"

if [ "${SKIP_SIGN:-0}" = "1" ]; then
  cp "$OUT/app-aligned.apk" "$OUT/${APK_NAME}-unsigned.apk"
  echo "✔ APK tanpa tanda tangan: $OUT/${APK_NAME}-unsigned.apk"
  exit 0
fi

echo "▶ 6/6 apksigner: tanda tangan"
KS="$HERE/keystore/auralys.jks"
PASS="${KEYSTORE_PASS:-auralys2026}"
if [ ! -f "$KS" ]; then
  echo "  • membuat keystore baru (simpan berkas ini agar update APK tetap bisa)"
  mkdir -p "$HERE/keystore"
  keytool -genkeypair -v \
    -keystore "$KS" -storepass "$PASS" -keypass "$PASS" \
    -alias auralys -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Auralys, OU=Mobile, O=Auralys, L=Jakarta, C=ID" >/dev/null 2>&1
fi
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --ks-key-alias auralys \
  --min-sdk-version 24 \
  --out "$OUT/${APK_NAME}.apk" \
  "$OUT/app-aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/${APK_NAME}.apk" | head -4

SIZE=$(du -h "$OUT/${APK_NAME}.apk" | cut -f1)
echo ""
echo "✔ Selesai: $OUT/${APK_NAME}.apk ($SIZE)"
echo "  Install di HP: pindahkan APK → buka → izinkan 'Instal dari sumber tidak dikenal'."
