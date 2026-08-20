# SỔ THEO DÕI SỬA LỖI

Nguồn việc: `BAO_CAO_DO_LECH.md` sau **lần đo thứ hai** — 28 dòng luật + 8 khiếm khuyết =
**36 mục**. Lệnh kiểm lấy từ trường **Kiểm bằng** của luật tương ứng trong `RULE.md`.

## Mốc gốc — GIAI ĐOẠN A

Nhánh `sua-tai-lieu-do-lech`, tách từ `master` (`622d73f`).

`pnpm typecheck` — chạy được, sạch. Không có lỗi hook `.agent/hooks/pre_tool_use.py`.

`pnpm verify` **trước giai đoạn A** — năm bước, đều đạt, mã thoát 0:

```
KIỂM TỔNG
  đạt       typecheck
  đạt       lint
  đạt       test + độ phủ
  đạt       build
  đạt       kích thước gói

Tất cả các bước đều đạt.
```

`pnpm verify` **sau giai đoạn A** — sáu bước. Bước thứ sáu là cổng mới của R-21/R-22 và
nó **HỎNG**, đúng như thiết kế:

```
KIỂM TỔNG
  đạt       typecheck
  đạt       lint
  đạt       test + độ phủ
  đạt       build
  đạt       kích thước gói
  HỎNG      độ dài file

Dừng ở bước "độ dài file" (mã thoát 1).
```

> Cái đỏ này **không phải hồi quy**. Nó là R-22 lần đầu tiên có răng: trước giai đoạn A,
> R-22 mang mức BẮT BUỘC nhưng lệnh kiểm trỏ vào `scripts/check-file-length.mjs` — một
> script **chưa từng tồn tại**. Luật chặn merge mà không có gì chặn được, đúng thứ R-56
> cấm. Script đã dựng, đã vào `pnpm verify`, và nó đang chỉ vào hai file thật.
> **Xem QUYẾT ĐỊNH #1 bên dưới — cần người duyệt chốt trước khi vào giai đoạn B.**

## Checkpoint cuối GĐ1

Bốn mục xong: D1 `b598e98` · R-29 `9662528` · R-55 `3d4bf51` · R-47 `304e548`.

**Một hồi quy do chính GĐ1 gây ra, đã sửa** (`R-55 sửa hồi quy`): việc gắn
`ScreenErrorBoundary` kéo `@/lib/errors → toAppError.ts → import { ZodError } from 'zod'`
vào gói sản phẩm. Đó là nhập **giá trị** chỉ để dùng `instanceof`, nên nó lôi cả thư viện
zod theo: chunk JS lớn nhất 155,7 → **173,4 KiB** gzip, vỡ ngân sách 170 KiB.
Đổi sang `import type` và giữ nhánh kiểm theo hình dạng vốn đã có sẵn cạnh `instanceof`
→ **160,5 KiB**, đạt, còn dư 9,5 KiB. Không nới ngân sách.

`pnpm verify` cuối GĐ1:

```
  đạt       typecheck
  đạt       lint
  đạt       test + độ phủ
  đạt       build
  đạt       kích thước gói
  HỎNG      độ dài file      ← R-22, đang `hoãn`. Xem QUYẾT ĐỊNH #1.
```

Năm bước đầu đạt. Bước sáu đỏ vì đúng hai file mà R-22 chỉ ra, không phải vì hồi quy.

## Quy ước

- Trạng thái nhận đúng bốn giá trị: `chưa chạy` · `đang làm` · `xong` · `hoãn (lý do)`.
- Cột "Số vi phạm trước" là **đầu ra của chính lệnh ở cột Lệnh kiểm**, đo lại ngày
  2026-08-20. Không chép từ báo cáo.
- `rg` không có trên PATH của môi trường này; lệnh dưới đây là bản `grep` tương đương,
  **giữ nguyên mọi cờ loại trừ** mà lệnh `rg` gốc khai. Luật nào kiểm bằng ESLint thì gọi
  thẳng ESLint — grep không thay thế được.
- Lệnh nào là lưới thô thì ghi hai số: *số khớp / số vi phạm đã xác nhận*.

---

