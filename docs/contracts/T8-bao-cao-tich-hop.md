# T8 — Báo cáo tích hợp màn S-12 "Duyệt lớp tường"

Nhánh `mungvu2004/wlr-integrate` · commit `754973b` (gộp `420b880`) · 31-08-2026

---

## BẢNG SỐ

| Phép đo | Kết quả | Ghi chú |
|---|---|---|
| `pnpm typecheck` | **ĐẠT** — 0 lỗi (exit 0) | |
| `pnpm lint` | **ĐẠT** — 0 lỗi, 0 cảnh báo | `--max-warnings 0` |
| `pnpm test` | **ĐẠT** — 206 file / **4266 passed** / 0 failed | |
| `pnpm cycles` | **ĐẠT** — "Import vòng: không có." | |
| `pnpm length` | **ĐẠT** — 161 file quét · 18 vượt 250 · **0 vượt 400** | |
| `expectSevenStates` | **7/7** | dựng qua container thật, cả bảy |
| `expectAccessible` | **7/7** trạng thái | |
| `expectVietnamese` | **7/7** trạng thái | nới đúng một chữ, xem (c) |
| `expectNoRawColor` | **ĐẠT** — quét cả thư mục màn | |
| Dãy đếm bàn phím | **12, 13, 14, 15, 16, 17 → 16, 15, 14, 13, 12** | in ra từ bài kiểm thật |
| `grep "Math\."` thư mục màn | **RỖNG** | |
| Chú giải luôn hiện | **7/7** trạng thái, kể cả `collapsed` | 8 phép kiểm |
| `pnpm build` / `pnpm size` | **KHÔNG CHẠY theo chỉ đạo** | cổng đang đỏ sẵn ở master |

---

## (a) Kế hoạch so với thực tế — lệch chỗ nào

### Gộp ba nhánh: sạch, không xung đột
`git merge --no-edit` bằng chiến lược octopus, 12 file mới, **0 xung đột**. `pnpm typecheck` XANH ngay sau lượt gộp — khác dự đoán của đặc tả ("gần như chắc chắn ĐỎ"), vì ba worker đã khai trùng khớp cấu trúc các kiểu bắc cầu.

### Lệch 1 — hợp đồng ray công cụ và thanh trạng thái LỆCH THẬT, sửa phía hook
Đặc tả đoán đúng: hai bên lệch nhau.

| | Bản của hook (T5) | Bản của view (T6) = hợp đồng chốt |
|---|---|---|
| `WallLayerToolRailProps` | `{ items[], activeToolId }` | `{ activeTool, onSelectTool, canMerge, onMerge, readOnly }` |
| `WallLayerStatusBarProps` | `{ scaleLabel, saveLabel, saveState, reviewProgressLabel }` | `{ cursorLabel, scaleLabel, saveLabel }` |

Hợp đồng chốt thắng → **sửa phía hook**. Và để hai bên không lệch lần nữa, hook nay **đọc kiểu thẳng từ file view** (`import type` bị xoá lúc biên dịch nên không kéo component vào bản dựng của hook) thay vì giữ bản chép thứ hai. Cùng cách đó, `WallLayerCanvasViewProps` + bốn kiểu px bỏ hai bản chép ở hook và gateway, tất cả đọc từ `wallLayerHatch.ts`.

`reviewProgressLabel` không mất — nó vẫn ở `panel`, đúng một chỗ. `saveState` bỏ: `saveLabel` đã nói ra trạng thái tự lưu bằng tiếng Việt.

### Lệch 2 — `cursorLabel` chưa có đường dữ liệu nào, phải dựng mới
`cursorLabel` là trường của hợp đồng chốt nhưng **không có gì cấp nó**: không nơi nào trong màn theo dõi con trỏ. Một trường luôn rỗng là một ô đọc chết.

Đã nối thật, và nối theo cách giữ được luật "không hình học trong màn": `<svg>` mang `viewBox` đúng khổ ảnh bản vẽ, nên `getScreenCTM().inverse()` của **trình duyệt** trả thẳng toạ độ pixel bản vẽ (đã gộp cả dịch lẫn phóng). View chuyển tiếp hai con số; hook quy px→mm bằng `scale.pixelsToMillimetres` của `src/domain` rồi định dạng bằng `formatPoint`.

