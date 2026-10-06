# Dựng lại bộ giải Basis không eval — xem NGUON.md. Chạy trong emscripten/emsdk:3.1.64,
# /src = clone basis_universal ở tag v1_50_0 (chỉ đọc), /out = thư mục ra.
set -e
cd /src/webgl/transcoder
mkdir -p /out
em++ -std=c++11 -O3 -fno-strict-aliasing -DNDEBUG -DBASISD_SUPPORT_UASTC_HDR=1 -DBASISD_SUPPORT_UASTC=1 -DBASISD_SUPPORT_BC7=1 -DBASISD_SUPPORT_ATC=0 -DBASISD_SUPPORT_ASTC_HIGHER_OPAQUE_QUALITY=0 -DBASISD_SUPPORT_PVRTC2=0 -DBASISD_SUPPORT_FXT1=0 -DBASISD_SUPPORT_ETC2_EAC_RG11=0 -DBASISU_SUPPORT_ENCODING=0 -DBASISD_ENABLE_DEBUG_FLAGS=1 -DBASISD_SUPPORT_KTX2=1 -DBASISD_SUPPORT_KTX2_ZSTD=1 -I../../transcoder -c ../../transcoder/basisu_transcoder.cpp -o /tmp/t.o
em++ -std=c++11 -O3 -fno-strict-aliasing -DNDEBUG -DBASISD_SUPPORT_UASTC_HDR=1 -DBASISD_SUPPORT_UASTC=1 -DBASISD_SUPPORT_BC7=1 -DBASISD_SUPPORT_ATC=0 -DBASISD_SUPPORT_ASTC_HIGHER_OPAQUE_QUALITY=0 -DBASISD_SUPPORT_PVRTC2=0 -DBASISD_SUPPORT_FXT1=0 -DBASISD_SUPPORT_ETC2_EAC_RG11=0 -DBASISU_SUPPORT_ENCODING=0 -DBASISD_ENABLE_DEBUG_FLAGS=1 -DBASISD_SUPPORT_KTX2=1 -DBASISD_SUPPORT_KTX2_ZSTD=1 -I../../transcoder -c basis_wrappers.cpp -o /tmp/w.o
emcc -O3 -DNDEBUG -c ../../zstd/zstddeclib.c -o /tmp/z.o
em++ /tmp/t.o /tmp/w.o /tmp/z.o -o /out/basis_transcoder.js --bind -s ALLOW_MEMORY_GROWTH=1 -O3 -s ASSERTIONS=0 -s MALLOC=emmalloc -s MODULARIZE=1 -s EXPORT_NAME=BASIS -sDYNAMIC_EXECUTION=0
ls -l /out