## 1. GIAI ĐOẠN 1 — ba việc ưu tiên + việc rẻ của R-47 (4 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| D1 | Phục hồi cổng "visual" của CI: bỏ `--update-snapshots` khỏi lệnh CI chạy, thêm `e2e:ci`, sinh ảnh chuẩn `linux` | GĐ1 | `grep -n "e2e" .github/workflows/ci.yml` | 1 — `ci.yml:91` chạy `pnpm e2e:visual`; 2 ảnh chuẩn, cả hai chỉ có bản `win32` | **0** lần chạy `e2e:visual` trong CI *(ảnh chuẩn linux vẫn chưa sinh — xem commit)* | `xong` | `b598e98` |
| R-29 | `Math.random()` trong hàm cập nhật state dưới `StrictMode`; `setSummaryResetKey` gọi trong updater | GĐ1 | `grep -rnE "Math\.random\(\|Date\.now\(\|new Date\(\)" src/components src/screens src/hooks` | 6 khớp / **2** (`Toast.tsx:149`, `ListReviewDemo.tsx:22`) | 4 khớp / **0** | `xong` | `9662528` |
| R-55 | Bọc màn trong `ScreenErrorBoundary` (`App.tsx:53-57`) | GĐ1 | `grep -rn "<ScreenErrorBoundary" src` | 8 khớp / **0 màn được bọc** | 9 khớp / **9 màn demo được bọc** | `xong` | `3d4bf51` |
| R-47 | **Phần làm ngay:** thêm `src/mocks/**` vào `coverage.exclude` của `vitest.config.ts`. **Phần hoãn:** xoá hẳn `src/mocks/spatial.ts` | GĐ1 | `grep -n "src/mocks" vitest.config.ts` · `wc -l src/mocks/spatial.ts` | **0** dòng loại trừ; `spatial.ts` 1.612 dòng tính vào mẫu số độ phủ | **2** dòng loại trừ; độ phủ tổng 85,08% → 84,42%, `pnpm coverage` vẫn thoát 0 | `xong` *(phần coverage.exclude; phần xoá hẳn vẫn hoãn theo Mục 3)* | `304e548` |

---

## 2. GIAI ĐOẠN 2 — sửa nhanh, file độc lập nhau (14 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| R-10 | Khoá storage viết thẳng → hằng số xuất khẩu (`useAppShell.ts:38-58`) | GĐ2 | `grep -rnE "(local\|session)Storage\.(get\|set\|remove)Item\('" src` | **4** (1 file) | **0** | `xong` | `76227e0` |
| R-12 | `type` cho hình dạng đối tượng → `interface` | GĐ2 | `npx eslint src --ext ts,tsx --rule '{"@typescript-eslint/consistent-type-definitions":["warn","interface"]}'` | **7** (7 file) | **0** | `xong` | `1c6226d` |
| R-13 | Bật `explicit-module-boundary-types` cho `src/lib/**` + `src/domain/**`, trừ test | GĐ2 | `npx eslint src/lib src/domain --ext ts --rule '{"@typescript-eslint/explicit-module-boundary-types":"warn"}'` | **1** trong phạm vi đó (`src/lib/utils.ts`) | **0**, và luật nay bật ở mức `error` | `xong` | `830834f` |
| R-14 | Nhập kiểu bằng `import type` | GĐ2 | `npx eslint src --ext ts,tsx --rule '{"@typescript-eslint/consistent-type-imports":"warn"}'` | **45** (33 file) | **0** | `xong` | `c3e64e9` |
| R-17 | `eslint-disable` không ghi lý do sau `--` | GĐ2 | `grep -rn "eslint-disable" src \| grep -v " -- "` | **30** | **0** *(6 chỗ cuối do commit R-30 đóng)* | `xong` | `7e3e78b` |
| R-18 | Component khai bằng arrow không lý do → `export function` | GĐ2 | `grep -rnE "^export const [A-Z]\w+ = \(" src --include='*.tsx'` | **2** | **0** | `xong` | `8c19fc2` |
| R-19 | `export default` cho component → xuất bằng tên | GĐ2 | `grep -rn "^export default" src --include='*.tsx' \| grep -v '\.stories\.tsx'` | **2** | **0** | `xong` | `136d53f` |
| R-20 | File kebab-case → đặt lại tên | GĐ2 | `git ls-files src \| grep -E "/[^/]*-[^/]*\.(ts\|tsx)$"` | **1** | **0** | `xong` | `b7348e7` |
| R-24 | `key` là chỉ số mảng → định danh ổn định | GĐ2 | `grep -rnE "key=\{(i\|idx\|index\|\w*Index)\}" src` | **6** | **0** | `xong` | `4b73ef3` |
| R-31 | `useCallback`/`useMemo` không có người tiêu thụ | GĐ2 | soi tay; đối chiếu `grep -rn "useCallback(" src \| grep -v '\.test\.' \| wc -l` với `grep -rn "\bmemo(" src \| wc -l` | 101 useCallback/useMemo, **76 không có người tiêu thụ** | 99, **74 không có người tiêu thụ** | `hoãn (đã sửa ví dụ mà luật chỉ đích danh — useAppShell. 74 chỗ còn lại chưa quét: phép đo theo tên có lỗ ở ranh giới prop, xem commit d55ef26. R-31 ở mức KHUYẾN NGHỊ)` | `d55ef26` |
| R-41 | `rgba()` + hex trong `tailwind.config.ts` → biến CSS | GĐ2 | `grep -nE "rgba?\(\|#[0-9a-fA-F]{3,8}" tailwind.config.ts` | **7** | **0** | `xong` | `f81e5e4` |
| R-51 | `console.*` còn trong mã sản phẩm | GĐ2 | `grep -rnE "console\.(log\|warn\|error)" src \| grep -v '\.test\.' \| grep -v '\.stories\.'` | **11**; `catch` rỗng 0 | **6** *(1 chú thích + 5 chỗ hạ tầng có xử lý thật, xem commit)*; `catch` rỗng vẫn 0 | `xong` | `4e9607e` |
| R-52 | `alert()` trong story | GĐ2 | `grep -rnE "\b(window\.)?(alert\|confirm\|prompt)\(" src` | 6 khớp / **4** | 2 khớp / **0** | `xong` | `c033d06` |
| R-54 | Listener bàn phím gắn tay ngoài `shortcutRegistry` | GĐ2 | `grep -rnE "addEventListener\(['\"]key(down\|up\|press)['\"]" src \| grep -v '^src/lib/input/'` | 1 khớp / **0** | **0** | `xong` *(chưa từng vi phạm — xem ghi chú dưới bảng)* | — |

