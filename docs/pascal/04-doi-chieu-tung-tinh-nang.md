# Mười màn của `src/screens/viewer` đối chiếu với Pascal — từng tính năng một

2026-09-28. Câu hỏi của người dùng: *"các thành phần trong editor của dự án đã dùng của Pascal
rồi thì sao không xoá cái editor hiện có đi, phần nào là riêng biệt của dự án thì tạo mới"*.

Đây là phép đo trả lời câu ấy. **109 tính năng**, mỗi dòng có bằng chứng **cả hai phía** —
đường dẫn:dòng bên AppFront và bên `vendor/pascal`, hoặc ghi rõ "grep → rỗng". Nhãn
**"không biết"** được dùng khi chưa đủ bằng chứng, và nó hợp lệ.

Cách đọc bốn nhãn:

| Nhãn | Nghĩa |
|---|---|
| **CÓ** | Pascal có thứ tương đương dùng được ngay |
| **CÓ nhưng mất X** | Pascal làm được, nhưng làm mất bất biến X của AppFront |
| **MỘT PHẦN** | có nhưng thiếu, hoặc khác cơ chế đủ để không thay nhau được |
| **KHÔNG** | Pascal không có |
| **KHÔNG BIẾT** | chưa đủ bằng chứng — nhãn hợp lệ, cần hơn một phỏng đoán |

---

## 0. Con số

| Nhãn | Số tính năng |
|---|---|
| **CÓ** (gồm "CÓ nhưng mất X") | **15** |
| **MỘT PHẦN** | **36** |
| **KHÔNG** | **49** |
| **KHÔNG BIẾT** | **9** |
| | **109** |

| Màn | Dòng | CÓ | MỘT PHẦN | KHÔNG | KHÔNG BIẾT |
|---|---|---|---|---|---|
| PropertyInspector + WallGeometryEditor | 27 | **7** | 8 | 8 | 4 |
| ViewerShell + Viewer3D + HistoryPanel | 28 | 3 | 9 | 13 | 3 |
| MeasurementTool + RoomAreaPanel | 30 | 3 | 11 | 14 | 2 |
| OverlayComparison + ExplodedView + FurnitureLibraryPanel | 24 | 2 | 8 | 14 | 0 |

---

# PHẦN A — Từng màn, từng tính năng

## A1. `WallGeometryEditor` (4 808 dòng)

Đây là một trong hai màn Pascal **thật sự** có đồ tương đương.

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 1 | Bảy trạng thái màn (empty/loading/collapsed/partial/forbidden/error/success) | `WallGeometryEditor.tsx:142-217`; test G1 `:429-448` | MỘT PHẦN | `use-auto-save.ts` chỉ 6 `SaveStatus`; `readOnly` rải rác ở `panel-manager.tsx`, không có nhánh "forbidden" mang câu giải thích | A11 |
| 2 | Kéo một đỉnh tường → **đúng một** bước hoàn tác | test N1 `:490-538` | **CÓ** | `nodes/src/wall/move-endpoint-tool.tsx:410-470` gọi `runAsSingleSceneHistoryStep` sau `pauseSceneHistory`/`resumeSceneHistory`; `handle-drag-history.ts` | A8, D-06 |
| 3 | Esc giữa lúc kéo trả đỉnh về toạ độ ban đầu, **không ghi** | test N4 `:657-732` | **CÓ** | `move-endpoint-tool.tsx` — `onCancel` gọi `restoreOriginal()` + `resumeSceneHistory` không commit, nghe `emitter.on('tool:cancel')` | A12 |
| 4 | Kéo góc tường → tường nối đi theo (**quyết định 3A**) | chính sách ở `00-quyet-dinh.md:24`; **mã thì chỉ kéo một tường** — `wallGeometryEditorGateway.ts` gọi `createDragWallEndCommand` cho một tường, không tra tường liền kề | **CÓ — và Pascal hơn** | `move-endpoint-tool.tsx:150-200` — `getLinkedWallSnapshots`, `getLinkedWallUpdates` cascade mọi tường chung góc trong **cùng một bước lịch sử**; Alt để tách | 3A |
| 5 | "Mất dấu xác minh" khi tường bị sửa | **không tìm thấy** — `lib/commands/business/shared.ts:19-24` nói rõ *"Review metadata is preserved on an update"*; chỉ lúc **tạo mới** mới đặt `reviewed:false` | KHÔNG | grep `confidence`/`reviewed`/`source.*ai` trên Pascal → rỗng (vài hit ở `nodes/src/duct-segment/*` không liên quan) | A5 |
| 6 | Cửa/ô mở **dịch theo tỉ lệ** khi kéo đỉnh tường | test N2 `:539-579`; `reflowOpenings` tại `wallCommands.ts:394` | KHÔNG | `core/src/schema/nodes/door.ts:58,155` — `position` là toạ độ cục bộ **cố định**, không phải phân số theo chiều dài. grep `reflow` chỉ ra `nodes/src/cabinet/**`. `move-endpoint-tool.tsx` lúc commit chỉ `updateNodes` cho tường, **không đụng** door/window con | — |
| 7 | Ba loại bắt điểm có tên trên màn: Đỉnh khác / Vuông góc / Trục lưới | test N3 `:586-656`; `wallGeometryEditorGateway.ts:22-28` | MỘT PHẦN | `tools/wall/wall-snap-geometry.ts:16` có `endpoint\|midpoint\|intersection\|wall`, cộng khoá góc 15° và đường gióng kiểu Figma. **Nhiều hơn**, nhưng không có nhãn "Vuông góc" riêng | A6 |
| 8 | Sửa ở 3D ⇒ mặt bằng 2D khớp | test N5 `:733-783` | **CÓ — và Pascal chặt hơn** | `nodes/src/wall/floorplan.ts:282` `buildWallFloorplan` dựng 2D **trực tiếp từ cùng một `WallNode`** — một nguồn dữ liệu, không phải đồng bộ hai chiều | — |
| 9 | Chip đối chiếu bản vẽ gốc do AI dò | test N6 `:784-820`; **gateway tự khai luôn trả `null`** vì không tầng nào giữ hình học gốc (`wallGeometryEditorGateway.ts:15-21`) | KHÔNG | grep `originalTrace\|sourceDrawing\|scannedTrace` → rỗng | A5 |
| 10 | Thêm/xoá đỉnh = `wall.split` / `wall.merge` | `wallGeometryEditorGateway.ts:29-32` | MỘT PHẦN | `nodes/src/wall/split-tool.tsx` có split thật. **Merge không có** — `mergeWallCutoutBrushes` (`viewer/src/systems/wall/wall-system.tsx:122`) là gộp **mesh** để vẽ, không phải lệnh nghiệp vụ | — |
| 11 | Bảng đỉnh sửa trực tiếp x/y trong ô nhập, nudge bằng phím mũi tên | `WallGeometryVertexTable.tsx:32-68`, `WallGeometryEditorOverlay.tsx:52-61` | KHÔNG | Không có bảng đỉnh dạng lưới; Pascal sửa toạ độ bằng kéo chuột / `MeasurementPill`, không ô nhập x/y | A12, A15 |
| 12 | Ghi bị từ chối luôn giải thích lý do; Esc thoát khi hết lớp trên | test `:843-880` | KHÔNG BIẾT | Không tra được cơ chế thông báo từ chối tương đương trong thời gian đối chiếu | A11, A12 |
| 13 | Ghi qua `commit(patch, label)`, không `set()` | `wallGeometryEditorGateway.ts:100` | MỘT PHẦN | Pascal ghi thẳng `useScene.getState().updateNodes(...)` bọc `pauseSceneHistory`/`resumeSceneHistory`/`runAsSingleSceneHistoryStep` — có khoanh vùng lịch sử nhưng **không có hàm `commit(patch,label)` tập trung** | A10 |

