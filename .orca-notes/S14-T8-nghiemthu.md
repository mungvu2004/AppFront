# S-14 T8 — Bản nghiệm thu màn "Đọc kích thước OCR" (`DimensionOcrReview`)

Bốn phần theo G6 của `LUAT_MAN_HINH.md`. Commit mã: `c9076d2`.
Nhánh: `mungvu2004/s14-t8-tichhop`, nền là `fbcd976`.

---

## (a) Kế hoạch so với thực tế — lệch chỗ nào

| Việc đặc tả giao | Thực tế | Lệch |
|---|---|---|
| `DimensionOcrReview.tsx` — view thuần, chia đôi 60/40, tối đa 1440 | 280 dòng, `lg:w-[60%]` / `lg:w-[40%]`, `max-w-[1440px]` | không |
| Dưới 1024px ảnh cắt thu về 96 | `DimensionOcrCrop` của T7 đã làm bằng `w-[var(--dim-crop-h)] lg:w-[var(--dim-crop-w)]`; view thêm `flex-col lg:flex-row` cho khung | không |
| Chế độ bàn phím thu cả màn | `keyboardReview.isActive` → chỉ dựng `DimensionOcrKeyboardMode` | không |
| `DimensionOcrReview.container.tsx` — `ScreenErrorBoundary` của `@/components/feedback`, `key={projectId:floorId}` | đúng khuôn `ObjectLayerReview.container.tsx` | không |
| `DimensionOcrReviewRoute` là thứ duy nhất biết `react-router-dom` | đúng: chỉ `useParams` trong `DimensionOcrReviewRoute` | không |
| R-73: lối ra "hiệu chỉnh tỷ lệ" nối THẬT bằng `ROUTES.project.scale(...)` | **LỆCH VỀ HÌNH DẠNG**: nối bằng **chuỗi `scaleCalibrationHref`** (container dựng, view vẽ `<a href>`), **không** bằng callback `onNavigate`. Lý do: đặc tả nói `DimensionOcrReviewRoute` là thứ DUY NHẤT được biết `react-router-dom`, nên container không được gọi `useNavigate`; một `<a href>` vẫn là điều hướng THẬT, lại mở được bằng bàn phím và đọc được bởi trình đọc màn hình (A12). Không có prop tuỳ chọn nào không ai truyền. | có, đã ghi |
| Bảy story cắm `dimensionOcrReviewScenarios.ts` + cổng giả T5 | đủ bảy, `meta.excludeStories` có `scenarioArgsFor` và `SEVEN_STORY_STATES` | không |
| `index.ts` R-59 | xuất container / route / view / hook / cổng + bộ mẫu + kịch bản + hợp đồng props; không tái xuất phần con của view | không |
| `paths.ts` + `router.tsx` theo QĐ-1 | `ROUTE_PATTERNS.projectDimensions` đặt đúng thứ tự chữ cái, `ROUTES.project.dimensions` là HÀM | không |
| R-66 xoá `<Placeholder>` tương ứng | **KHÔNG có `<Placeholder>` nào tương ứng để xoá** — xem mục (c) | có, đã ghi |
| `vi.json` trộn nguyên mảnh T4 dưới `dimensionOcrReview` | đặt ngay sau `objectLayerReview`, JSON hợp lệ, +86 dòng, không khoá màn khác bị đụng | không |
| QĐ-3 số file | 17 file trong thư mục; đủ sáu tên chuẩn R-59 | không |

Không sửa một dòng nào của T3/T4/T5/T6/T7. `git diff --name-only` chỉ có 8 đường dẫn,
tất cả nằm trong ba nhóm R-68 cho phép.

---

## (b) Câu hỏi đã hỏi và phương án được chọn

**Không gửi `orca orchestration ask` lần nào.** Bốn điểm vướng gặp phải đều đã có
quyết định thành văn trong đặc tả hoặc có tiền lệ nguyên văn trong repo, nên tự quyết
theo đúng thứ tự ưu tiên `LUAT_MAN_HINH.md > RULE.md > CLAUDE.md > đặc tả màn`:

1. **`NumericField` và `expectAccessible` (QĐ-8).** `expectAccessible` XANH cả bảy
   trạng thái ngay lần chạy đầu — bản vá T10 (`fa514dd`) đã đủ. Không truyền
   `ignoreSelector`, không cần hỏi.