> Bản đầu của tôi làm phép trừ/chia ngay trong hàm dựng nhãn và **`local/no-raw-number` bắt được** ("cấm quy đổi đơn vị bằng phép chia trong src/screens"). Đó là luật bắt đúng. Đã sửa bằng thiết kế trên chứ **không** thêm dòng nào vào sổ nợ.

### Lệch 3 — `TreeItem` dùng chung làm hỏng HAI bộ soát bắt buộc
Không nằm trong dự kiến. `src/components/ui/TreeItem.tsx` gắn một nút con mắt mang `tabIndex={-1}` và `aria-label="Ẩn layer"`:

- `tabIndex={-1}` → nút bàn phím **không tới được** (A12) → `expectAccessible` đỏ ở 6/7 trạng thái;
- `"Ẩn layer"` → chữ tiếng Anh trong nhãn người đọc (A6) → `expectVietnamese` đỏ.

Màn lại **không truyền `onToggleVisible`**, nên nút đó còn không làm gì. `src/components/**` ngoài phạm vi sửa (R-68), nên theo đúng chỉ dẫn của đặc tả cho lớp bẫy này ("sửa view, được phép trong phạm vi hoà giải"), màn dùng hàng cây lớp của riêng nó: `<button role="treeitem">` thật, bàn phím tới được, nhãn tiếng Việt. Cờ hiện/ẩn lớp Tường không mất — nó sống ở `hiddenLayers` của kho, và chú giải đọc thẳng cờ đó.

### Lệch 4 — `WallLayerCanvas.tsx` vượt trần 400 dòng sau khi nối P3
446 dòng có nội dung. Đã tách `WallShapeFigure` ra `WallLayerShapeFigure.tsx` (mục D: phần con ra file anh em, `index.ts` giữ nguyên đường nhập). Nay 0 file vượt 400.

### Đúng kế hoạch
Route (đổi **đúng một dòng**, `RouteCanvas` giữ nguyên cho năm route anh em), container + `ScreenErrorBoundary` của `@/components/feedback`, i18n, bảy story, `docs/contracts/canvas.md`.

---

## (b) Câu hỏi đã hỏi và phương án chọn

Không gửi `ask` nào — mọi chỗ vướng đều tự quyết được từ luật đã ghi, và mỗi quyết định ghi lại ngay tại chỗ trong mã. Bốn quyết định đáng nêu:

1. **Sửa hook hay sửa view?** → sửa hook, vì hợp đồng điều phối viên chốt trùng bản của view. Thêm một bước ngoài yêu cầu: xoá hẳn bản chép thứ hai để hai bên không thể lệch lại.
2. **`onNavigate` bắt buộc hay tuỳ chọn?** → **bắt buộc**. R-73 nói rõ lối ra phải được cấp thật; một prop tuỳ chọn không ai truyền sẽ biến nút "Sang lớp Cửa và nội thất" cộng bốn mục cây lớp thành nút chết (A2).
3. **Story dựng view bằng props viết tay hay dựng container?** → **container thật + cổng giả**. Viewmodel của màn này là kết quả của hook cộng `resolveWallShapes`; viết tay bộ props đó là dựng lại logic hook bằng tay (R-61 cấm), và sẽ trôi khỏi màn sau lần sửa hook đầu tiên. Đổi lại, bài kiểm bảy trạng thái **mạnh hơn**: nó chứng minh màn THẬT sống sót, không chỉ một hàm view.
4. **`Space` (lắc canvas)** → **không đăng ký**. Kéo khung nhìn cần lớp canvas theo dõi cả một cử chỉ kéo, thứ hợp đồng canvas không có chỗ nhận. Đăng ký một phím không làm gì là đúng thứ A2 tồn tại để chặn. Ghi vào mục (d).

---

## (c) Kết quả nguyên văn

### 7.1 Ba cổng
```
--- typecheck ---   ĐẠT (exit 0)
--- lint ---        ĐẠT (0 lỗi, 0 cảnh báo)
--- test ---        Test Files  206 passed (206)
                    Tests  4266 passed (4266)
```

### 7.2 Nghiệm thu bàn phím — duyệt 5 tường CHỈ BẰNG BÀN PHÍM
```
dãy đếm lên:    12, 13, 14, 15, 16, 17
dãy đếm xuống:  16, 15, 14, 13, 12

Test Files  1 passed (1)
Tests  27 passed (27)
```
Điều hướng (`J`) và hoàn tác (`Ctrl+Z`) đi qua **sổ phím thật** (`registry.handleKeyDown`), không phải lời gọi tắt. Đây là dãy chạy trên **đúng fixture mà màn dùng** — xem P0 bên dưới.