## A2. `PropertyInspector` (4 511 dòng)

Màn thứ hai Pascal có đồ tương đương — và là chỗ khung tương tác khớp nhất.

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 14 | Bảy trạng thái + khả năng tiếp cận + tiếng Việt + không màu thô | test `:391-462` | MỘT PHẦN | không có hợp đồng bảy-trạng-thái tương đương | A1, A6, A11, A12 |
| 15 | Số dòng hiển thị khác theo loại đối tượng, chân panel không trôi | test N2/N3 `:463-648` | KHÔNG BIẾT | `parametric-inspector.tsx` render động theo nhóm `parametrics`, nhưng không tìm thấy phép giữ layout ổn định tương đương | — |
| 16 | Giá trị lệch giữa nhiều đối tượng → dấu gạch ngang "—" | test N4 `:505-554`; `PropertyInspectorRow.tsx:249-254` | **CÓ** | `ui/panels/multi-field-value.ts:9-40` `reduceFieldValue` → `{kind:'mixed'}`; `multi-parametric-inspector.tsx`, `homogeneous-selection.ts` | — |
| 17 | Kéo độ dày tường: xem trước 3D **sống** trong lúc kéo (bản nháp) | test N1 bước 1 `:660-733` | **CÓ** | `multi-field-value.ts:129-138` `previewMultiNodeFields` qua `useLiveNodeOverrides` **trước khi** commit | — |
| 18 | Ghi vào mô hình, panel đọc lại đúng giá trị | test N1 bước 2 `:734-763` | **CÓ** | `multi-field-value.ts:141-160` `commitMultiNodeFields` → `scene.updateNodes` | A10 |
| 19 | Ctrl+Z hoàn tác đúng **một** bước; gộp kéo trong cửa sổ 400 ms (D-06) | test N1 bước 3-4 `:764-875` | **CÓ** | `runAsSingleSceneHistoryStep` — cùng cơ chế "một phiên = một bước", tuy gộp theo **phiên kéo** chứ không theo cửa sổ 400 ms tường minh | A8, D-06 |
| 20 | Đổi chiều cao tường: **từ chối kèm lý do** khi thấp hơn ô mở | test N6 `:876-959` | KHÔNG | không tìm thấy ràng buộc "chiều cao tường ≥ ô mở cao nhất" trong `nodes/src/wall/*`; `treatments.tsx:523` chỉ dùng `wallHeight` cho phào chỉ | A9 |
| 21 | Đổi bề rộng bao nội thất | test N7 `:960-1010` | **CÓ** (khác cơ chế) | `core/src/schema/nodes/item.ts:114,205-210` — đổi kích thước qua `scale`, không phải trường mm trực tiếp | A15 |
| 22 | Cảnh báo `FURNITURE-CLASH` **nêu đích danh** món đồ chồng lấn + liên kết "Xem quy tắc" | test N7; `PropertyInspectorRow.tsx:86-106` (nhóm `inspection`) | KHÔNG | `core/src/lib/item-polygon-overlap.ts` chỉ dùng nội bộ cho lưới đặt vật thể; grep `violation\|ruleCode` → rỗng | A9 |
| 23 | Bốn phím tắt `?`/Ctrl+F/Esc/Ctrl+S qua sổ đăng ký dùng chung; **không có nút Lưu** | test N8 `:1051-1177`; `SAVE_BUTTON_QUERY` chứng minh A7 | MỘT PHẦN | có Ctrl+S (`use-save-shortcut.ts`) và bảng phím tắt (`keyboard-shortcuts-dialog.tsx:62`); **không thấy `?` hay Ctrl+F** mở tìm-đối-tượng | A7, A12 |
| 24 | Tự lưu, chân panel hiện "Đã lưu lúc HH:MM" | test N9 `:1183-1233` | MỘT PHẦN | `use-auto-save.ts:9` debounce **1 000 ms** (không 800), có `SaveStatus` nhưng không thấy caption "Đã lưu lúc…" | A7 |
| 25 | Nút "Lưu làm khuôn mẫu" | test N9 thứ hai; `PropertyInspectorHeader.tsx:17,41-45` | KHÔNG BIẾT | `item-catalog.tsx`, `reference-panel.tsx` có khái niệm thư viện nhưng chưa xác nhận "lưu đối tượng đang chọn làm khuôn" | — |
| 26 | Duyệt / Bỏ qua → `reviewed:true` + `source:'human'` **cứng**; badge "đã xác minh" **chỉ** khi người duyệt bấm | `propertyInspectorGateway.ts:400-444`; `usePropertyInspector.ts:1617-1619` | KHÔNG | không có khái niệm duyệt/QC hay `source: ai\|human` trong Pascal | A5 |
| 27 | Trường "Độ tin cậy" dạng phần trăm | `usePropertyInspector.ts:709-711` | KHÔNG | grep `confidence` trên Pascal → rỗng | A5, A15 |
| 28 | Tám kiểu control (numeric/text/readonly/select/segmented/toggle/slider/link) | `PropertyInspectorRow.tsx:114-228` | MỘT PHẦN | `parametric-field-control.tsx` có number(Slider)/enum/color/vec3 — bộ kiểu **khác**, không có "link", không có nhóm "inspection" | A15 |

