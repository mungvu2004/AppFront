# Bộ giải Basis không eval — lấy từ đâu, dựng thế nào, vì sao

`basis_transcoder.{js,wasm}` ở đây là bản **dựng lại** của đúng bộ giải mà `three@0.186.0` đóng gói
(`three/examples/jsm/libs/basis/`), chỉ khác một cờ: `-sDYNAMIC_EXECUTION=0`.
`scripts/copy-pascal-assets.mjs` chép hai tệp này vào `public/basis/`.

## Vì sao (FIX-380)

CSP thật của nginx (`AppBack/deploy/nginx/snippets/security_headers.conf:6`) là
`script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:` — không có `'unsafe-eval'`.
Bản `three` dựng bằng embind mặc định, và embind sinh hàm gọi bằng `newFunc(Function, args)`
(`basis_transcoder.js:9`, 3 chỗ). `KTX2Loader` nhét tệp ấy vào một worker blob; worker thừa hưởng CSP
của trang nên ném EvalError ngay lúc đăng ký lớp, `onRuntimeInitialized` không bao giờ gọi, và mọi
promise texture `.ktx2` **treo im lặng** — tường/sàn ra màu phẳng, không một dòng báo nào. Chuỗi e2e
FE+BE thật F-14 đo được 4 pageerror như thế.

`-sDYNAMIC_EXECUTION=0` bắt emscripten/embind dùng đường gọi không dựng mã từ chuỗi. Không nới CSP,
không bỏ KTX2 (GLB `KHR_texture_basisu` vẫn cần bộ giải này).

## Nguồn

| | |
|---|---|
| Kho gốc | `https://github.com/BinomialLLC/basis_universal` |
| Tag | `v1_50_0` — commit `051ad6d8a64bb95a79e8601c317055fd1782ad3e` |
| Vì sao tag này | `webgl/transcoder/build/basis_transcoder.{js,wasm}` ở `v1_50_0`, `v1_50_0_2` (`b76a431`) và `v1_50_snapshot` đều **trùng sha256** với bản trong `three@0.186.0` (bảng dưới). `three` nâng lên "Basis Universal v1.50" ở commit `3022402` (2024-09-16). Mã nguồn bộ giải (`transcoder/`, `webgl/transcoder/`, `zstd/`) giữa `v1_50_0` và `v1_50_0_2`: `git diff --stat` rỗng |
| emsdk | Docker `emscripten/emsdk:3.1.64` (digest `sha256:8847dad4171ebc8a53d9ae5cda86a2546ef5b2e68834c14dc1ba2b2962e125cc`). Bản gốc không ghi phiên bản emsdk; 3.1.64 cùng thời (8/2024) |
| Giấy phép | Apache-2.0 — `LICENSE` cạnh tệp này |
| Ngày dựng | 2026-10-06 |

## Cờ

Chép từ `webgl/transcoder/CMakeLists.txt` của tag, thêm đúng một cờ cuối:

- biên dịch: `-std=c++11 -O3 -fno-strict-aliasing -DNDEBUG` + `BASISD_SUPPORT_UASTC_HDR=1
  BASISD_SUPPORT_UASTC=1 BASISD_SUPPORT_BC7=1 BASISD_SUPPORT_ATC=0
  BASISD_SUPPORT_ASTC_HIGHER_OPAQUE_QUALITY=0 BASISD_SUPPORT_PVRTC2=0 BASISD_SUPPORT_FXT1=0
  BASISD_SUPPORT_ETC2_EAC_RG11=0 BASISU_SUPPORT_ENCODING=0 BASISD_ENABLE_DEBUG_FLAGS=1
  BASISD_SUPPORT_KTX2=1 BASISD_SUPPORT_KTX2_ZSTD=1`
- liên kết: `--bind -s ALLOW_MEMORY_GROWTH=1 -O3 -s ASSERTIONS=0 -s MALLOC=emmalloc -s MODULARIZE=1
  -s EXPORT_NAME=BASIS` **`-sDYNAMIC_EXECUTION=0`**

Lệnh đầy đủ ở `build.sh` (gọi `em++`/`emcc` thẳng thay vì CMake — cùng cờ, khỏi cài CMake).

## sha256

| tệp | bản `three@0.186.0` (= tag) | bản dựng lại (ở đây) |
|---|---|---|
| `basis_transcoder.js` | `8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1` · 57 529 B | `a66035597f7d812abae17e800c6704826045e796a3c5c0b5d72a5cdbe3160e5e` · 55 970 B |
| `basis_transcoder.wasm` | `6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a` · 527 333 B | `16bdd9cf0f9613d69f256d618865fa4c419d79184f64021cfe27f5bd34240892` · 527 092 B |

## Kiểm

- **Không còn eval**: `findEvalSites` (`scripts/check-bundle-size.mjs`) trên tệp mới — 0 chỗ (bản cũ: 3,
  `newFunc(`). Mọi `…Function(` còn lại là tên định danh (`craftInvokerFunction`,
  `createNamedFunction`, …). `pnpm size` quét lại `dist/basis` mỗi lượt.
- **So khớp từng byte**: `src/lib/pascal/__tests__/basisTranscoder.test.ts` (chạy trong `pnpm test`,
  ~2 s) giải cả 62 tệp `.ktx2` của `vendor/pascal/assets/material`, mọi mức mip, ở ETC1/BC7/RGBA32,
  bằng bản cũ và bản mới, so sha256 từng ảnh ra — **khớp toàn bộ**.
- **Trên trình duyệt dưới CSP**: bài "dưới CSP" ở `e2e/pascal-viewer.spec.ts`.

## Dựng lại (khi nâng `three`)

1. Xem `three/examples/jsm/libs/basis` đổi chưa; nếu đổi, tìm tag `basis_universal` có
   `webgl/transcoder/build/*` trùng sha256 với bản mới.
2. `git clone --depth 1 --branch <tag> https://github.com/BinomialLLC/basis_universal.git src`
3. Đối chiếu cờ với `src/webgl/transcoder/CMakeLists.txt` của tag, sửa `build.sh` nếu khác.
4. `docker run --rm -v "<src>:/src:ro" -v "<out>:/out" -v "<build.sh>:/build.sh:ro" emscripten/emsdk:<bản> bash /build.sh`
5. Chép `out/basis_transcoder.{js,wasm}` vào đây, cập nhật bảng sha256, chạy
   `pnpm exec vitest run src/lib/pascal/__tests__/basisTranscoder.test.ts` và `pnpm size`.