2. **`ZoomCluster` làm `expectVietnamese` đỏ.** `src/components/canvas/ZoomCluster.tsx`
   có `aria-label` "Điều khiển zoom" và "Zoom hiện tại 100%…". Sửa nó là sửa
   `src/components/**` — R-68 cấm trong lượt dựng màn. Tiền lệ NGUYÊN VĂN đã có:
   `ScaleCalibration.test.tsx:136-150` ghi `zoom` vào `ALLOWED_WORDS` kèm ghi chú
   "đây là NỢ đã ghi, không phải một chữ được duyệt". Làm đúng như vậy, chép cả lý lẽ.
   Đây là **nợ**, thuộc lượt dọn `ZoomCluster`, danh sách chỉ được ngắn đi.
3. **`@testing-library/user-event` KHÔNG có trong `package.json`.** Đặc tả viết
   "`userEvent.keyboard`/`tab`". Thêm dependency nằm ngoài phạm vi file của lượt này.
   Thay bằng `fireEvent.keyDown` + hàm `pressTab()` tự viết, đi đúng thứ tự DOM và bỏ
   qua `tabIndex={-1}`. Con số "0 lần dùng chuột" **đo thật** bằng sáu trình nghe
   `click`/`dblclick`/`mousedown`/`mouseup`/`pointerdown`/`pointerup` gắn ở pha bắt trên
   `document`, không phải một lời khai.
4. **jsdom không phát `focusout`.** `HTMLElement.focus()` của jsdom phát `focusin` cho
   phần tử nhận tiêu điểm nhưng KHÔNG phát `focusout` cho phần tử mất nó — mà `focusout`
   mới là sự kiện React gắn `onBlur` vào, tức là thứ `useNumericField.handleBlur` cần để
   chốt con số vừa gõ. `pressTab()` vì thế phát `focusout` bằng tay. Đây là vá một lỗ của
   môi trường kiểm, KHÔNG phải nới điều kiện: thiếu nó thì bài kiểm đo nhầm một lỗi của
   jsdom thành một lỗi của màn.

Một ghi nhận kỹ thuật đi kèm điểm 4, để người sau không mất thời gian dựng lại: trong
`DimensionValueField`, gõ `Enter` NGAY sau khi gõ số thì lượt chốt (`blur`) và lượt duyệt
(`onCommit`) nằm trong CÙNG một lượt xử lý sự kiện React, nên `approveDimension` đọc phải
`draft` của lượt render trước, tức số cũ. Người dùng thật gõ số rồi rời ô (Tab) hoặc dừng
tay 800 ms trước khi Enter, và cả hai đường đều cho kết quả đúng. Bài kiểm đi đúng đường
đó (Tab ra → Tab về → Enter), toàn phím. Đây **không** phải lỗi cần chặn ở lượt này, nhưng
đáng ghi cho lượt xem lại `DimensionOcrRow.tsx`.

---

## (c) Kết quả NGUYÊN VĂN của mọi lệnh kiểm

### Khối lệnh Phần 4 của `LUAT_MAN_HINH.md`

```
$ SCREEN=src/screens/qc/DimensionOcrReview
$ ls $SCREEN
DimensionOcrCanvas.tsx
DimensionOcrCompareBar.tsx
dimensionOcrFixture.ts
DimensionOcrKeyboardMode.tsx
DimensionOcrList.tsx
DimensionOcrReview.container.tsx
DimensionOcrReview.stories.tsx
DimensionOcrReview.test.tsx
DimensionOcrReview.tsx
dimensionOcrReviewGateway.ts
dimensionOcrReviewScenarios.ts
DimensionOcrRow.tsx
dimensionOcrText.ts
dimensionOcrTypes.ts
index.ts
useDimensionOcrReview.test.ts
useDimensionOcrReview.ts

$ rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '*.tsx' --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
(rỗng — mã thoát 1)

$ rg "<ScreenErrorBoundary" $SCREEN
src/screens/qc/DimensionOcrReview/DimensionOcrReview.container.tsx:    <ScreenErrorBoundary

$ rg "expectSevenStates" $SCREEN
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx: * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx: * kho còn trống. Bảy lượt dựng liên tiếp trong CÙNG một `it` (`expectSevenStates`)
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx:import { expectSevenStates } from '@/lib/testing/expectSevenStates';
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx:/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx:    expectSevenStates((scenario) => {
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx:    console.log(`expectSevenStates: ${rendered}/${SEVEN_STATES.length}`);
src/screens/qc/DimensionOcrReview/dimensionOcrReviewScenarios.ts:/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */

$ rg "useState.*([Ll]oading|error)" $SCREEN
(rỗng — mã thoát 1)

$ rg "TODO|FIXME|stub" $SCREEN
(rỗng — mã thoát 1)

$ rg "\.(skip|only)\(" $SCREEN
(rỗng — mã thoát 1)

$ rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
(rỗng — mã thoát 1)

$ ls $SCREEN/*.container.tsx
src/screens/qc/DimensionOcrReview/DimensionOcrReview.container.tsx
```

