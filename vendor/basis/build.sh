# Dựng lại bộ giải Basis không eval — xem NGUON.md.
# Chạy trong emscripten/emsdk:3.1.64@sha256:8847dad4171ebc8a53d9ae5cda86a2546ef5b2e68834c14dc1ba2b2962e125cc
# /src = clone basis_universal ở commit 051ad6d (tag v1_50_0), gắn chỉ đọc. Đối số 1 = thư mục ra (mặc định /out).
set -eu
OUT="${1:-/out}"
EXPECTED_COMMIT=051ad6d8a64bb95a79e8601c317055fd1782ad3e

# Tag git đẩy lại được; commit thì không. Lệch là dừng, không dựng nhầm nguồn.
ACTUAL_COMMIT="$(git -c safe.directory='*' -C /src rev-parse HEAD)"
if [ "$ACTUAL_COMMIT" != "$EXPECTED_COMMIT" ]; then
  echo "Sai nguồn: /src ở $ACTUAL_COMMIT, cần $EXPECTED_COMMIT" >&2
  exit 1
fi

# Đúng định nghĩa và cờ biên dịch CMakeLists.txt của tag áp cho MỌI nguồn của target,
# kể cả zstd (C, nên không có -std=c++11).
DEFS="-DNDEBUG -DBASISD_SUPPORT_UASTC_HDR=1 -DBASISD_SUPPORT_UASTC=1 -DBASISD_SUPPORT_BC7=1 -DBASISD_SUPPORT_ATC=0 -DBASISD_SUPPORT_ASTC_HIGHER_OPAQUE_QUALITY=0 -DBASISD_SUPPORT_PVRTC2=0 -DBASISD_SUPPORT_FXT1=0 -DBASISD_SUPPORT_ETC2_EAC_RG11=0 -DBASISU_SUPPORT_ENCODING=0 -DBASISD_ENABLE_DEBUG_FLAGS=1 -DBASISD_SUPPORT_KTX2=1 -DBASISD_SUPPORT_KTX2_ZSTD=1"
CFLAGS="-O3 -fno-strict-aliasing $DEFS -I../../transcoder"

cd /src/webgl/transcoder
mkdir -p "$OUT" /tmp/obj
em++ -std=c++11 $CFLAGS -c ../../transcoder/basisu_transcoder.cpp -o /tmp/obj/t.o
em++ -std=c++11 $CFLAGS -c basis_wrappers.cpp -o /tmp/obj/w.o
emcc $CFLAGS -c ../../zstd/zstddeclib.c -o /tmp/obj/z.o

# LINK_FLAGS của tag, thêm đúng một cờ cuối: -sDYNAMIC_EXECUTION=0.
em++ /tmp/obj/t.o /tmp/obj/w.o /tmp/obj/z.o -o "$OUT/basis_transcoder.js" \
  --bind -s ALLOW_MEMORY_GROWTH=1 -O3 -s ASSERTIONS=0 -s MALLOC=emmalloc -s MODULARIZE=1 -s EXPORT_NAME=BASIS \
  -sDYNAMIC_EXECUTION=0
sha256sum "$OUT"/basis_transcoder.*