## A3. `ViewerShell` (4 414 dòng)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 29 | Bảy trạng thái màn | `ViewerShell.test.tsx:96-136`, `viewerShellTypes.ts:46-53` | KHÔNG | chỉ `isLoading` boolean (`editor/index.tsx:1471`) + `SceneErrorBoundary fallback={null}` (`viewer/render-error.tsx:29-45`) — lỗi render ra **màn trắng thật** | A11 |
| 30 | Vai Người xem có đủ ray, kể cả đo (VS-2, B-V9-04 — trước đây gỡ `đo`) | test `:138-172` | MỘT PHẦN | `isVersionPreviewMode` chặn nhiều nhánh phím sửa (`use-keyboard.ts:423,436,449`) nhưng là cờ xem bản cũ, **không phải vai RBAC** | — |
| 31 | Xếp tầng + độ tách **liên tục** (VS-3) | test `:173-207` | MỘT PHẦN | `levelModeLabels: stacked/exploded/solo` — ba nấc **rời rạc** (`viewer-controls-bar.tsx:43-47`) | — |
| 32 | Mặt phẳng cắt kéo được (VS-4, VS-7) | test `:208-234,297-363` | KHÔNG | grep `sectionPlane\|clipping` chỉ ra `near/far` của camera (`viewer-camera.tsx:44-57`), không phải mặt cắt | — |
| 33 | Panel phải trượt vào/ra, tôn trọng giảm chuyển động (VS-8) | test `:364-456` | MỘT PHẦN | sidebar đổi tab có thật (`app-sidebar.tsx`, `icon-rail.tsx`), **không thấy cơ chế giảm-chuyển-động** | B |
| 34 | Bản đồ nhỏ / ViewCube (VS-9) | test `:457-485` | KHÔNG | grep `ViewCube\|minimap\|ortho` → **rỗng cả ba** | — |
| 35 | `frameStorey` khuôn camera vào tầng (VS-11/12) | test `:510-700` | MỘT PHẦN | `Ctrl+↑/↓` đổi `levelId` + `markPerfAction('level-switch')` (`use-keyboard.ts:489-534`); **không xác nhận** có tự khuôn camera | — |
| 36 | `inspectorSections` — khe cắm nội dung (VS-13) | test `:701-787` | KHÔNG BIẾT | kiến trúc nội bộ AppFront, không có khái niệm tương đương để so | — |
| 37 | 13 phím tắt qua registry **có báo trùng** (A12) | `viewerShellShortcuts.ts:1-215` | MỘT PHẦN | rất nhiều phím tắt thật, nhưng là `addEventListener('keydown')` **rời rạc**, không registry, không báo trùng | A12 |
| 38 | Chip hiệu năng tam giác (VS-6) | test `:265-296` | **CÓ** | `perf-panel.tsx`, `perf-monitor.tsx`, `gpu-perf.ts` | — |

## A4. `Viewer3D` (3 929 dòng, 8 tệp kiểm)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 39 | Bảy trạng thái (V5-1) | `Viewer3D.test.tsx:34-70` | KHÔNG | như dòng 29 | A11 |
| 40 | Lỗi WebGL nói bằng câu thường (V5-2) | test `:104-114` | **CÓ (tiếng Anh)** | `unsupported-gpu-fallback.tsx:5-9` — đúng một đoạn tĩnh, **không đọc từ mã lỗi** | A6 |
| 41 | Không quyền: **gỡ nút khỏi DOM** (V5-2) | test `:115-126` | KHÔNG BIẾT | không tìm được cơ chế RBAC ẩn nút tương đương | — |
| 42 | Ô tìm đối tượng Ctrl+F, **không dấu**, mũi tên/Enter/Esc (Q2) | `ObjectSearch.test.tsx`, `roomSearch.test.ts`, `Viewer3D.test.tsx:189-287` | KHÔNG | grep `KeyF\|ctrl+f` → rỗng. Có `Cmd+K` command palette nhưng đó là tìm **lệnh**, không phải tìm phòng theo tên/mã không dấu | — |
| 43 | Lớp phủ cộng tác luôn có mặt (VO-1) | `Viewer3DOverlays.test.tsx:107-137` | KHÔNG | grep `presence\|collaborat\|cursor` không ra lớp phủ đa người dùng; chỉ có `SceneCommitOrigin: 'host'` (đồng bộ, không phải con trỏ người khác) | — |
| 44 | Chế độ sửa hình học tường (VO-2, VP-4) | `Viewer3DOverlays.test.tsx:138-160`, `Viewer3DPanels.test.tsx:279-310` | **CÓ** | `wall-move-side-handles.tsx`, `selection-manager.tsx`, hệ `systems/wall/*` | — |
| 45 | Ba bảng phụ loại trừ nhau trong cột 344 px (VP-2) | `Viewer3DPanels.test.tsx:188-234` | MỘT PHẦN | sidebar đổi tab có thật nhưng **bộ panel khác hẳn** (site/items/settings/zone); không có "Diện tích phòng"/"Lịch sử thao tác" | — |
| 46 | Esc đóng bảng phụ đang mở (VP-3, A12) | `Viewer3DPanels.test.tsx:248-278` | KHÔNG | `Escape` ở `use-keyboard.ts:397-409` chỉ huỷ công cụ/bỏ chọn, **không đóng sidebar panel** | A12 |
| 47 | `BuildQueue` tiến độ, giải phóng tài nguyên, nấc chi tiết | toàn `describe mountViewerScene` | MỘT PHẦN | `wall-progressive-budget.test.ts`, `wall-build-lifecycle.ts` gợi ý có dựng lũy tiến, **chưa đọc sâu để xác nhận cùng cơ chế** | — |