Lệnh R-65 (đường dẫn thô) ra 10 dòng, **tất cả nằm trong chú thích** — dạng "a/b" giữa
câu văn tiếng Việt, ví dụ "`startPx`/`endPx`", "`displayWidthPx`/`displayHeightPx`",
"`dispatch`/`runTransaction`". Không một chuỗi đường dẫn nào trong mã chạy được.
LUAT_MAN_HINH R-65 nói rõ phải bỏ qua dòng nằm trong `/* */` và `//`.

### R-66 — đếm `Placeholder` trong `src/routes/router.tsx`

```
$ rg -c "Placeholder" src/routes/router.tsx   # TRƯỚC
11
$ rg -c "Placeholder" src/routes/router.tsx   # SAU
11
```

**Không giảm, và đó là câu trả lời đúng.** Không có `<Placeholder>` nào của riêng màn
này để xoá: route mới là `ROUTE_PATTERNS.projectDimensions`
(`/projects/:id/floors/:floorId/layers/dimensions`), một đường dẫn CHƯA từng tồn tại.
`ROUTE_PATTERNS.layerDimensions` (`/layers/dimensions`) đã có sẵn nhưng nó trỏ tới
`RouteCanvas` — một chỗ giữ chỗ DÙNG CHUNG cho năm route (`layerObjects`, `layerGrids`,
`floors`, `layerRooms`, `layerDimensions`), không phải chỗ giữ chỗ của màn này. Tiền lệ
nguyên văn: S-13 đăng ký `projectObjects` và để `layerObjects → RouteCanvas` nguyên vẹn.
Xoá `RouteCanvas` sẽ làm hỏng bốn route khác.

### Cổng

```
$ pnpm typecheck
> tsc --noEmit
(không lỗi)

$ pnpm lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
(không lỗi, không cảnh báo)

$ pnpm cycles
Import vòng (import/no-cycle) — quét src/
Import vòng: không có.

$ pnpm test
 Test Files  212 passed (212)
      Tests  4409 passed (4409)
   Duration  85.24s

$ pnpm length
176 file đã quét · 26 vượt 250 · 0 vượt 400
Độ dài file: đạt.
  nhắc   314 dòng  src/screens/qc/DimensionOcrReview/DimensionOcrRow.tsx      (T7, không sửa)
  nhắc   280 dòng  src/screens/qc/DimensionOcrReview/DimensionOcrReview.tsx   (T8)

$ git diff --name-only    (so với fbcd976)
src/i18n/vi.json
src/routes/paths.ts
src/routes/router.tsx
src/screens/qc/DimensionOcrReview/DimensionOcrReview.container.tsx
src/screens/qc/DimensionOcrReview/DimensionOcrReview.stories.tsx
src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx
src/screens/qc/DimensionOcrReview/DimensionOcrReview.tsx
src/screens/qc/DimensionOcrReview/index.ts
```

### `pnpm verify` — bảng tổng kết NGUYÊN VĂN

```
========================================================================
KIỂM TỔNG
========================================================================
  đạt       typecheck
  đạt       lint
  đạt       import vòng
  đạt       test + độ phủ
  đạt       build
  HỎNG      kích thước gói
  chưa chạy độ dài file

Dừng ở bước "kích thước gói" (mã thoát 1).
```

```
  VƯỢT  tổng JS                 627,8 KiB /  175 KiB (quá 452,8 KiB)
  đạt   tổng CSS                  9,5 KiB /   12 KiB (còn dư 2,5 KiB)
  đạt   chunk JS lớn nhất       132,9 KiB /  170 KiB (còn dư 37,1 KiB)
```

