# S-15 / T8 — Báo cáo nghiệm thu màn "Trục và gốc toạ độ" (`AxisGridManager`)

Ngày chạy: 01-09-2026 · nhánh `mungvu2004/s15-t8-tichhop` · worktree `s15-t8-tichhop`.

Mọi con số dưới đây là **đầu ra thật của lệnh thật**, dán nguyên văn. Bước nào chưa chạy
thì ghi "chưa chạy" (E.10 / R-58) — không có ô nào được điền bằng suy đoán.

---

## D.1 — Ba cổng chất lượng

### `pnpm typecheck`

```
> app-front@0.0.0 typecheck C:\Users\mxuan\orca\workspaces\AppFront\s15-t8-tichhop
> tsc --noEmit

exit=0
```

### `pnpm lint`

```
> app-front@0.0.0 lint C:\Users\mxuan\orca\workspaces\AppFront\s15-t8-tichhop
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0

exit=0
```

Không một cảnh báo nào — `--max-warnings 0` nên cảnh báo cũng là lỗi.

### `pnpm test`

```
 Test Files  214 passed (214)
      Tests  4447 passed (4447)
   Start at  22:52:48
   Duration  109.12s
```

### Bảng so sánh song đôi — trước và sau tích hợp

Số "trước" đọc từ thân commit `worker_done` của ba task lớp 2 đã có trên nhánh này.

| Mốc | commit | Test Files | Tests | typecheck | lint |
|---|---|---|---|---|---|
| T6 (canvas) | `63e22d9` | 212 | 4409 | sạch | sạch |
| T5 (cổng + hook) | `5077d78` | 213 | 4432 | sạch | sạch |
| T7 (hai panel) | `cc40504` | *không ghi số trong thân commit* | — | — | — |
| **T8 (sau tích hợp)** | lượt này | **214** | **4447** | **đạt (exit 0)** | **đạt (exit 0)** |

Chênh lệch: **+1 file kiểm** (`AxisGridManager.test.tsx`) và **+15 bài** so với T5 —
đúng 15 bài của file kiểm mới, không bài nào của repo bị sửa, tắt hay nới (R-70).
Độ phủ toàn kho sau tích hợp: `All files 87,24 % Stmts / 87,13 % Branch / 84,90 % Funcs`
(bước "test + độ phủ" của `pnpm verify` — **đạt**).

---

## D.2 — `expectSevenStates`

Đầu ra thật của `[NGHIEM-1]` trong `AxisGridManager.test.tsx`:

```
expectSevenStates: 7/7
```

**7/7.** Bảy kịch bản lấy nguyên từ `axisGridManagerScenarios.ts` (cùng bộ dữ liệu mà
story dùng, R-70), và bài kiểm thứ hai của cùng nhóm khẳng định thêm: ở CẢ BẢY trạng thái
vỏ màn `region` và canvas vẫn còn trong cây — tức không nhánh nào ra màn trắng (A11).

---

## D.3 — Căn chỉnh tự động: bảng độ lệch TRƯỚC và SAU

Đầu ra thật của `useAxisGridManager.test.ts` (bộ mẫu hai tầng căn được — tầng 1 làm chuẩn,
tầng 3 lệch đúng một phép tịnh tiến đều +100 mm/+60 mm):

```
độ lệch TRƯỚC căn tự động:  Tầng 1: 0 mm · Tầng 3: 100 mm
độ lệch SAU căn tự động:    Tầng 1: 0 mm · Tầng 3: 0 mm
```

| Tầng | độ lệch TRƯỚC | độ lệch SAU | dưới 50 mm? |
|---|---|---|---|
| Tầng 1 (chuẩn) | 0 mm | 0 mm | có |
| Tầng 3 | 100 mm | 0 mm | có |

**Khẳng định đạt: sau khi căn, độ lệch mọi tầng căn được đều DƯỚI 50 mm** (thực tế bằng 0).
Bài kiểm khẳng định điều đó bằng vòng lặp trên `alignFloors()` đọc thẳng từ kho, cộng thêm
`viewModel.floors.every(status === 'ok')` và `warningBanner === null`.

### Tầng 2 của bộ mẫu ba tầng — nói rõ, không giấu