## A5. `HistoryPanel` (3 991 dòng)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 48 | Bảy trạng thái | `HistoryPanel.test.tsx:58-78`, `historyPanelTypes.ts:273` | KHÔNG | như dòng 29 | A11 |
| 49 | Hoàn tác **không phá huỷ** — mục cũ vẫn thấy, mờ đi (N1) | test `:126-153`, `useHistoryPanel.model.ts:17-20` | KHÔNG | `zundo` chỉ có `pastStates/futureStates` của toàn `SceneSnapshot` (`history-control.ts:8-23,36-43`) — không UI liệt kê, không "mục đã hoàn tác vẫn hiện mờ" | A8 |
| 50 | Dòng diff cũ→mới **theo từng trường** (N2) | test `:155-173`, `useHistoryPanel.model.ts:405-475` | KHÔNG | ảnh chụp toàn đồ thị, không có phép so từng trường để sinh câu diff | A15 |
| 51 | Chip loại việc `edit`/`review`/`ai` | `historyPanelTypes.ts:19-26,88-101` | KHÔNG | `provenance` của Pascal (`schema/provenance.ts:3-15`) là **lai lịch nguồn dựng hình** (scan/IFC/SketchUp), **không phải** cờ "ai đã duyệt" | A5 |
| 52 | Gộp theo ngày/phiên 30 phút, mục theo lô mở/thu (N3) | test `:174-228` | KHÔNG | không có UI dòng thời gian; `runAsSingleSceneHistoryStep` chỉ gộp ở tầng lưu trữ (`history-control.ts:252-278`), không hiện ra người dùng | — |
| 53 | Mỗi mục dẫn tới đối tượng, bấm thì khuôn camera (N5, R-07) | test `:248-278` | KHÔNG | không có | R-07 |
| 54 | Nhảy về một bước có hoạt cảnh 340 ms, không hộp thoại xác nhận | `useHistoryPanel.ts:17-24,240-294` | KHÔNG | `runUndo`/`runRedo` áp dụng tức thì, không hoạt cảnh (`lib/history.ts:132-160`) | B |
| 55 | **Hoàn tác kèm toast** | `lib/telemetry/events.ts:214` | **KHÔNG** | grep `sonner\|useToast\|toast\.` trên toàn `editor/src` → **rỗng**. `runUndo`/`runRedo` chỉ gọi `markPerfAction('undo')` — đo hiệu năng nội bộ, **không thông báo gì cho người dùng** | **A8** |
| 56 | `Ctrl+H` mở panel, **không giành** `Mod+Z` | `useHistoryPanel.ts:98-102,369-375` | không áp dụng | Pascal giữ `Ctrl+Z`/`Ctrl+Shift+Z` (`use-keyboard.ts:481-488`) nhưng không có panel để mà tránh giành phím | — |

## A6. `MeasurementTool` (5 252 dòng, 4 tệp kiểm)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 57 | Đo điểm-đến-điểm | `measurementToolTypes.ts:34`, `measurementToolViewModel.ts:216` | **CÓ nhưng mất A15** | `core/src/schema/nodes/measurement.ts:49` `DistanceMeasurement`; `core/src/lib/measurement-geometry.ts:30` | A15 (`toFixed`, dấu chấm — `editor/src/lib/measurements.ts:156,174`) |
| 58 | Đo **vuông góc với bề mặt** (point-to-plane) | `measurementToolTypes.ts:31`, viewmodel `:222-224` | KHÔNG | grep `pointToPlane\|perpendicular.*distance` → rỗng; `measurement-kind.ts:1-5` chỉ có distance/angle/area/perimeter/volume | — |
| 59 | Đo **chiều cao** | `measurementToolTypes.ts:32`, viewmodel `:219-221` | KHÔNG | `core/src/registry/types.ts:117-124` — `height` chỉ là loại **mồi bắt điểm**, không phải chế độ đo | — |
| 60 | Đo diện tích mặt sàn (≥3 điểm) | `measurementToolTypes.ts:33`, viewmodel `:210-212` | **CÓ nhưng mất A6, A15** | `measurement.ts:57` `AreaMeasurement` (tối thiểu 3 mốc) | A6 + A15 |
| 61 | Chip bắt điểm **luôn hiện tên loại** (đỉnh/trung điểm/giao trục) | `measurementToolGateway.ts` `SNAP_KIND_BY_ANCHOR`; test `:269-298` | MỘT PHẦN | `registry/types.ts:117-124`, `nodes/src/wall/measurement.ts:43-107` — bắt điểm **phong phú hơn** (endpoint/midpoint/edge/center/face/ridge) nhưng **không có "giao trục"** (grep `axisIntersection` → rỗng) | A6 |
| 62 | Ghim phép đo, tự đặt tên "Phép đo N" | `measurementToolGateway.ts` `NAME_PREFIX = 'Phép đo '`; test `:406` | **CÓ nhưng mất A6**; A7 không biết | `use-measurement-draft.ts` `commitMeasurementDraft`: `name: Measurement ${n}` | A6; A7 chưa xác nhận |
| 63 | Xoá phép đo đã ghim, **kèm toast hoàn tác** | `useMeasurementTool.test.tsx:492-524` | MỘT PHẦN, mất A8 | `deleteNode` + `zundo` toàn cục (`use-scene.ts:3-4,1552`); grep `toast` gần undo → không khớp | A8 |
| 64 | Đổi đơn vị mm/cm/m | `measurementToolTypes.ts` `MEASURE_UNITS` | MỘT PHẦN, mất A15 | `editor/src/lib/measurements.ts:3` chỉ `metric`/`imperial` **toàn cục**, không ba nấc | A15 |
| 65 | Giá trị đang đo **không "chạy số"** cho tới khi ghim/đổi đơn vị | test `:299-374` | KHÔNG BIẾT | `quick-measurement.ts` có HUD cập nhật theo con trỏ nhưng không đủ bằng chứng về việc cấm animate; **`@number-flow` có mặt trong deps của editor — khả năng vi phạm** | A15 |
| 66 | Phím M/Esc/Enter/Delete đều có nút chuột song song (A12) | `useMeasurementTool.ts` qua `shortcutRegistry`; test `:465-539` | MỘT PHẦN | `use-keyboard.ts:397,435,726` có M/Esc/Delete nhưng Delete là xoá node nói chung; chưa xác nhận nút chuột song song | A12 |
| 67 | Trạng thái "forbidden": đo được, **không ghim được**, có câu giải thích | `measurementToolTypes.ts` `canPin`, `pinBlockedCaption`; test `:540-608` | KHÔNG | grep `permission\|readOnly` quanh đo → rỗng; **Pascal không có khái niệm phân quyền** | — |
| 68 | Hover một hàng đã ghim: tô sáng, hàng khác mờ 0,3 | `MeasurementOverlay.tsx`; test `:609-628` | KHÔNG BIẾT | không thấy cơ chế hover-dim tương tự trong `floorplan-measurements-layer.tsx` | — |
| 69 | Bảy trạng thái | `measurementToolTypes.ts` `MeasurementScreenState`; test `:178-199` | KHÔNG | grep `sevenState` trên `vendor/pascal` → rỗng | A11 |
| 70 | Nhãn tiếng Việt viết thường toàn màn | `MEASURE_MODE_LABELS`, `SNAP_KIND_LABELS`; test `:200-228` | KHÔNG | mọi chuỗi Pascal là tiếng Anh (`'Measurement points must be on one plane.'`) | A6 |