**Bước 6 ĐỎ TỪ TRƯỚC, và đây là số đo để chứng minh.** Đo bằng cách gỡ ĐÚNG hai dòng
đăng ký route của màn này khỏi `src/routes/router.tsx` (màn khi đó không còn nơi nào
tham chiếu, nên rơi hẳn khỏi đồ thị gói), dựng lại rồi đo:

| Bản dựng | tổng JS gzip | quá ngân sách 175 KiB |
|---|---|---|
| **Nền, chưa có màn S-14** (route đã gỡ) | **613,3 KiB** | quá 438,3 KiB |
| Có màn S-14 (bản đã commit) | 627,8 KiB | quá 452,8 KiB |
| **Phần của lượt này** | **+14,5 KiB** | — |

Nghĩa là: cổng kích thước gói đã đỏ 438,3 KiB **trước khi màn này tồn tại**; lượt này
thêm 14,5 KiB gzip, tức 3,2% của phần đang vượt. Không nhận là lỗi của mình, và cũng
không che đi. Bước 7 (`độ dài file`) **chưa chạy trong `pnpm verify`** vì cổng dừng ở
bước 6 — nhưng đã chạy riêng bằng `pnpm length` ở trên và **đạt** (E.10: chỗ nào chưa
chạy thì ghi "chưa chạy", chỗ nào chạy rồi thì ghi số thật).

---

## Bảng số liệu bốn phép đo định lượng

Mọi con số dưới đây là **kết quả `console.log` thật** của
`src/screens/qc/DimensionOcrReview/DimensionOcrReview.test.tsx`, chạy trên màn ĐÃ RÁP
qua `DimensionOcrReviewContainer` với cổng giả của T5.

| # | Phép đo | Ngưỡng đặc tả | **Đo được** | Đạt |
|---|---|---|---|---|
| 1 | Sửa 5 giá trị chỉ bằng bàn phím — **số lần dùng chuột** | phải bằng 0 | **0** | ✔ |
| 2 | Chế độ duyệt bàn phím — **số lần gõ phím để xong một chuỗi** | phải là 2 | **2** (`ArrowUp`, `Enter`) | ✔ |
| 3a | Độ lệch **1,5%** (`M-018`) — có tô màu không | KHÔNG tô | **1,5% · tô màu: false** | ✔ |
| 3b | Độ lệch **2,5%** (`M-028`) — có tô màu không | CÓ tô | **2,5% · tô màu: true** | ✔ |
| 4a | Bộ đếm lúc mở màn | 18/34 | **"18/34 kích thước đã duyệt"** | ✔ |
| 4b | Bộ đếm sau khi duyệt hết | 34/34 | **"34/34 kích thước đã duyệt"** (16 lượt bấm duyệt thật trên màn) | ✔ |
| 0 | `expectSevenStates` | 7/7 | **7/7** | ✔ |

### Kết quả in ra, nguyên văn

```
expectSevenStates: 7/7

[NGHIEM-2] số giá trị đã sửa bằng bàn phím: 5
[NGHIEM-2] chuỗi đã sửa: M-002, M-006, M-010, M-014, M-017
[NGHIEM-2] số lần gõ Tab cho từng chuỗi: 44, 45, 46, 47, 48
[NGHIEM-2] giá trị mới (mm): 1201, 2401, 3601, 4801, 5701
[NGHIEM-2] SỐ LẦN DÙNG CHUỘT: 0

[NGHIEM-3] số lần gõ phím để xong một chuỗi: 2 — ArrowUp, Enter
[NGHIEM-3] M-002: giá trị mới 1201 mm, nguồn human

[NGHIEM-4] M-018: So sánh với hình học: chuỗi đọc được 6.090 mm · đo từ bản vẽ 6.000 mm · lệch 1,5% · tô màu: false
[NGHIEM-4] M-028: So sánh với hình học: chuỗi đọc được 9.225 mm · đo từ bản vẽ 9.000 mm · lệch 2,5% · tô màu: true

[NGHIEM-5] bộ đếm lúc mở màn: 18/34 kích thước đã duyệt
[NGHIEM-5] số lượt duyệt đã bấm: 16
[NGHIEM-5] bộ đếm sau khi duyệt hết: 34/34 kích thước đã duyệt
```

