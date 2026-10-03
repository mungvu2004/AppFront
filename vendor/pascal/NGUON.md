# Mã Pascal trong repo này — lấy từ đâu, và vì sao nó ở đây

Thư mục này là **mã của AppFront**, không phải một phụ thuộc. Nó được chép vào ngày
**2026-09-28** để đội AppFront tự sửa phần soạn thảo và phần dựng mô hình 3D mà không phải xây lại
từ đầu.

## Nguồn

| | |
|---|---|
| Kho gốc | `https://github.com/pascalorg/editor` |
| Nhánh | `main` |
| Commit | `cd14090ef4d147a5de59aa4a100eab208f26e1da` |
| Ngày commit | 2026-09-27T23:25:31-04:00 |
| Phiên bản gói lúc chép | `1.0.3` |
| Giấy phép | **MIT** — Copyright (c) 2026 Pascal Group Inc. Xem `LICENSE` cạnh tệp này |

**Không có remote nào trỏ về kho gốc.** Lịch sử git của họ không theo vào: chỉ tệp được chép, nên
mọi thay đổi từ đây là lịch sử của AppFront. Bản clone đầy đủ còn ở `F:/pascal-editor` nếu cần tra
lại hoặc lấy thêm thứ gì.

`LICENSE` và dòng bản quyền **phải giữ nguyên** — đó là điều kiện duy nhất MIT đặt ra, và nó không
cản việc sửa, đổi tên hay bán lại.

## Cái đã chép

| Đường | Cỡ | Vì sao |
|---|---|---|
| `packages/core` | 4,5 MB | Lược đồ node, store cảnh, registry |
| `packages/viewer` | 2,1 MB | Các hệ dựng hình 3D và component `<Viewer>` |
| `packages/editor` | 8,0 MB | Giao diện soạn thảo và component `<Editor>` |
| `packages/nodes` | 13 MB | **Bắt buộc để vẽ được bất cứ thứ gì** — nó nạp registry qua `loadPlugin(builtinPlugin)`; không có nó thì không loại node nào được dựng |
| `packages/typescript-config` | 4 KB | Bốn gói trên kế thừa cấu hình này |
| `assets/material` | 18 MB | Texture `.ktx2`. **Đã đo:** một cảnh AppFront vẽ ra thì viewer đi xin 4 tệp trong số này từ CDN của Pascal — tự host ở đây là để cắt đường gọi ra ngoài đó |
| `assets/hdri` · `assets/fonts` · `assets/icons` | 1,4 MB · 208 KB · 2,4 MB | Môi trường chiếu sáng, phông chữ, icon giao diện soạn thảo |

Phần `dist/`, `node_modules/`, `.turbo/` và `tsconfig.tsbuildinfo` **không** chép — chúng là kết
quả dựng, dựng lại được.

## Cái CỐ Ý không chép

| Bỏ | Cỡ | Vì sao |
|---|---|---|
| `apps/editor/public/items` | 4,5 MB | Thư viện đồ đạc `.glb` của Pascal. Đo được: cảnh AppFront **không gọi tệp nào** trong đó — đồ đạc của AppFront hiện là chỗ giữ chỗ `asset://appfront/<loại>`. Cần thì lấy lại từ `F:/pascal-editor` |
| `apps/editor/public/audios` | 824 KB | Âm thanh giao diện soạn thảo |
| `apps/editor/public/demos` | 44 KB | Cảnh mẫu của Pascal |
| `apps/*`, `packages/{cli,mcp,ifc-converter,ui,eslint-config}` | — | App Next.js, CLI, máy chủ MCP, bộ đổi IFC — không nằm trong phạm vi nhúng |

## Ba điều phải biết trước khi sửa mã trong đây

1. **`packages/editor` không có bước dựng.** Nó xuất thẳng `./src/index.tsx`, và nhập `next/image`
   (26 tệp) cùng `next/link` (1 tệp). AppFront chạy Vite chứ không chạy Next, nên hai đường nhập ấy
   phải được thay bằng shim — tổng cộng 17 dòng, đã có bản chạy được ở `F:/pascal-spike/src/shims/`.
   Không có module `next/*` nào khác: đã đếm, bề mặt đóng ở đúng hai.
2. **`setScene` không chạy zod.** Mọi trường mà lược đồ khai `.default()` sẽ **thiếu hẳn** lúc chạy,
   và bộ vẽ đọc thẳng chúng — thiếu `site.polygon` thì cả cây con biến mất trong im lặng.
   `src/lib/pascal/__tests__/renderContract.test.ts` giữ hàng rào ấy.
3. **Cổng tổng của AppFront không quét thư mục này.** `length`, `typecheck`, `import vòng` và
   `coverage` đều chỉ nhìn `src/**`. Hai cổng có quét là `lint` (`eslint .`) và `test` (vitest tự
   nhặt `*.test.*`), nên cả hai có một dòng loại trừ trỏ vào đây. **Đừng gỡ hai dòng ấy** — mã
   trong thư mục này viết theo luật Biome của Pascal, không theo bảy luật nội bộ của AppFront.