### 7.3 Không có hình học trong màn
```
$ grep -rn "Math\." src/screens/qc/WallLayerReview/
[RỖNG]
```

### 7.4 Ba độ dày phân biệt được khi che hết chữ — hai lớp độc lập

**Lớp MÀU** — đo thật bằng công thức độ sáng tương đối WCAG trên ba hex của `src/styles/globals.css:180-182`, không chép lại con số từ tài liệu:
```
--wall-110  #B3ACA1  độ sáng tương đối = 0.4166
--wall-220  #8A8377  độ sáng tương đối = 0.2297
--wall-330  #5C564D  độ sáng tương đối = 0.0947
```
Mỗi bậc giảm gần một nửa → ba băng tách nhau cả khi chuyển thang xám. Phép kiểm `[NGHIEM-3]` khẳng định `wallStrokeToken` cho ra **ba token khác nhau**, đúng ba token trên.

**Lớp BỀ RỘNG** — `[NGHIEM-4]` đo trên chính `toCanvasShapes` (hàm hook dùng để dựng `canvas.shapes`), ba tường ngang cùng chiều dài khác độ dày, so bề cao hộp bao:
```
medium / thin  ≈ 2   (toBeCloseTo(2, 5))
thick  / thin  ≈ 3   (toBeCloseTo(3, 5))
→ tỉ lệ 110:220:330 = 1:2:3   ✓
```

### 7.5 Chú giải độ dày LUÔN hiện khi lớp Tường bật
```
Tests  8 passed | 30 skipped (38)
```
Bảy phép kiểm, mỗi trạng thái một, khẳng định đúng nhãn mà trạng thái đó phải cho ra; cộng một phép kiểm rằng **tắt lớp Tường là điều kiện DUY NHẤT** chú giải được ẩn. Ở `forbidden` và `collapsed`, chú giải hiện **đầy đủ** (không phải chữ "T" thu gọn) — ánh xạ chệch có chủ đích của `WallLayerLegend`, nay có phép kiểm giữ nó.

### 7.6 Soát luật
```
1) rg "from '@/(api|store|domain|lib/http)" … (views)   → [RỖNG]
2) rg "useState.*([Ll]oading|error)"                    → [RỖNG]
3) rg "['\"`](/|https?://)"                             → [RỖNG trong mã] *
4) rg "TODO|FIXME|stub"                                 → [RỖNG]
5) rg "\.(skip|only)\("                                 → [RỖNG]
6) rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]"      → [RỖNG]
7) rg "#[0-9A-Fa-f]{3,8}\b|rgb\(|hsl\("                 → [RỖNG]
8) rg "toFixed|toLocaleString"                          → [RỖNG]
9) rg "<ScreenErrorBoundary"                            → CÓ (WallLayerReview.container.tsx)
10) rg "expectSevenStates"                              → CÓ (WallLayerReview.test.tsx + 4 chỗ khác)
```
\* Mục 3: **rỗng trong mã**. Các dòng còn khớp đều là **văn xuôi trong chú thích** (ví dụ "`/projects/:id/floors/…`" khi giải thích route, "`before`/`after`" khi nói về ảnh chụp lệnh) — mẫu regex bắt cả dấu gạch chéo ngăn cách trong chú thích. Không một chuỗi đường dẫn nào được viết trong mã: container tra `ROUTES` của `@/routes/paths`, và bài kiểm khẳng định `toBe(ROUTES.layerObjects)` chứ không so với chuỗi viết tay.

Mục 7 và 8 từng khớp hai chỗ trong chú thích (ba mã hex khi giải thích lựa chọn token, và tên hai hàm định dạng khi nói rằng màn KHÔNG gọi chúng). Đã viết lại hai chú thích đó để chúng rỗng thật — cùng cách mà chú thích đầu `wallLayerReviewFixture.ts` cố ý tránh viết liền tên đối tượng toán học.

### 7.7 R-59 — sáu tên chuẩn
```
CÓ    index.ts
CÓ    WallLayerReview.tsx
CÓ    useWallLayerReview.ts
CÓ    WallLayerReview.container.tsx
CÓ    WallLayerReview.stories.tsx
CÓ    WallLayerReview.test.tsx
```
Thư mục có **20 file** — đúng và được phép (mục D; tiền lệ `PipelineFailure/` 16 file). `index.ts` xuất đủ năm nhóm (container, route, view, hook, cổng + bộ mẫu) nên không nơi gọi nào phải nhập sâu vào trong.

### 7.8 cycles và length
```
Import vòng (import/no-cycle) — quét src/
Import vòng: không có.