## A7. `RoomAreaPanel` (3 090 dòng)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 71 | Bảng danh sách phòng, gộp theo tầng/công năng, **tổng phụ mỗi nhóm** | `useRoomAreaPanel.model.ts:387-416`; test `[N1]` | MỘT PHẦN | `editor/src/lib/floorplan/schedules.ts:211-258` `roomSchedule` liệt kê theo tầng, **không nhóm theo công năng, không tổng phụ** | A14 |
| 72 | Tổng diện tích, **đơn vị là phần tử riêng** | `roomAreaTypes.ts:133-146`; test `:402-414` | KHÔNG | `schedules.ts:293-297` — `toFixed(2) + ' m²'`, đơn vị **dính vào chuỗi** | A15 |
| 73 | Sắp xếp / đổi cách nhóm | `roomAreaTypes.ts:42-43` | KHÔNG | `schedules.ts:256` sắp cố định theo `number.localeCompare`, không có control | — |
| 74 | Hai chế độ: panel thu gọn / bảng toàn trang | `roomAreaTypes.ts:37,194-212` | KHÔNG | grep `'panel'\|'table'` cho phòng → rỗng; `ZoneQuantitiesPanel` là inspector **một** zone | — |
| 75 | Bộ chọn tầng lọc bảng | `useRoomAreaPanel.ts:245,313-314` | MỘT PHẦN | `zone-panel/index.tsx:137,145-146` lọc theo tầng **đang mở toàn ứng dụng**, không phải bộ chọn riêng | — |
| 76 | Thanh xếp chồng diện tích theo công năng, **tối đa 3 dải** (PQ-9) | `useRoomAreaPanel.model.ts:483-497`; test `[N2]` | KHÔNG | grep `stacked\|band\|distribution` → rỗng | A4 |
| 77 | Bấm một dòng: chọn phòng **và** khuôn camera 3D | `useRoomAreaPanel.ts:517-529` | MỘT PHẦN | `zone-panel/index.tsx:32-34` bấm chỉ chọn, **không tự khuôn camera** | — |
| 78 | Hover đồng bộ panel ↔ mô hình 3D | `roomAreaTypes.ts:167-168`; **AppFront tự nhận chưa nối** `useRoomAreaPanel.ts:34-40` | KHÔNG | `zone-panel/index.tsx` chỉ có CSS `:hover`, không báo ra ngoài | thiếu ở **cả hai** phía |
| 79 | Sửa tên phòng tại chỗ, tự lưu 800 ms, dòng nháy | `RoomAreaPanel.rows.tsx:153,164`, `useRoomAreaPanel.ts:441-511` | MỘT PHẦN, mất A7 | `zone-panel/index.tsx:63` tên **tĩnh**, không sửa tại chỗ; autosave toàn cảnh 1 000 ms qua `localStorage` | A7 |
| 80 | Hoàn tác đổi tên **kèm toast 8 giây** | `useRoomAreaPanel.ts:400-439` | MỘT PHẦN, mất A8 | Ctrl+Z toàn cục, **không toast gắn hành động** | A8 |
| 81 | Chấm trạng thái `trusted`/`suspect`/`reviewed` | `useRoomAreaPanel.model.ts:263-273`, `roomAreaTypes.ts:52` | KHÔNG | **`core/src/schema/nodes/zone.ts:5-48` không có `reviewed` lẫn `confidence`** | A4 + A5 |
| 82 | Bảy trạng thái | `useRoomAreaPanel.model.ts:554-584`; test `[G1]` | KHÔNG | `zone-panel/index.tsx:169-188` chỉ 2 nhánh | A11 |
| 83 | Trạng thái rỗng: nút "Kiểm tra khe hở tường" tách biệt `onRetry` | `roomAreaTypes.ts:178-190`; test `[N4]` | KHÔNG | `zone-panel/index.tsx:179-185` chỉ có "Add one"; máy dò khe hở **có** (`space-detection.ts:126,136`) nhưng không lộ ra UI | A8 |
| 84 | Thu gọn: 5 phòng lớn nhất, giảm dần | `useRoomAreaPanel.model.ts:422-470`; test `[N5]` | KHÔNG | grep `collapse\|largest` → rỗng | — |
| 85 | Sao chép bảng ra text / xuất | `useRoomAreaPanel.model.ts:590-625` | MỘT PHẦN | không copy-clipboard, nhưng **có xuất PDF thật** (`schedules.ts:266-272`) | — |
| 86 | Chú giải cách tính + đếm cửa/cửa sổ + chu vi/chiều cao mỗi dòng | `useRoomAreaPanel.model.ts:286-320` | MỘT PHẦN | `quantities-panel.tsx:254-288` có A/P/thể tích nhưng **chỉ cho một zone đang chọn**, không đếm cửa/cửa sổ, không câu chú giải | A15 |