> **R-54 — vì sao là `xong` mà không có commit.** Lệnh kiểm của R-54 loại trừ
> `src/lib/input/**`, đúng thư mục cài đặt `shortcutRegistry` — nơi gắn listener là việc
> **phải làm**. Lần đo thứ nhất bỏ cờ loại trừ nên đếm 4 chỗ nằm trong chính vùng miễn trừ.
> Khớp duy nhất còn lại là một dòng **chú thích** ở `useShortcut.ts:10`. Không có mã nào để
> sửa; việc đã làm là sửa con số trong `RULE.md` và `BAO_CAO_DO_LECH.md` (commit `c416ec6`).

---

## 3. GIAI ĐOẠN 3 — cần suy xét từng chỗ (6 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| R-15 | Bỏ `any` **ngoài** 10 file story | GĐ3 | `npx eslint src --ext ts,tsx --no-inline-config --rule '{"@typescript-eslint/no-explicit-any":"warn"}'` | **15 / 13 file** — 12 file là `.stories.tsx`, **1** ngoài story (`SaveIndicator.test.tsx:30`). Phần thuộc GĐ3: **1** | — | `chưa chạy` *(12 chỗ trong story hoãn theo Mục 3 — đợi type helper cho `args`)* | — |
| R-26 | `useEffect` lấy dữ liệu → `lib/query` | GĐ3 | soi tay; dấu hiệu `await`/`.then(` trong thân `useEffect` | **1** (`useShareLinks.ts:314-318`) | — | `hoãn (Mục 3: đợi màn thật đầu tiên dùng lib/query rồi chuyển cùng lúc, để repo chỉ có một khuôn mẫu)` | — |
| R-27 | `useEffect` đồng bộ state → state | GĐ3 | soi tay; dấu hiệu thân effect chỉ gồm `if (…) setX(…)`, phụ thuộc là state khác | 7 ứng viên / **6**: `Toast.tsx:52`, `Toast.tsx:163`, `SaveIndicator.tsx:85`, `Drawer.tsx:94`, `useCombobox.ts:67`, `useAuthScreen.ts:411` | — | `chưa chạy` | — |
| R-30 | Tắt `exhaustive-deps` không ghi lý do | GĐ3 | `grep -rn "exhaustive-deps" src \| grep -v " -- "` | **6** | **0** | `xong` | `c5298f8` |
| R-45 | `getByTestId` ngoài vùng miễn trừ | GĐ3 | `grep -rnE "ByTestId\|data-testid" src \| grep -v '^src/components/canvas/' \| grep -v '^src/lib/three/'` | **23** (7 file) | — | `chưa chạy` | — |
| R-50 | Component chưa có story | GĐ3 | đối chiếu `*.tsx` với `*.stories.tsx` trong `src/components/**` | **5**: `ui/Kbd.tsx`, `shell/CommandPalette.tsx`, `shell/DevStateSwitcher.tsx`, `canvas/GridLayer.tsx`, `feedback/ScreenErrorBoundary.tsx` | — | `chưa chạy` | — |