161 file đã quét · 18 vượt 250 · 0 vượt 400
```

### 7.9 Phạm vi sửa (R-68)

`git diff --name-only master...HEAD`, chia hai nhóm:

**(a) Trong ba nhóm được phép** — `src/screens/**`, `src/routes/**`, `src/i18n/**`:
```
src/i18n/vi.json
src/routes/router.tsx
src/screens/qc/WallLayerReview/  (17 file)
```

**(b) NGOÀI ba nhóm đó — liệt kê đầy đủ, KHÔNG tự quyết:**
```
docs/contracts/canvas.md          ← T8 sửa (bước 6 của đặc tả cho phép)
docs/contracts/logic.md           ← lớp 1 sinh ra, T8 KHÔNG chạm
docs/contracts/ui.md              ← lớp 1 sinh ra, T8 KHÔNG chạm
src/components/canvas/MiniMap.tsx     ← commit da1c323 của ĐIỀU PHỐI VIÊN, T8 KHÔNG chạm
src/components/canvas/ZoomCluster.tsx ← commit da1c323 của ĐIỀU PHỐI VIÊN, T8 KHÔNG chạm
docs/contracts/T8-bao-cao-tich-hop.md ← chính file này
```

Đã xác minh bằng `git diff --cached --name-only HEAD` (chỉ những gì T8 sửa, tách khỏi lượt gộp): **T8 chạm 0 file trong `src/components/**`**. Hai file `MiniMap`/`ZoomCluster` đến từ nhánh gốc `mungvu2004/wlr-scaffold` — ngoại lệ R-68 mà người duyệt đã chấp thuận và điều phối viên đã cài. Ba file `docs/contracts/*.md` là sản phẩm của lớp 1. **Xin đưa cả năm ra cổng duyệt của con người.**

### 7.10 `pnpm build` / `pnpm size`
**Không chạy theo chỉ đạo.** Cổng kích thước gói đang đỏ sẵn ở master vì lý do có trước công việc này.

---

## P0 — mã tường không hợp lệ: đã sửa tận gốc và CHỨNG MINH bằng số

Chuỗi nhân quả đã xác minh lại đầy đủ:
- `src/domain/spatial/ids.ts:40-43,95` — `MIN_BODY_LENGTH = 10`, `ID_BODY_PATTERN = /^[0-9A-Z]+$/`;
- `W-001` có thân dài **3** → `isIdOfKind('wall', 'W-001')` = `false`;
- `src/lib/commands/dispatch.ts:285` chặn ngay ở bước kiểm, trước cả dòng 319.

Đã sửa:
1. **Fixture sinh mã đúng khuôn `createId`** — `W-000014WALL` (tiền tố + 6 chữ số đếm + 4 ký tự đuôi), **tất định**, thuần cắt chuỗi, không một phép tính nào.
2. **Nhãn hiển thị GIỮ NGUYÊN** — `wallDisplayCode()` đọc ngược sáu chữ số đếm ra `W-014`, nên `codeLabel` vẫn là `#W-014` đúng đặc tả đòi. Hàm này đúng cho cả tường bộ mẫu lẫn tường người dùng vừa vẽ, không có bảng tra nào phải giữ đồng bộ.
3. **Tường ví dụ vẫn là tường thứ 14, 220 mm, `confidence 0.71`** — có phép kiểm khẳng định cả bốn điều đó cùng lúc.
4. **Bỏ lớp đánh lại mã trong `useWallLayerReview.test.ts`** — bài kiểm nay chạy trên đúng bộ mẫu mà màn dùng, không phải một bản sửa riêng.
5. **Bắt thêm một lỗi cùng loại T5 chưa thấy:** `createMockWallLayerReviewGateway.nextWallId` sinh `W-M1` — cũng không hợp lệ, tức lệnh **vẽ tường** sẽ bị từ chối. Đã sửa sang cùng khuôn.

Chứng minh: dãy đếm **12, 13, 14, 15, 16, 17 → 16, 15, 14, 13, 12** ở mục 7.2, chạy trên fixture thật.

---

## P3 — cụm thu phóng và bản đồ nhỏ đã nối

`ZoomCluster` nhận `zoomLevel`/`onZoomIn`/`onZoomOut`/`onResetZoom`/`onFitToScreen`; `MiniMap` nhận `initialViewport`/`onViewportChange`. Cả hai nối vào `zoom`/`viewCenter` thật của kho qua `setZoom`/`setViewCenter` — **cùng hai trường mà `viewport` của canvas vốn đọc ra**, nên đường dữ liệu nay đi hai chiều thay vì một.

Phím **`F`** (phủ khắp vùng đang chọn) **đã đăng ký**, vì nay có đường ra thật: nó phủ hộp bao của tường đang chọn, hoặc cả lớp tường khi chưa chọn gì. "Vừa khung" tính được **thật** vì canvas báo khổ khung lên qua `onFrameResize` (số của `ResizeObserver`, view không tính gì). Không có gì để phủ thì **không làm gì** — nhảy về một khung nhìn bịa còn tệ hơn đứng yên.

---

## (d) Việc còn nợ

1. **Không có đường lưu tường lên máy chủ (P1 — người duyệt đã chấp nhận).** `FloorWriteBody` không có mảng tường và không có `ENDPOINTS.*.walls`, nên `persistWallLayer` trả `unsupported` và màn chạy **trong bộ nhớ** (kho + ngăn xếp hoàn tác 100 bước). Đã ghi thành câu văn trong doc comment đầu `WallLayerReview.container.tsx` (không đặt `TODO`, R-69). **Cần một lượt lô-gic nhóm T để thêm đường lưu tường.**
2. **Phím `Space` (giữ để tạm kéo khung nhìn) chưa đăng ký.** Kéo khung nhìn cần lớp canvas theo dõi cả một cử chỉ kéo, thứ hợp đồng canvas không có chỗ nhận. Đăng ký một phím không làm gì là đúng thứ A2 chặn.
3. **`MiniMap` có `role="button"` + `tabIndex={0}` nhưng nhánh Enter/Space RỖNG** — bản đồ nhỏ lái được bằng chuột, chưa lái được bằng bàn phím (A12). Ngoài phạm vi ngoại lệ đã duyệt; **không tự sửa `useMiniMap`** theo đúng chỉ đạo.
4. **Công cụ đo (`measurement`) vẫn là `null`.** `WallLayerCanvasProps` đóng băng không có hàm xử lý con trỏ nào cho cử chỉ đo, nên không cử chỉ đo nào tới được máy công cụ. `null` là câu trả lời **thật** — một nhãn đo bịa ra sẽ là một số đo không ai đo (R-69). *Lưu ý: nay đã có đường con trỏ (`onPointerMove`) cho thanh trạng thái, nên lượt sau nối công cụ đo sẽ rẻ hơn nhiều.*
5. **`expectVietnamese` nới ĐÚNG một chữ: `"zoom"`.** Đến từ `ZoomCluster` (`aria-label="Điều khiển zoom"`, "Zoom hiện tại 100%…"), một component dùng chung ngoài phạm vi sửa. Tiền lệ: `ScaleCalibration.test.tsx` nới đúng chữ này vì cùng component. **Sáu chuỗi tiếng Anh khác mà lượt gộp tìm thấy đều được SỬA THẬT, không nới** — `"Ẩn layer"` (đổi component) và `"canvas"` trong câu rỗng của thanh tra (đổi thành "bản vẽ").
6. **`docs/contracts/canvas.md` còn vài câu lẻ nhắc "100/220/300"** ở các mục khác ngoài hai mục được giao sửa. Đã thêm **một banner ở đầu file** nói rõ hai kết luận đã bị đảo và mọi câu còn nhắc bộ số cũ phải đọc theo hai mục đã sửa. Sửa hết từng câu nằm ngoài phạm vi được giao.
7. **`pnpm build` / `pnpm size` chưa chạy** theo chỉ đạo — cổng kích thước gói đỏ sẵn ở master. Màn này thêm một chunk lazy mới; **chưa ai đo phần đóng góp của nó.**