## A8. `OverlayComparison` (4 300 dòng, 6 tệp kiểm)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 87 | Ba lớp thị giác (scan mờ / hình học / lệch gạch chéo) — **đúng ba, không được bốn** | `types.ts:100-118`; `OverlayComparisonCanvas.test.tsx:195-227` | MỘT PHẦN | `GuideNode` chỉ có **một** ảnh nền mờ (`core/src/schema/nodes/guide.ts:20`), không có lớp hình học chiếu + lớp lệch | A4 |
| 88 | Ba kiểu đối chiếu: chồng lớp / trượt / cạnh nhau | `types.ts:130-145` | KHÔNG | grep `swipe\|side.?by.?side` trên toàn `vendor/pascal` → **rỗng** | — |
| 89 | Đường chia đôi kéo chuột + phím mũi tên, tay cầm tự nói ra là gì | `OverlayComparisonCanvasDivider.tsx`; test `:287-348` | KHÔNG | không có cơ chế trượt nào để có tay cầm | A12 |
| 90 | Độ mờ ảnh nguồn chỉnh bằng thanh trượt % | `OverlayComparisonToolbar.tsx` | **CÓ nhưng mất A6/A15** | `GuideNode.opacity` (`guide.ts:20`), `SliderControl` (`reference-panel.tsx:29`) | A6, A15 |
| 91 | **Đo lệch tự động**: trung bình / lớn nhất / đếm vượt dung sai | `useOverlayComparison.test.ts:357-436` | KHÔNG | grep `deviation\|tolerance\|mismatch` trên toàn `vendor/pascal` → **rỗng** | — |
| 92 | Danh sách vùng lệch (tệ nhất lên đầu), chọn hàng vẽ đường đo | `OverlayComparisonPanel.tsx`; test `:59-127` | KHÔNG | không có khái niệm "vùng lệch" | — |
| 93 | Chỉnh dung sai (mm), đánh giá lại đồng bộ | test `:379-410` | KHÔNG | không có "dung sai" | A15 |
| 94 | Xác nhận "mô hình khớp bản vẽ" — **chỉ người bấm mới đặt được** | test `:451-486` *"confirmMatch() là đường duy nhất"* | KHÔNG | grep `confirmMatch` → rỗng; không có sign-off nào cho hình-học-so-với-bản-quét | A5 |
| 95 | Lệch tỷ lệ **giữa hai tầng** → lối sang màn Hiệu chỉnh tỷ lệ | `OverlayComparison.test.tsx:119-136` | MỘT PHẦN | `GuideNode.scaleReference` hiệu chỉnh tỷ lệ **một** ảnh tại chỗ (`reference-panel.tsx:32-38`), **không phát hiện lệch giữa hai tầng** | — |
| 96 | Chọn tầng, biết tầng đã có ảnh quét/hình học chưa | `types.ts:340-349` | MỘT PHẦN | `floating-level-selector.tsx` chọn tầng **có**, nhưng không có cờ `hasScan`/`hasGeometry` | — |
| 97 | Khoá ảnh không cho dịch/xoay khi đang vẽ theo | `toggleAlignmentLock` | **CÓ nhưng mất A6** | `setGuideLocked`, icon `Lock/Unlock` (`reference-panel.tsx:15-20`) | A6 |

## A9. `ExplodedView` (4 210 dòng)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 98 | Tách tầng theo trục đứng, ba mức 0 / 0,5 / 1 trên thanh trượt **liên tục** | `explodedViewTypes.ts:31-40`; `ExplodedViewRail.tsx` | MỘT PHẦN | nút bấm xoay vòng ba chế độ **rời rạc** Stacked→Exploded→Solo (`viewer-controls-bar.tsx:43-45,357-368`), khoảng cách **cố định** `EXPLODED_GAP=5`×index, có lerp mượt (`level-system.tsx`, `level-utils.ts:3-20`) | — |
| 99 | Thẻ tầng hiện **cao độ + diện tích**, bấm để kích hoạt **và** camera bay tới | `ExplodedViewFloorCards.tsx`; test `:317-350` | KHÔNG | `floating-level-selector.tsx` chỉ quản lý tên/thêm/xoá/sắp xếp; grep `elevation\|area` trong file → rỗng | — |
| 100 | Nhãn tầng **chỉ hiện khi tách đủ xa** (`LABEL_REVEAL_SEPARATION`) | test `:113-151` | KHÔNG | không có logic ngưỡng hiện/ẩn nhãn trong `level-system.tsx` | — |
| 101 | Chỉ báo **lệch trục giữa các tầng** (`alignFloors`, ngưỡng mm, ưu tiên lõi thẳng đứng) | `ExplodedViewAlignmentPaths.tsx`; test `:152-211,351-403` | KHÔNG | grep `misalign\|axis.*align` chỉ ra "axis-aligned" (thuật ngữ bao hình), **không có phát hiện lệch trục giữa tầng** | — |
| 102 | Giảm chuyển động → **nhảy thẳng**, không chạy hoạt cảnh | test `:212-234` `EXPLODED_MOTION_MS.reducedMs` | KHÔNG | grep `reducedMotion\|prefers-reduced-motion\|matchMedia` trong `level-system.tsx`/`level-utils.ts`/`viewer-controls-bar.tsx` → **rỗng** | B |

## A10. `FurnitureLibraryPanel` (2 407 dòng)