---

## 4. GIAI ĐOẠN 4 — cần dựng hạ tầng trước (2 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| R-39 | Mở rộng `src/lib/motion` tái xuất `motion`/`AnimatePresence`/`useAnimation`, viết `local/no-framer-outside-motion`, rồi chuyển 16 file | GĐ4 | tạm: `grep -rln "from 'framer-motion'" src \| grep -v '^src/lib/motion/'`; sau khi có luật: `local/no-framer-outside-motion` | **16 file** | — | `chưa chạy` | — |
| R-05 | Bật `import/no-cycle` trong `pnpm verify` và CI. **Mục tiêu là ĐO và dựng cổng, không phải sửa mã** | GĐ4 | `npx eslint src --ext ts,tsx --rule '{"import/no-cycle":"warn"}'` | **0** — không có import vòng nào | 0 | `chưa chạy` *(số đã 0; việc còn lại là bật luật lên `error` để giữ nó ở 0)* | — |

---

## 5. GIAI ĐOẠN 5 — cơ học lớn, PR RIÊNG, không kèm gì khác (1 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| R-04 | Import tương đối vượt thư mục → alias `@/` | GĐ5 | `no-relative-import-paths/no-relative-import-paths` với `{ allowSameFolder: true, rootDir: 'src', prefix: '@' }` — **plugin chưa cài**; tạm `grep -rnE "from '\.\./" src --include='*.ts' --include='*.tsx'` | **646** (226 file) — *số tạm, chưa đo bằng luật thật* | — | `hoãn (Mục 3: chỉ chạy khi không có nhánh tính năng lớn nào đang mở — diff 646 dòng gây xung đột merge với mọi nhánh đang sống. PR riêng, không kèm thay đổi nào khác)` | — |

---

## 6. GIAI ĐOẠN 6 — tái cấu trúc (2 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| R-21 | File component ≤ 250 dòng có nội dung | GĐ6 | `node scripts/check-file-length.mjs` | **8** file | — | `chưa chạy` | — |
| R-22 | File component ≤ 400 dòng có nội dung | GĐ6 | `node scripts/check-file-length.mjs --max 400` | **2** — `ShareScreen.tsx` (460), `Combobox.tsx` (403) | — | `hoãn (Mục 3) — NHƯNG XEM QUYẾT ĐỊNH #1: hoãn mục này giờ đồng nghĩa pnpm verify đỏ suốt giai đoạn B` | — |

---

## 7. GIAI ĐOẠN 7 — khiếm khuyết ngoài phạm vi luật (7 mục)