Đầu ra thật của `[NGHIEM-6]` (bảng đọc từ chính view-model mà màn vẽ ra):

```
độ lệch ba tầng trên màn: Tầng 1: 0 mm (ok) · Tầng 2: 200 mm (warning) · Tầng 3: 0 mm (ok)
```

Tầng 2 **không** về dưới 50 mm, và đó là dữ liệu cố ý chứ không phải lượt căn hỏng:
`axisGridFixture.ts` dựng tầng 2 với MỘT trục lệch riêng 200 mm (`FLOOR2_VERTICAL_X_MM`
= `[0, 5000, 10000, 15200]`), tức không phải một phép tịnh tiến đều, nên không phép dời
cứng nào bù lại được. Đó là dữ liệu của kịch bản *cảnh báo* — chính nó sinh ra dải cảnh
báo và trạng thái `warning` mà A4 cần. Bộ mẫu tự canh bằng một khẳng định lúc nạp module:
`AXIS_GRID_FIXTURE_FLOOR2_EXPECTED_OFFSET_MM` phải LỚN HƠN `ALIGNMENT_WARNING_THRESHOLD_MM`
(150 mm), nếu không nó ném ngay.

---

## D.4 — Hoàn tác: một lần `Ctrl+Z` sau khi căn tự động

Bài `một lần Ctrl+Z trả về nguyên trạng, và lịch sử chỉ tăng đúng một bước`
(`useAxisGridManager.test.ts`) — **xanh**.

| Phép đo | Giá trị |
|---|---|
| Số bước lịch sử mà lệnh căn tự động thêm vào | **1** |
| Số lần `Ctrl+Z` để về nguyên trạng | **1** |
| Toạ độ mọi trục sau lượt hoàn tác | bằng đúng ảnh chụp trước khi căn |

Khẳng định trong bài kiểm là `historyStepCount()` **bằng `stepsBefore + 1`** — bằng 2 trở
lên sẽ làm bài đỏ ở đúng con số đó. Lượt `Ctrl+Z` đi qua **sổ phím thật**
(`registry.handleKeyDown`), không gọi tắt vào hàm hoàn tác.

Vì sao đúng một bước: `buildAutoAlignCommand` gom patch của **mọi tầng** vào ĐÚNG MỘT
`Command` (Q3.4), và `changeForUpdate` mang đủ ảnh chụp `before`/`after` để `invertCommand`
chỉ việc hoán đổi.

---

## D.5 — Chặn khoảng cách tối thiểu: đặt hai trục cách nhau 80 mm

Câu chặn, **nguyên văn**, đọc ra từ cây DOM đã render của màn (`[NGHIEM-2]`):

```
câu chặn khoảng cách: không thể đặt 1 và 2 cách nhau dưới 100 mm — khoảng cách tối thiểu này giữ cho bước dò hai trục khác nhau phân biệt được. khoảng cách hiện tại: 80 mm.
```

Bản ngắn đọc lên `aria-live` (`useAxisGridManager.test.ts`):

```
không thể đặt 1 và 2 cách dưới 100 mm
```

- Câu nêu **đích danh hai trục**: `1` và `2` — hai mã trục dọc liền kề của bộ mẫu.
- Câu nêu cả **ngưỡng** (100 mm, đọc từ `MIN_AXIS_SPACING_MM`) lẫn **khoảng cách hiện tại**
  (80 mm). Không con số nào viết tay trong câu (R-71).
- Lượt kéo bị chặn **không** ghi gì: toạ độ trục không đổi và số bước lịch sử không tăng.
- Câu chặn đi ra bằng `spacingMessage`, **không** nhét vào `errorMessage` — nhét vào đó sẽ
  lật màn sang trạng thái `error` (bất biến 4 của `axisGridTypes.ts`), tức nói dối. Bài kiểm
  khẳng định luôn: lúc câu chặn hiện, cột trái vẫn là danh sách trục thật.

---

## D.6 — Khối lệnh kiểm của LUAT_MAN_HINH Phần 4

```
SCREEN=src/screens/qc/AxisGridManager
```

### `ls $SCREEN` — PHẢI CÓ kết quả