| # | Tính năng | Bằng chứng AppFront | Pascal | Bằng chứng Pascal | Bất biến |
|---|---|---|---|---|---|
| 103 | Lưới thẻ 2 cột, ảnh xem trước **bắt buộc đơn sắc** — cấm ảnh thật nhiều màu | `furnitureLibraryPanelTypes.ts:100-104` *"CẤM TUYỆT ĐỐI"* | **KHÔNG — mục đích đối lập** | `catalog-items.tsx` dùng `<img src={resolveCdnUrl(item.thumbnail)}>` — ảnh CDN thật, nhiều màu | A1 |
| 104 | 9 nhóm chip lọc cố định tiếng Việt + tìm **bỏ dấu** | `types.ts:41-53` | MỘT PHẦN | cây danh mục từ CSDL + ô tìm phía máy chủ (`function-tree-panel.tsx:47,72,183`), khác cấu trúc, tiếng Anh | A6 |
| 105 | Dải "Đã phát hiện" (nhóm YOLO) ghim đầu lưới + "Thay thế tất cả" theo lớp | `types.ts:83-93`; test `[FLP-2]` | KHÔNG | grep `yolo\|replace.?all` → rỗng | — |
| 106 | Thao tác hàng loạt **luôn xem trước**, xoá+thêm gộp một `runTransaction`, đúng **một** bước hoàn tác | test `[N4][N5][N5b]` | KHÔNG (khác luồng) | Pascal có sử lịch sử chung nhưng **không có bước "xem trước 0 thay đổi"** trước khi áp | A8 |
| 107 | **Kéo** thẻ vào cảnh, thả vào đối tượng đích | `onDragStart`, `onModelDropped(modelId, targetEntityId)` | MỘT PHẦN (khác cơ chế) | `activateCatalogItem` — **bấm để "vũ trang"** công cụ đặt theo con trỏ; grep `draggable\|onDragStart` trong `item-catalog/*.tsx` → **rỗng** | — |
| 108 | Không quyền: ẩn nút tải lên, thẻ khoá không kéo được | test `[FLP-3]` | KHÔNG | grep `role\|permission` trong `use-editor.tsx` → chỉ một hit không liên quan (`MaterialTargetRole`) | — |
| 109 | Chiều cao thật của model thư viện | `furnitureLibraryPanelGateway.ts:164` dùng `item.heightMm` thật | MỘT PHẦN — **hai bài toán khác nhau** | `ItemNode.asset.dimensions [w,h,d]` thật (`item.ts:99`). Nhưng đồ đạc AppFront xuất sang Pascal ở **cao 0 m**: `src/lib/pascal/toPascal.ts:64` `FURNITURE_HEIGHT_M = 0` | — |

---

# PHẦN B — Năm bất biến, và Pascal đứng ở đâu

| Bất biến | Pascal | Bằng chứng |
|---|---|---|
| **A5** — dấu "đã xác minh", `confidence`, `source: ai\|human` | **không tồn tại trong mô hình dữ liệu** | `core/src/schema/nodes/zone.ts:5-48` không có `reviewed` lẫn `confidence`; grep trên toàn `vendor/pascal` → rỗng. Thứ gần nhất là `schema/provenance.ts:3-15` nhưng đó là **lai lịch nguồn dựng hình** (scan/IFC/SketchUp), không phải "ai đã duyệt" |
| **A11** — bảy trạng thái; màn trắng là thất bại duy nhất A11 tồn tại để chặn | **Pascal làm ngược lại** | `viewer/src/components/viewer/render-error.tsx:29-45` dựng `fallback={null}` — lỗi render ra **màn trắng thật** |
| **A8** — mọi thay đổi hoàn tác được, **kèm toast** | có hoàn tác, **không có toast** | grep `sonner\|useToast\|toast\.` trên toàn `editor/src` → **rỗng**; `runUndo` chỉ gọi `markPerfAction('undo')` |
| **A6** · **A15** | tiếng Anh; `toFixed`, dấu chấm; đơn vị dán vào chuỗi | `editor/src/lib/measurements.ts:156,174`; `schedules.ts:293-297` |
| **A7** — tự lưu 800 ms, theo trường, về máy chủ, nói cho trình đọc màn hình | **khác cơ chế** | `use-auto-save.ts:9` — **1 000 ms**, chụp **toàn cảnh**, ghi **`localStorage`** |

**Đính chính một câu tôi đã nói sai trong phiên:** tôi báo tự lưu của Pascal "khớp mạnh với A7".
Không khớp — dòng cuối bảng trên là lý do.

---

# PHẦN C — Ba chỗ Pascal **hơn** AppFront

Phép đo này không chỉ đi tìm chỗ Pascal thiếu.

**C1. Quyết định 3A — Pascal có, AppFront thì không.**
`nodes/src/wall/move-endpoint-tool.tsx:150-200` (`getLinkedWallSnapshots`, `getLinkedWallUpdates`)
kéo theo **mọi tường chung góc** trong **cùng một bước lịch sử**, và có **Alt để tách**. Còn
`wallGeometryEditorGateway.ts` của AppFront chỉ gọi `createDragWallEndCommand` cho **một** tường.
Người dùng chốt 3A ngày **2026-09-18**; nó **chưa được thi công**.

**C2. Nửa sau của 3A — "mất dấu xác minh" — chưa ai làm, ở cả hai bên.**
`src/lib/commands/business/shared.ts:19-24` nói rõ *"Review metadata is preserved on an update"*:
chỉ lúc **tạo mới** mới đặt `reviewed: false`. Mọi tài liệu nhắc 3A như một hành vi đang chạy;
**nó không có trong mã.**

**C3. 2D dựng từ cùng một nguồn.**
`nodes/src/wall/floorplan.ts:282` `buildWallFloorplan` dựng mặt bằng **trực tiếp từ chính
`WallNode`** — một nguồn dữ liệu duy nhất, chặt hơn cách AppFront đồng bộ hai chiều rồi kiểm
bằng bài test N5.

---

# PHẦN D — Hai chỗ đổi cách đặt câu hỏi

## D1. Có mã đáng xoá — nhưng là mã **chưa làm xong của AppFront**

| Chỗ | Trạng thái thật | Bằng chứng |
|---|---|---|
| `OverlayComparison` (4 300 dòng) | **hôm nay không đo gì cả** — bốn khả năng lõi khai `supported: false` ngay trong `src/domain` | `overlayComparisonGateway.ts:52-64`: `imageToModelTransform`, `deviationRegions`, `matchMetrics`, `confirmFloorMatch` |
| Chip đối chiếu bản vẽ gốc của `WallGeometryEditor` | **luôn trả `null`** vì không tầng nào giữ hình học gốc | `wallGeometryEditorGateway.ts:15-21` |
| Hover đồng bộ của `RoomAreaPanel` | tự khai **chưa nối** | `useRoomAreaPanel.ts:34-40` |
| Cờ `isHeavy` của `FurnitureLibraryPanel` | docblock tự khai "cảnh nền tính bằng KHÔNG hôm nay" | `furnitureLibraryPanelGateway.ts` |