| Mã | Việc | Giai đoạn | Lệnh kiểm | Số vi phạm trước | Số sau | Trạng thái | Commit |
|---|---|---|---|---:|---:|---|---|
| D2 | Hook chặn toàn bộ công cụ | GĐ7 | `grep -c "hooks" .claude/settings.json` · `ls .agent` | **0** — file không còn khối `hooks`, `.agent/` không tồn tại | **0** | `xong` *(tự hết; bằng chứng: typecheck/lint/coverage đều chạy được ở lần đo thứ hai)* | — |
| D3 | `src/routes.tsx` chưa được gắn | GĐ7 | `grep -rn "RouterProvider" src` | 0 `RouterProvider`; `routes.tsx` 50 dòng, 17 lần `Placeholder` | — | `hoãn (Mục 3: là bản đồ route đã thiết kế, có giá trị tham chiếu. Xử lý khi dựng vỏ ứng dụng thật)` | — |
| D4 | `src/lib/format.ts` che khuất `src/lib/format/` | GĐ7 | `ls src/lib/format.ts` phải báo không có; `grep -rn "from '@/lib/format'" src` | file 30 dòng tồn tại cạnh thư mục 4 file / ~874 dòng; **2** chỗ import qua `@/lib/format` | — | `chưa chạy` | — |
| D5 | Hai cấu hình vitest — khối `test` ở `vite.config.ts` bị che | GĐ7 | `grep -n "test:" vite.config.ts` | **1** (`vite.config.ts:11-14`) | — | `chưa chạy` | — |
| D6 | `eslint-plugin-import` nạp nhưng 0 luật bật | GĐ7 | `grep -n "'import'" .eslintrc.cjs` đối chiếu số luật `import/*` đang bật | plugin nạp ở `.eslintrc.cjs:24`, **0** luật `import/*` bật *(D6 và R-05 nên làm cùng nhau — bật `import/no-cycle` trả lời cả hai)* | — | `chưa chạy` | — |
| D7 | Bốn phụ thuộc khai mà 0 lần dùng | GĐ7 | `for d in @react-three/fiber @react-three/drei react-hook-form d3-zoom; do grep -rn "from '$d" src; done` | 4 phụ thuộc, **0 import** mỗi cái | — | `hoãn (Mục 3: không tốn gì lúc chạy vì không được import, tree-shaking bỏ hết. Quyết khi có người thật sự định dùng react-three-fiber; nếu sáu tháng nữa vẫn 0 import thì gỡ)` | — |
| D8 | Module trùng lặp — 4 cặp | GĐ7 | `ls src/lib/scale.ts src/lib/geometry/area.ts src/hooks/useCountUp.ts src/components/shell/CommandPalette.tsx` | 4 cặp: `lib/scale.ts` (708 B) ↔ `domain/units/scale.ts` (11 KB) · `lib/geometry/area.ts` (1,1 KB) ↔ `domain/rooms/area.ts` (21 KB) · `hooks/useCountUp.ts` (6 KB) ↔ `lib/motion/useCountUp.ts` (6,4 KB) · `shell/CommandPalette.tsx` (323 B) ↔ `overlay/CommandPalette.tsx` (11 KB) | — | `chưa chạy` | — |

---

## KIỂM ĐẾM

| Giai đoạn | Số mục |
|---|---:|
| GĐ1 | 4 |
| GĐ2 | 14 |
| GĐ3 | 6 |
| GĐ4 | 2 |
| GĐ5 | 1 |
| GĐ6 | 2 |
| GĐ7 | 7 |
| **Tổng** | **36** — 28 dòng luật + 8 khiếm khuyết |

Trạng thái: `xong` **2** (R-54, D2) · `hoãn` **6** (R-04, R-22, R-26, D3, D7 — cộng phần
story của R-15 và phần xoá hẳn của R-47, hai phần này nằm trong mục có trạng thái
`chưa chạy` nên không đếm riêng) · `chưa chạy` **28**.

---

## QUYẾT ĐỊNH CẦN NGƯỜI DUYỆT

**#1 — R-22 `hoãn` và `pnpm verify` xanh, giờ không thể cùng đúng.**
Giai đoạn A dựng `scripts/check-file-length.mjs` và gắn nó làm bước thứ sáu của
`pnpm verify`, đúng thứ tự đề bài yêu cầu. Hệ quả trực tiếp: `pnpm verify` **đỏ**, và sẽ
đỏ ở **mọi** lần chạy cuối giai đoạn trong suốt giai đoạn B, cho tới khi `ShareScreen.tsx`
(460) và `Combobox.tsx` (403) được tách. Một cổng luôn đỏ không phát hiện được hồi quy —
nó thành tiếng ồn. Ba đường đi, xin chọn một:

- **(a) Chuyển R-22 từ `hoãn` sang việc thật, làm ngay ở GĐ1.** Tách hai file trước khi
  bắt đầu phần còn lại. Cổng xanh lại, giai đoạn B có tín hiệu thật. Đắt nhất, nhưng là
  thứ duy nhất giữ được cả luật lẫn cổng.
- **(b) Giữ `hoãn`, chấp nhận `pnpm verify` đỏ suốt giai đoạn B**, và mỗi lần chạy thì đọc
  năm bước đầu, bỏ qua bước sáu. Trung thực nhưng làm hỏng công dụng của cổng.