```
AxisGridCanvas.tsx
axisGridFixture.ts
AxisGridFloorAlignList.tsx
AxisGridGhostFloor.tsx
AxisGridLeftPanel.tsx
AxisGridManager.container.tsx
AxisGridManager.stories.tsx
AxisGridManager.test.tsx
AxisGridManager.tsx
axisGridManagerGateway.ts
axisGridManagerScenarios.ts
AxisGridOriginMarker.tsx
AxisGridOriginPanel.tsx
axisGridTypes.ts
index.ts
useAxisGridManager.test.ts
useAxisGridManager.ts
```

17 file — nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D cho phép (view vượt trần
400 dòng thì phần con tách ra file anh em, `index.ts` giữ nguyên đường nhập). Tiền lệ:
`WallLayerReview/` 20 file, `PipelineFailure/` 16 file.

### R-60 — view chạm tầng dữ liệu · PHẢI RỖNG

```
$ rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '*.tsx' --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
(rỗng)
```

### R-62 — ranh giới lỗi · PHẢI CÓ

```
$ rg "<ScreenErrorBoundary" $SCREEN
src/screens/qc/AxisGridManager/AxisGridManager.container.tsx:    <ScreenErrorBoundary
```

Đúng bản của `@/components/feedback` — bản mà `src/App.tsx` đang gắn, **không** phải bản
chưa nối ở `src/lib/screen-state`.

### R-63 — bảy trạng thái · PHẢI CÓ

```
$ rg "expectSevenStates" $SCREEN
src/screens/qc/AxisGridManager/axisGridManagerScenarios.ts:/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
src/screens/qc/AxisGridManager/AxisGridManager.test.tsx: * Ba bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
src/screens/qc/AxisGridManager/AxisGridManager.test.tsx:import { expectSevenStates } from '@/lib/testing/expectSevenStates';
src/screens/qc/AxisGridManager/AxisGridManager.test.tsx:/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
src/screens/qc/AxisGridManager/AxisGridManager.test.tsx:    expectSevenStates((scenario) => {
src/screens/qc/AxisGridManager/AxisGridManager.test.tsx:    console.log(`expectSevenStates: ${rendered}/${SEVEN_STATES.length}`);
```

### R-64 — tự viết `loading`/`error` · PHẢI RỖNG

```
$ rg "useState.*([Ll]oading|error)" $SCREEN
(rỗng)
```

Lượt đọc máy chủ đi qua `useQuery` (`queryKeys.space.byFloor`), không có cờ tải nào tự viết.

### R-65 — đường dẫn thô · 29 dòng, **tất cả nằm trong chú thích**