Câu hỏi "xoá gì" vì thế có một đáp án mà không ai hỏi tới: thứ đáng cân nhắc xoá là **phần chưa
bao giờ chạy**, không phải phần Pascal làm được. Đó là quyết định riêng, và là của người dùng.

## D2. `FurnitureLibraryPanel` và `item-catalog` giải hai bài toán **ngược nhau**

| | AppFront | Pascal |
|---|---|---|
| Ảnh xem trước | **"CẤM TUYỆT ĐỐI"** ảnh nhiều màu — phải đơn sắc, vì A1 | `<img src={resolveCdnUrl(item.thumbnail)}>` — ảnh CDN thật |
| Việc nó làm | soát và **thay thế** đồ đạc do AI dò ra từ bản vẽ | **đặt** mô hình `.glb` thật vào cảnh |
| Cách dùng | **kéo** thẻ, thả vào đối tượng đích | **bấm** để vũ trang công cụ đặt theo con trỏ |
| Dữ liệu | `Furniture` chưa lưu chiều cao → xuất sang Pascal ở **cao 0 m** | `ItemNode.asset.dimensions [w,h,d]` thật |

Không phải một bên thiếu tính năng của bên kia. Là hai màn khác nhau tình cờ cùng tên.

---

# PHẦN E — `HistoryPanel`: vì sao hai ngăn xếp không ghép được

| | AppFront | Pascal |
|---|---|---|
| Đơn vị lưu | **lệnh có ngữ nghĩa** `Command { actorId, description, changes: EntityChange[] }` | **ảnh chụp toàn cảnh** `SceneSnapshot` (nodes + collections + materials + plugins) |
| Báo cho người dùng khi hoàn tác | **toast** (A8) | không có gì — `grep toast` trên `editor/src` → rỗng |
| Diff từng trường | có (`useHistoryPanel.model.ts:405-475`) | không — ảnh chụp không so trường được |
| Ai làm / loại việc | `edit` / `review` / `ai` | `provenance` = lai lịch **nguồn dựng hình**, không phải người duyệt |
| Nhãn người đọc được | tiếng Việt, sinh từ `description` của lệnh | không có |

Ghép hai thứ này **không phải "nối hai ngăn xếp"** — là **dựng lại `HistoryStack` từ đầu trên nền
`zundo`**: phải viết một tầng dịch từ ảnh chụp sang lệnh có ngữ nghĩa, mà thông tin ngữ nghĩa ấy
`zundo` **không bao giờ lưu**, nên nó không nằm ở đó để mà dịch.

---

# PHẦN F — Chín chỗ "không biết", để ai làm tiếp biết phải đo gì

| # | Câu hỏi chưa trả lời được | Vì sao cần |
|---|---|---|
| 12 | Pascal báo "ghi bị từ chối" thế nào? | quyết định có tái dùng được tầng validate không |
| 15 | Pascal giữ layout panel ổn định thế nào? | ảnh hưởng cảm giác dùng, không ảnh hưởng dữ liệu |
| 25 | Pascal có "lưu đối tượng làm khuôn mẫu" không? | có thì bớt một màn phải viết |
| 36 | `inspectorSections` — có khái niệm tương đương không? | kiến trúc khe cắm |
| 41 | Pascal ẩn nút theo quyền thế nào? | **nghi là không có** — cần xác nhận |
| 47 | `BuildQueue` của Pascal có cùng cơ chế không? | ảnh hưởng hiệu năng màn lớn |
| 62 | Độ trễ tự lưu của phép đo có phải 800 ms? | A7 |
| 65 | `@number-flow` có làm số **chạy động** lúc đang đo không? | **nghi vi phạm A15** — cần đo |
| 68 | Pascal có hover-dim cho hàng đã ghim không? | nhỏ |

---

# PHẦN G — Kết luận và việc tiếp theo

**Không màn nào xoá được hôm nay.**

| Màn | Phán quyết | Điều kiện để xoá được |
|---|---|---|
| `PropertyInspector` | **ứng viên** — tầng tương tác | viết mới tầng QC: duyệt/`confidence`/`source`, cảnh báo va chạm nêu tên, ràng buộc chiều cao–ô mở |
| `WallGeometryEditor` | **ứng viên** — tầng tương tác | viết mới: ô mở dịch theo tỉ lệ, bảng đỉnh x/y, chip đối chiếu bản vẽ AI |
| `MeasurementTool` | không | Pascal thiếu đo vuông góc, đo chiều cao, bắt giao trục; mất A6/A15 |
| `RoomAreaPanel` | không | Pascal chỉ có inspector một zone |
| `HistoryPanel` | không | xem PHẦN E — phải dựng lại từ đầu |
| `ViewerShell` · `Viewer3D` | không | thiếu bảy trạng thái, mặt cắt, ViewCube, tìm không dấu, registry phím tắt |
| `OverlayComparison` | không | `grep deviation\|tolerance\|mismatch` → rỗng; và **chính AppFront cũng chưa làm xong** |
| `ExplodedView` | không | Pascal ba chế độ rời rạc, khoảng cách cố định; thiếu thẻ tầng, chỉ báo lệch trục, giảm chuyển động |
| `FurnitureLibraryPanel` | không | bài toán ngược nhau — xem D2 |

Câu *"Pascal đã làm rồi thì xoá cái cũ đi"* đúng cho **15/109 tính năng**. **49** tính năng Pascal
**không có**, và **36** nữa chỉ có một phần hoặc mất một bất biến.

**Việc đúng tiếp theo, theo thứ tự:**

1. **Dựng màn xem Pascal cho chạy thật** — để có thứ thay thế trước khi bàn xoá.
2. **Thi công 3A** — Pascal đã có sẵn (C1), AppFront thì chưa. Đây là việc *thêm* giá trị bằng mã
   đã có, không phải việc xoá.
3. **Quyết định riêng về mã chưa làm xong** (D1) — xoá hay làm nốt.
4. **Rồi mới bàn từng màn**, mỗi lần một commit kèm `pnpm verify`.