- **(c) Gỡ bước sáu khỏi `pnpm verify`, giữ `pnpm length` là lệnh chạy tay.** R-22 quay về
  BẮT BUỘC-không-có-cổng, tức R-56 lại bị vi phạm như trước giai đoạn A.

Tôi **không** chọn hộ và **không** nới ngưỡng 400 — nới là đúng thứ R-49 cấm.
Nếu không có chỉ đạo khác, tôi sẽ đề nghị **(a)**.

**#2 — R-14 xếp vào GĐ2 hay GĐ5.**
Đề bài nói cả hai: "Thêm dòng … R-14 (GĐ5)" rồi ngay sau đó "GĐ5 chỉ còn R-04. Đó mới là
thứ đáng một PR riêng". Sổ đang xếp R-14 vào **GĐ2**, theo câu thứ hai và theo cùng lý lẽ
đã kéo R-12 ra khỏi GĐ5: 45 chỗ có bộ sửa tự động không phải "diff cơ học lớn". Nếu ý bạn
là để R-14 ở GĐ5 cùng R-04 thì nói, tôi chuyển lại.

---

## PHÁT SINH

*(Lỗi phát hiện ngoài sổ theo dõi — ghi lại, không tự sửa.)*

1. **R-39 đang lặp lại đúng lỗi mà R-22 vừa được sửa.** Trong bảng tra nhanh của `RULE.md`,
   R-39 mang mức **BẮT BUỘC** với lệnh kiểm `local/no-framer-outside-motion` **(cần viết)**
   — một luật chặn merge trỏ vào một luật ESLint chưa tồn tại. Đây là cùng một vi phạm R-56
   mà giai đoạn A vừa gỡ cho R-22. Không tự sửa vì R-39 là mục của GĐ4; đề nghị hạ R-39
   xuống NÊN cho tới khi luật được viết, hoặc viết luật ngay ở đầu GĐ4.

2. **`scripts/check-file-length.mjs` cũng quét `src/lib/testing/render.tsx`** (226 dòng có
   nội dung). File đó là hạ tầng kiểm thử, không phải mã sản phẩm — `vitest.config.ts` đã
   loại nó khỏi độ phủ vì lý do đó. Hiện dưới ngưỡng nên không ảnh hưởng gì; nếu nó vượt
   250 sau này thì nên loại trừ, không nên tách.

3. **Cảnh báo kích thước chunk lúc build**: `dist/assets/index-*.js` 522,53 kB (chưa nén)
   vượt ngưỡng cảnh báo 500 kB của Vite. Ngân sách gzip vẫn đạt (155,7 / 175 KiB) nên bước
   "kích thước gói" không hỏng.

4. **`ProgressOverlay.stories.tsx:34` là ứng viên R-29 thứ ba.**
   `setProgress((p) => Math.min(100, p + (Math.random() * 5 + 1)))` — số ngẫu nhiên nằm
   ngay trong hàm cập nhật state, đúng loại lỗi mà R-29 mô tả, và dưới `StrictMode` thanh
   tiến trình nhảy bước đôi. Không tự sửa: trường "Sai" của R-29 chỉ kể `Toast.tsx` và
   `ListReviewDemo.tsx`, đây là file story cố ý chạy hoạt ảnh, và sửa nó là đổi hành vi
   demo. Đề nghị xử lý cùng lúc với R-50 hoặc khi có người chạm vào story đó.

5. **`src/App.test.tsx` khẳng định một chuỗi không thuộc `App.tsx`.** Test tìm
   `'Quiet Blueprint v1.1'` nhưng `App.tsx` render `<h1>Demo App</h1>`; chuỗi kia đến từ
   màn `DesignSystem` được render mặc định. Test vẫn xanh nhưng nó đang kiểm màn con chứ
   không kiểm vỏ, nên nếu đổi màn mặc định thì test đỏ vì lý do không liên quan.

6. **`BAO_CAO_DO_LECH.md` mục 4.2 vẫn đề xuất cài `eslint-plugin-no-relative-import-paths`
   nhưng plugin chưa có trong `package.json`.** Vì vậy R-04 là mục **duy nhất** trong sổ
   chưa đo được bằng luật thật; con số 646 đến từ grep và có thể lệch với số luật báo.