```
$ rg "['\"`](/|https?://)" $SCREEN | wc -l
29
```

29 dòng đều là dạng `` `a`/`b` `` giữa câu văn tiếng Việt trong JSDoc, ví dụ
"`detectAxes`/`verticalAxes`/`horizontalAxes`", "`spacingText`/`addButtonLabel`",
"`ok`/`warning`/`unalignable`". Không một chuỗi đường dẫn nào trong mã chạy được: cả màn
tra `ROUTES` của `@/routes/paths` và không ghép chuỗi đường dẫn nào. LUAT_MAN_HINH R-65
nói rõ phải bỏ qua dòng nằm trong `/* */` và `//`. Cùng cách đọc mà `.orca-notes/S14-T8-nghiemthu.md`
đã ghi cho màn trước (10 dòng, cùng dạng).

### R-69 — stub / nợ · PHẢI RỖNG

```
$ rg "TODO|FIXME|stub|any\b" $SCREEN
(rỗng)
```

### R-70 — test bị tắt · PHẢI RỖNG

```
$ rg "\.(skip|only)\(" $SCREEN
(rỗng)
```

### R-71 — hằng số thô · PHẢI RỖNG

```
$ rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
(rỗng)
```

### R-73 — container tồn tại · PHẢI CÓ

```
$ ls $SCREEN/*.container.tsx
src/screens/qc/AxisGridManager/AxisGridManager.container.tsx
```

### R-68 — phạm vi sửa

```
$ git status --porcelain
 M src/i18n/vi.json
 M src/routes/paths.ts
 M src/routes/router.tsx
 M src/screens/qc/AxisGridManager/AxisGridLeftPanel.tsx
 M src/screens/qc/AxisGridManager/axisGridManagerScenarios.ts
?? src/screens/qc/AxisGridManager/AxisGridManager.container.tsx
?? src/screens/qc/AxisGridManager/AxisGridManager.stories.tsx
?? src/screens/qc/AxisGridManager/AxisGridManager.test.tsx
?? src/screens/qc/AxisGridManager/AxisGridManager.tsx
?? src/screens/qc/AxisGridManager/index.ts
```

Đúng ba nhóm R-68 cho phép: `src/screens/qc/AxisGridManager/**`, `src/routes/**`,
`src/i18n/vi.json` (cộng `.orca-notes/` là file báo cáo này). **Không** file nào của
`src/lib`, `src/api`, `src/domain`, `src/store`, `src/components`, `eslint-rules`.

Hai file `M` nằm ngoài danh sách trắng của tôi (`AxisGridLeftPanel.tsx` của T7 và
`axisGridManagerScenarios.ts` của T5) là ba lượt sửa nhỏ **cần để lắp lại được** — liệt kê
riêng ở mục "Nợ của task khác đã trả tại chỗ" bên dưới.

---

## C — Đăng ký route

```
$ grep -n "projectGrids" src/routes/paths.ts src/routes/router.tsx
src/routes/paths.ts:64:  projectGrids: `${PROJECTS_ROOT}/:id/floors/:floorId${LAYERS_ROOT}/grids`,
src/routes/router.tsx:90:  { path: ROUTE_PATTERNS.projectGrids, element: suspended(<RouteAxisGridManager />) },
```

Ba chỗ đã thêm, đúng quyết định Q2 của điều phối viên (đường dẫn **tiếng Anh**, đúng khuôn
`projectWalls`/`projectObjects`, KHÔNG phải `/du-an/.../truc` của đặc tả gốc — LUAT_MAN_HINH
xếp trên prompt, và `/tai-khoan` là ngoại lệ tiếng Việt duy nhất được ghi nhận):

1. `ROUTE_PATTERNS.projectGrids` = `/projects/:id/floors/:floorId/layers/grids`
2. `ROUTES.project.grids(projectId, floorId)` — bảng dành cho `navigate()`
3. `router.tsx`: `RouteAxisGridManager` lazy-import, gắn cho `projectGrids`, và route
   `layerGrids` chuyển từ `<RouteCanvas />` sang cùng phần tử màn mới.

### `grep -c "Placeholder" src/routes/router.tsx`

```
TRƯỚC: 11
SAU:   11
```

**Không giảm, và đây là con số thật chứ không phải con số mong đợi.** Lý do: `layerGrids`
trước lượt này trỏ vào `RouteCanvas`, mà `RouteCanvas` là **một hằng lazy DÙNG CHUNG cho
năm route** (`layerObjects`, `layerDimensions`, `layerGrids`, `floors`, `layerRooms`). Gỡ
`layerGrids` khỏi nó không xoá được dòng `const RouteCanvas = … <Placeholder name="Canvas" />`,
vì bốn route kia vẫn dùng. Chữ "Placeholder" trong file nằm ở 11 dòng: 1 dòng chú thích
`eslint-disable`, 1 dòng chú thích `// Placeholder components`, 1 dòng định nghĩa, 2 dòng
hai hằng lazy (`Route3D`, `RouteCanvas`), 6 dòng route dùng thẳng `<Placeholder … />` —
không dòng nào trong số đó thuộc riêng màn này.

Con số **thật sự giảm đúng một** là số **route còn trỏ vào chỗ giữ chỗ**:

| | TRƯỚC | SAU |
|---|---|---|
| route dùng `<RouteCanvas />` | 5 | 4 |
| route dùng `<Route3D />` | 1 | 1 |
| route dùng `<Placeholder … />` thẳng | 6 | 6 |
| **tổng route giữ chỗ** | **12** | **11** |

Tiền lệ cùng dạng đã được ghi nhận: `.orca-notes/S14-T8-nghiemthu.md` báo 11 → 11 cho màn
`DimensionOcrReview` và giải thích y hệt.

---

## B — Trộn i18n

Mảnh `.orca-notes/S15-T4-i18n.fragment.json` đã trộn vào `src/i18n/vi.json` dưới khoá
`axisGridManager`, đặt sau `dimensionOcrReview`, giữ nguyên cấu trúc lồng và thứ tự khoá
của mảnh. Không khoá nào của màn khác bị xoá hay đổi.

```
$ git diff --stat src/i18n/vi.json
 src/i18n/vi.json | 101 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 101 insertions(+)
```

100 dòng của mảnh T4, cộng **1 dòng khoá mới** `axisPanel.removeAxis` (xem mục nợ bên dưới).

Lượt đọc lại bằng `node -e` sau khi trộn:

```
$ node -e "const d=require('./src/i18n/vi.json'); console.log('JSON.parse OK, keys:',Object.keys(d).length)"
JSON.parse OK, keys: 21

$ node -e "... console.log(Object.keys(d.axisGridManager).join(', '))"
screen, axisPanel, originPanel, alignmentPanel, warning, warningAction, constraint, undoToast, states, canvas

$ node -e "... console.log(d.axisGridManager.screen.breadcrumb)"
Dự án > Trục và gốc toạ độ

$ node -e "... console.log(d.axisGridManager.axisPanel.removeAxis)"
Xoá trục {{code}}
```

---

## `pnpm verify` — dán nguyên văn, kể cả phần đỏ

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

Dừng ở bước "kích thước gói" (mã thoát 1). Sửa mã cho đạt, không hạ ngưỡng và không tắt luật.
```

Chi tiết bước 6:

```
  VƯỢT  tổng JS                 645,4 KiB /  175 KiB (quá 470,4 KiB)
  đạt   tổng CSS                  9,5 KiB /   12 KiB (còn dư 2,5 KiB)
  đạt   chunk JS lớn nhất       132,9 KiB /  170 KiB (còn dư 37,1 KiB)
```

Bước 7 (**độ dài file**) ghi "chưa chạy" vì `verify.mjs` dừng ở bước hỏng đầu tiên — đó là
con số thật, không phải một ô bị bỏ trống (E.10).

### Phần đóng góp của màn này — ĐO, không đoán

Đo bằng cách tạm gỡ route (bỏ hằng lazy `RouteAxisGridManager` và hai dòng route, trả
`layerGrids` về `<RouteCanvas />`), dựng lại rồi so:

| Bản dựng | tổng JS gzip | so với ngân sách 175 KiB |
|---|---|---|
| **có** màn này (cây nộp) | 645,4 KiB | vượt 470,4 KiB |
| **không** có màn này (tạm gỡ route) | 628,6 KiB | vượt 453,6 KiB |
| **phần của màn này** | **16,8 KiB** | — |

Kết luận trung thực: cổng kích thước gói **đã đỏ sẵn 453,6 KiB trước khi có màn này**, và
màn này thêm **16,8 KiB gzip**. Không sửa cấu hình, không nới ngân sách, không tắt luật để
lấy màu xanh (đúng lưu ý của đặc tả và R-58). `chunk JS lớn nhất` vẫn còn dư 37,1 KiB, tức
màn vào đúng một chunk lazy riêng chứ không dồn vào chunk chính.

---

## Nợ của task khác đã trả tại chỗ (ngoài danh sách trắng)

Ba lượt sửa nhỏ, đều **cần để màn lắp lại được hoặc để cổng R-72 xanh**. Ghi riêng ra đây
vì đó là nợ của task kia, không phải việc của T8:

1. **`AxisGridLeftPanel.tsx` (T7) — vòng tiêu điểm.** Nút chữ của mỗi hàng trục có
   `outline-none` kèm `focus-visible:outline-*`, mà `expectAccessible` chỉ nhận
   `focus-visible:ring-2` (+ `ring-offset-2`) làm vòng thay thế. 8/8 hàng trục bị báo
   "tắt viền tiêu điểm mặc định mà không thay bằng cái khác" (A12). Đã đổi sang đúng
   khuôn mà `WallLayerList.tsx`/`ObjectLayerStatusBar.tsx` dùng.
2. **`AxisGridLeftPanel.tsx` (T7) — hai prop treo, sửa theo quyết định của điều phối viên
   (`orca orchestration ask`, 01-09-2026).** `onAxisRemove` và `onViewOnDrawing` của hợp
   đồng T3 không có nút nào gọi tới. Quyết định đã chốt:
   - nút chữ của hàng gọi `onViewOnDrawing` (JSDoc của chính hợp đồng: "chọn một trục rồi
     bay khung nhìn canvas tới nó" — nó ĐÃ LÀ hành động kích hoạt hàng); `onAxisSelect`
     giữ đường bấm thẳng vào trục trên canvas;
   - thêm một `IconButton` xoá cho mỗi hàng, `aria-label` riêng dạng "Xoá trục {mã}"
     (R-72), khoá mới `axisPanel.removeAxis` thêm vào `vi.json` theo R-67;
   - vai Người xem không thấy nút thêm và nút xoá (đặc tả: "không thêm/xoá/kéo được trục";
     A2: màu nhấn chỉ dành cho thứ tương tác được). Hook vẫn vô hiệu hoá ở tầng của nó —
     đây là lớp thứ hai, không phải lớp duy nhất.
3. **`axisGridManagerScenarios.ts` (T5) — chuỗi lỗi có tiền tố tiếng Anh.**
   `ERROR_MESSAGE` là `'axis-grid: không tải được lưới trục ở công trình này.'`;
   `expectVietnamese` báo `"axis-grid" — không phải âm tiết tiếng Việt`. Đã đổi thành
   `'Không tải được lưới trục của công trình này. Thử lại để chạy lại bước dò trục.'`.
   Chỉ chuỗi của KỊCH BẢN bị sửa; đường lỗi thật của hook đi qua `describeError()` của
   repo và vốn đã là tiếng Việt.

Một chỗ nữa **không** phải nợ mà là hai hợp đồng nói hai kiểu, đã ráp ở container chứ không
sửa file nào: `AxisGridManagerProps.onAxisDrag` (T3) nhận `Pixels`, còn
`AxisGridCanvasProps.onAxisDrag` (T6) nhận `number` — vì `getScreenCTM().inverse()` cho một
số thô của DOM. View khai theo hình dạng của canvas (view không được nhập `@/domain`, R-60),
và `AxisGridManager.container.tsx` bọc `pixels()` quanh nó trước khi giao cho hook. Không
phép tính nào bị mất: gắn nhãn đơn vị không phải phép tính.

---

## Tự kiểm theo Phần 5 của LUAT_MAN_HINH

| | Mục | Kết quả |
|---|---|---|
| R-59 | sáu tên chuẩn (+ file anh em, `index.ts` giữ đường nhập) | đạt |
| R-60 | view không chạm `@/api` `@/store` `@/domain` `@/lib/http` | đạt (grep rỗng) |
| R-62 | `ScreenErrorBoundary` của `@/components/feedback` | đạt |
| R-63 | `expectSevenStates` | **7/7** |
| R-64 | không tự viết `loading`/`error` | đạt (grep rỗng) |
| R-65 | không đường dẫn thô | đạt (29 dòng đều là chú thích) |
| R-66 | route đã đăng ký, chỗ giữ chỗ tương ứng đã thay | đạt (route giữ chỗ 12 → 11) |
| R-67 | khoá mới đã vào `vi.json` | đạt (100 dòng mảnh T4 + `removeAxis`) |
| R-68 | `git diff --name-only` chỉ ba nhóm | đạt |
| R-69 | không `TODO`/stub; chỗ thiếu đã HỎI | đạt (một lượt `ask`, xem mục nợ) |
| R-70 | không sửa/nới/tắt test có sẵn | đạt |
| R-71 | không hằng số viết tay | đạt |
| R-72 | `expectAccessible` + `expectVietnamese` | đạt, cả bảy trạng thái |
| R-73 | container nhận đủ props để màn khác mở được | đạt |
| R-22 | view dưới 400 dòng có nội dung | đạt (`AxisGridManager.tsx` — 241 dòng có nội dung / 262 dòng thô) |
| R-56/R-58 | `pnpm verify` dán nguyên văn | dán ở trên — **hỏng ở bước 6**, đã đo phần đóng góp |