Ghi chú đọc bảng:

- **Phép 1** không chỉ "không bấm chuột": nó ĐẾM. Sáu trình nghe sự kiện chuột gắn ở
  pha bắt trên `document` suốt lượt đo, và `0` là số chúng đếm được. Năm giá trị đổi
  thật (1200→1201, 2400→2401, 3600→3601, 4800→4801, 5700→5701) và cả năm chuỗi được
  duyệt thật — đọc ra từ `overrideValueMm` trong kho, không đọc lại viewmodel.
- **Phép 2** đếm hai lần gõ phím *sau khi* chuỗi đã hiện trong chế độ duyệt: `ArrowUp`
  (con số) rồi `Enter` (lưu + duyệt + nhảy chuỗi sau). Bật chế độ bằng chính phím `R`
  của `shortcutRegistry`, không bằng một cờ đặt tay. Kết quả: `overrideValueMm = 1201`,
  `source = 'human'` (A5). Bài kiểm cũng khẳng định danh sách KHÔNG còn trên màn lúc đó.
- **Phép 3** đọc CHỮ và MÀU của dải đối chiếu trên DOM đã render, sau khi lượt chạy số
  260 ms kết thúc. "Tô màu" = lớp `bg-state-attention-tint` / `text-state-attention-text`
  có mặt trên chính dải đó. Chỉ `M-028` có.
- **Phép 4** không dựng sẵn trạng thái "đã duyệt hết": nó mở màn ở bộ mẫu 18/34 rồi bấm
  **16 nút "Duyệt kích thước #…" thật trên màn hình**, mỗi lượt chờ nút đó biến mất, cho
  tới khi không còn nút nào. Bộ đếm đọc ra từ nhãn `aria-live` của chính danh sách.

Ngoài bốn phép trên, `DimensionOcrReview.test.tsx` có 21 phép kiểm, tất cả xanh, gồm
`expectAccessible` × 7 trạng thái, `expectVietnamese` × 7 trạng thái, và `expectNoRawColor`
trên cả thư mục màn.

---

## (d) Việc còn nợ

1. **Cổng kích thước gói vẫn đỏ** — 627,8 KiB / 175 KiB. Đỏ từ trước (nền 613,3 KiB),
   lượt này thêm 14,5 KiB. Không phải việc của lượt dựng màn; cần một lượt riêng về
   tách chunk / lazy-load, đúng như `CLAUDE.md` đã ghi.
2. **`zoom` trong `ALLOWED_WORDS` của `expectVietnamese`** — nợ của
   `src/components/canvas/ZoomCluster.tsx`, không phải của màn này. Gỡ được ngay khi có
   lượt Việt hoá hai `aria-label` của component đó; lúc ấy xoá luôn dòng
   `const ALLOWED_WORDS = ['zoom']` khỏi `DimensionOcrReview.test.tsx`. Danh sách chỉ
   được ngắn đi. Tiền lệ cùng nợ: `ScaleCalibration.test.tsx`.
3. **`ROUTE_PATTERNS.layerDimensions → RouteCanvas`** vẫn còn, dùng chung với bốn route
   giữ chỗ khác. Nó KHÔNG phải chỗ giữ chỗ của màn này (xem mục R-66 ở trên) nên không
   được xoá trong lượt này; nó sẽ biến mất cùng lượt dọn `RouteCanvas`.
4. **Hai NOT FOUND của T1 vẫn nguyên, không được vá trong lượt này**: không có endpoint
   `persistDimensionLayer`, và `queryKeys` chưa có domain `dimension` (lớp kích thước
   dùng chung `queryKeys.space.byFloor`, đúng khoá `invalidationMap.editDimension` đã
   khai). Cả hai đã ghi thành văn trong `dimensionOcrReviewGateway.ts`.
5. **`pnpm e2e` / ảnh chuẩn Playwright**: **chưa chạy** — không nằm trong lệnh kiểm được
   giao cho lượt này (E.10).
6. **Lượt xem lại `DimensionOcrRow.tsx`** nên xét chỗ `Enter` gọi `blur()` rồi
   `onCommit()` trong cùng một lượt xử lý sự kiện (xem mục (b)). Không chặn lượt này, và
   không được sửa ở lượt này vì file đó là của T7 (luật một-file-một-chủ).
