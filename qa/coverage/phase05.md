<!-- qa-sources fe=fa991a0d -->
# Phase 05 — 3D: FE coverage inventory

Screens SCR-23 Viewer 3D (`/projects/:p/3d`), SCR-24 Exploded View (`/3d/exploded`), SCR-25 Measurement Tool
(`/3d/measure`), SCR-26 Pascal Viewer (`/3d/pascal`), SCR-27 Mobile Viewer (`/m/du-an/:p`). Source `F:/App/AppFront` @
fa991a0d. Backend rules (N15/N16 reads, #17/#18 measurement rules, `MEASUREMENT_LIMIT_REACHED`, `MEASUREMENT_ID_TAKEN`,
viewer 403, feature-flag endpoint) live in `coverage/phase05-be.md` (API spec), not here.

Test keys:
- **M** `tests/phase05_3d_viewer.spec.ts` (own `qa-<runId>-m05-…` project, two seeded floors via `support/layerSeed.ts`; serial in
  SCR-25 only — SCR-23 cases open the viewer themselves, BUG-494) — title quoted by its prefix.
- **E** `tests/phase05_3d_viewer_edge.spec.ts` (non-serial, own project per test) — `E05 · …` titles, quoted by their key words.
- **R9** `tests/phase09_roles_matrix.spec.ts` (Track B mock, viewer).
- **UI** dedicated UI-verify spec `phase05_*_ui.spec.ts` (owner: qa-verify-ui step; not counted here).

Path short names: `V3/` = `src/screens/viewer/Viewer3D/`, `VS/` = `…/ViewerShell/`, `EX/` = `…/ExplodedView/`,
`MT/` = `…/MeasurementTool/`, `PV/` = `…/PascalViewer/`, `MV/` = `src/screens/system/MobileViewer/`,
`PI/` = `…/viewer/PropertyInspector/`, `RAP/` = `…/viewer/RoomAreaPanel/`, `WGE/` = `…/viewer/WallGeometryEditor/`,
`PSG` = `src/components/feedback/ProjectSpatialGate.tsx`.

## Shared — project gate and shell (all four desktop 3D routes + mobile)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 1 | Network | `GET /api/projects/:p` (#24) + `GET /api/projects/:p/spatial` (N15) on open | `hooks/useProjectSpatial.ts:104-123` | M SCR-23 load (N15 200), E every seeded test | covered |
| 2 | State | 404 project → "Không tìm thấy dự án này" + description, inside `<main>` | `PSG:36-38,47-60,73-75`, `V3/Viewer3D.container.tsx:424` | E "SCR-23 unknown project id", E "SCR-27 unknown project id" | covered |
| 3 | Navigation | "Về danh sách dự án" → `/` | `PSG:39,56` | E "SCR-23 unknown project id" | covered |
| 4 | Error | N15 5xx with no graph → gate EmptyState (errors.unknown, not retryable → no button) | `PSG:77-90`, `lib/errors/kinds.ts` unknown | E "SCR-23 [mocked response] GET …/spatial 500" | covered |
| 5 | Error | N15 refresh fails with graph loaded → InlineAlert "Không tải lại được mô hình." + "Thử lại" | `PSG:95-101`, `useProjectSpatial.ts:125-128` | — | gap (needs a 5xx after a successful first read on the same page: mock only, P3) |
| 6 | State | Route without project id → "Thiếu mã dự án" | `V3/Viewer3D.container.tsx:170-172,411-421`, `EX/ExplodedView.container.tsx:84-86`, `MV/MobileViewer.container.tsx:56-58` | — | n/a-by-design (router pattern always carries `:projectId`; unreachable from a URL) |
| 7 | Crash | ScreenErrorBoundary fallback (EmptyState from report) | `V3/Viewer3D.container.tsx:195-208,375-379` | — | gap (no safe way to make the screen throw on the real stack) |
| 8 | Layout | Top bar "Thanh trên khung nhìn", breadcrumb "Đường dẫn màn hình" (project name + "Mô hình 3D" aria-current) | `VS/ViewerTopBar.tsx:49`, `VS/ViewerChrome.tsx:46-82`, `VS/useViewerShell.ts:1062-1063` | E "SCR-23 breadcrumb + status bar" | covered |
| 9 | Navigation | Breadcrumb project link (button) | `VS/ViewerChrome.tsx:67-77` | — | UNKNOWN (crumb `onClick` not set in `useViewerShell.ts:1062`; renders as plain text — no target to test) |
| 10 | Status | Status bar "Thanh trạng thái": "N tầng · M phòng · area" + aria-live "Đang dựng mô hình…"/"Mô hình đã dựng xong." | `VS/ViewerStatusBar.tsx:26-36`, `VS/useViewerShell.ts:197-206,979-990` | E "SCR-23 breadcrumb + status bar" (summary) | covered (live text not asserted: sr-only, P3) |
| 11 | Select | "Góc nhìn sẵn": Phối cảnh / Trục đo / Trên xuống / Mặt cắt | `VS/ViewerTopBar.tsx:64-84`, `VS/useViewerShell.ts:176-181` | M SCR-23 presets, E "SCR-23 ViewCube face" (Trục đo) | covered |
| 12 | Segmented | "Chế độ xem" 2D / 3D | `VS/ViewerTopBar.tsx:13-16,56-62` | M SCR-23 presets | covered |
| 13 | Group | ViewCube "Khối định hướng" faces (aria-pressed), click → preset | `VS/ViewerOverlays.tsx:42-75` | E "SCR-23 ViewCube face" | covered |
| 14 | Toolbar | "Công cụ khung nhìn": Quay quanh mô hình (R), Kéo màn (H), Đo (M), Mặt cắt (C), Chọn (V), Cô lập (Alt+H) | `VS/ViewerToolRail.tsx:46-72`, `VS/useViewerShell.ts:167-173` | E "SCR-23 tool rail keys" | covered |
| 15 | Keyboard | Keys R/H/M/C/V activate the tool | `VS/viewerShellShortcuts.ts:73-89,143-153` | E "SCR-23 tool rail keys" | covered |
| 16 | Listbox | Storey rail options "{name}, cao độ {elevation}", aria-selected; Shift+click additive | `VS/ViewerStoreyRail.tsx:56-79`, `VS/useViewerShell.ts:622-630` | E "SCR-23 storey rail" | covered |
| 17 | Keyboard | Digits 1-4 select the n-th storey from the bottom | `VS/viewerShellShortcuts.ts:44,133-141` | E "SCR-23 storey rail" (digit 2) | covered |
| 18 | Toggle | Storey eye "Ẩn {inline name}" / "Hiện {inline name}" (aria-pressed; "Tầng 1" → "Ẩn tầng 1", BUG-384) | `VS/ViewerStoreyRail.tsx:86-106`, `VS/useViewerShell.ts:167-169,623` | E "SCR-23 storey rail" | covered |
| 19 | Slider | "Độ tách" range 0–1, step 0,01, disabled while the exploded view is empty (`useExplodedView.ts:937`, BUG-389; also the separation control of SCR-24's normal layout) | `VS/ViewerStoreyRail.tsx:114-130`, `VS/useViewerShell.ts:1099` | E "SCR-23 separation" (value), M SCR-24 (Home key), E "SCR-24 presets" (value, Space) | covered |
| 20 | Keyboard | E toggles separation 0 ↔ remembered (0,5) | `VS/viewerShellShortcuts.ts:62,202-210`, `VS/useViewerShell.ts:142,466,848-849` | E "SCR-23 separation" | covered |
| 21 | Group | Zoom cluster "Thu nhỏ", "Mức thu phóng {x}, bấm để về mức chuẩn", "Phóng to", "Vừa khung hình" | `VS/ViewerChrome.tsx:125-166`, `VS/useViewerShell.ts:1002-1010,1102-1108` | E "SCR-23 zoom cluster" | covered |
| 22 | Keyboard | O orthographic, 0 fit all, F frame selection (fit all when nothing selected) | `VS/viewerShellShortcuts.ts:47-59,157-201`, `VS/useViewerShell.ts:686-700` | M SCR-23 presets | covered |
| 23 | Keyboard | Shift+H hide selection, Alt+H isolate selection | `VS/viewerShellShortcuts.ts:52-56,175-192` | — | gap (needs a selected entity on the canvas; P3) |
| 24 | Keyboard | Esc deselects (scope canvas) | `VS/viewerShellShortcuts.ts:231-244` | M SCR-23 presets | covered |
| 25 | Pointer | Wheel zoom, drag orbit, double-click | `VS/ViewerViewport.tsx:100-111` | M SCR-23 presets (wheel) | covered (drag/double-click: gap P3) |
| 26 | Overlay | Elevation scale "Cao độ tầng", legend "Chú giải" (Tường 110/220/330, Ô mở), minimap | `VS/ViewerOverlays.tsx:93-141,218`, `VS/useViewerShell.ts:190-193` | — | gap (display only; UI-verify owns it) |
| 27 | Overlay | Hover label beside the pointer | `VS/ViewerViewport.tsx:137-152`, `VS/useViewerShell.ts:1012-1024` | — | gap (P3) |
| 28 | State | Shell loading skeleton + `aria-busy` | `VS/ViewerViewport.tsx:90,130-134` | M SCR-23 load (aria-busy false), E (openViewer) | covered |
| 29 | State | Shell forbidden (viewer role): inspector "Chỉ xem" + "Bạn đang xem ở vai người xem…" | `VS/ViewerInspector.tsx:82-89`, `VS/useViewerShell.ts:580-583` | — | gap (role matrix; Track B R9 covers SCR-25 only) |
| 30 | State | Shell error InlineAlert "Không đọc được dữ liệu" + "Thử lại" | `VS/ViewerInspector.tsx:66-74`, `VS/useViewerShell.ts:209-210,585-587,1119` | — | gap (projectQuery error with a working gate: mock only, P3) |
| 31 | State | Collapsed (narrow): rails float over the viewport, inspector width 0 | `VS/ViewerShell.tsx:112,130-170,208-218` | — | gap (UI-verify 768/375 owns the layout) |

## SCR-23 Viewer 3D (`/projects/:p/3d`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 32 | State | success: canvas with model pixels, Draco under CSP | `V3/Viewer3D.tsx:215-217,254-258` | M SCR-23 load | covered |
| 33 | State | empty: "Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường." | `V3/Viewer3D.tsx:46-57,219`, `V3/useViewer3D.ts:681-683` | E "SCR-23 floor without walls" | covered |
| 34 | Link | "Quay lại xem lớp tường" → walls of the first storey | `V3/Viewer3D.tsx:52-54`, `V3/useViewer3D.ts:754-757` | E "SCR-23 floor without walls" | covered |
| 35 | State | loading "Đang dựng mô hình N tầng — x%" | `V3/Viewer3D.tsx:59-80`, `V3/useViewer3D.ts:641-650` | — | gap (transient; P3) |
| 36 | State | partial: per storey "Tầng đã dựng xong" / "{name} — chưa có tường hay phòng nào" | `V3/Viewer3D.tsx:82-150`, `V3/useViewer3D.ts:120-126,653-662,685-686`, `VS/viewerShellGateway.ts:184` | E "SCR-23 two floors, one without walls" | covered |
| 37 | State | error / WebGL unavailable: "Trình duyệt này chưa xem được mô hình 3D", "Thử lại", "Xem bản 2D" (→ floors) | `V3/Viewer3D.tsx:152-183`, `V3/useViewer3D.ts:671-672,700-703,753` | — | gap (no WebGL-less browser / build failure on the real stack) |
| 38 | State | forbidden sr-only "Bạn đang xem ở vai người xem nên không sửa được hình học…" | `V3/Viewer3D.tsx:260-266` | — | gap (role matrix) |
| 39 | Button | "Tìm phòng" trigger, only with rooms | `V3/ObjectSearch.tsx:58,172-193` | M SCR-23 room search, E "SCR-23 room search", E "floor without walls" (absent) | covered |
| 40 | Keyboard | `/` and Ctrl+F open the search | `VS/viewerShellShortcuts.ts:92,212-220`, `V3/ObjectSearch.tsx:113-122` | M SCR-23 room search (`/`), E "SCR-23 room search" (`/`) | covered (Ctrl+F: gap P3) |
| 41 | Combobox | "Tìm phòng theo tên hoặc mã", focus on open, placeholder "Tên hoặc mã phòng" | `V3/ObjectSearch.tsx:61,127-131,203-227` | E "SCR-23 room search" | covered |
| 42 | Listbox | "Kết quả tìm phòng" rows (name · code · storey · area), click selects + frames | `V3/ObjectSearch.tsx:64,229-256`, `V3/useViewer3D.ts:728-736` | M SCR-23 room search | covered |
| 43 | Empty | "Không có phòng nào khớp" | `V3/ObjectSearch.tsx:67,258-262` | E "SCR-23 room search" | covered |
| 44 | Hint | "Còn phòng nữa — gõ thêm để thu hẹp" (> MAX_ROOM_RESULTS) | `V3/ObjectSearch.tsx:264-268`, `V3/roomSearch.ts` | — | gap (needs more rooms than MAX_ROOM_RESULTS; P3) |
| 45 | Keyboard | ArrowDown/Up wrap, Enter chooses, Esc closes and focus returns to "Tìm phòng" | `V3/ObjectSearch.tsx:127-137,147-170` | E "SCR-23 room search" | covered |
| 46 | Inspector | "Thanh tra đối tượng": "Chưa chọn đối tượng" + hint | `VS/ViewerInspector.tsx:55,91-101`, `VS/useViewerShell.ts:197` | M SCR-23 presets, E "SCR-23 selected room" | covered |
| 47 | Inspector | Selection title + rows (Mã đối tượng, Diện tích, độ dày) | `VS/ViewerInspector.tsx:104-115`, `VS/useViewerShell.ts:946-975` | M SCR-23 room search (name), E "SCR-23 room search" | covered |
| 48 | Panel | "Thuộc tính đối tượng đã chọn" → PropertyInspector "Thuộc tính đối tượng", text row "Tên" | `V3/Viewer3DPanels.tsx:118,228-244`, `PI/PropertyInspector.tsx:69,200`, `PI/usePropertyInspector.ts:215` | E "SCR-23 selected room" | covered |
| 49 | Button | PropertyInspector "Đóng" clears the selection | `PI/PropertyInspectorHeader.tsx:18,46`, `V3/Viewer3D.container.tsx:325` | E "SCR-23 selected room" | covered |
| 50 | Panel | PropertyInspector edits (Duyệt / Bỏ qua, row edits, "Lưu làm khuôn mẫu", "Xem quy tắc", link rows) | `PI/PropertyInspectorFooter.tsx:10-11`, `PI/PropertyInspectorHeader.tsx:17`, `PI/PropertyInspectorRow.tsx:31-34,218-223` | — | gap (inspector writes go through autosave; P2, next edge round) |
| 51 | Button | "Sửa hình học tường" only for a selected wall (W- id); hidden for a room | `V3/Viewer3DPanels.tsx:123,246-265`, `V3/Viewer3D.container.tsx:305-307` | M SCR-23 wall selected, E "SCR-23 selected room" (absent) | covered |
| 52 | Region | Wall geometry editor "Sửa hình học tường", vertex table "Toạ độ x/y {code}" | `WGE/WallGeometryEditor.tsx:149,166,204`, `WGE/WallGeometryVertexTable.tsx:57,113-118` | M SCR-23 wall selected | covered |
| 53 | Network | Vertex edit → autosave `PUT …/floors/:f/spatial/layer` | `V3/useViewer3DSave.ts`, `hooks/useAutosave.ts` | M SCR-23 wall selected | covered |
| 54 | Validation | Invalid vertex value → "Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ.", no PUT; the field should show the old number | `WGE/wallGeometryEditorTypes.ts:530`, `WGE/useWallGeometryEditor.ts:385,927-944`, `WGE/WallGeometryVertexTable.tsx:41` | E "SCR-23 wall picked → invalid vertex" | covered — FAILS on the real stack (field keeps "abc", see Summary) |
| 55 | Toggle | "Thoát chế độ sửa hình học" (aria-pressed) closes the editor | `V3/Viewer3DPanels.tsx:124,248-263`, `V3/Viewer3D.container.tsx:309-311` | E "SCR-23 wall picked → invalid vertex" | covered |
| 56 | Button | Editor band "Xong" | `WGE/WallGeometryEditorBand.tsx` | M SCR-23 wall selected | covered |
| 57 | Toolbar | Editor tools V/A/X/T/N/H (Di chuyển đỉnh, Thêm đỉnh, Xoá đỉnh, Tách tường, Nối tường, Đặt lại chiều cao) + refusals | `WGE/wallGeometryEditorTypes.ts:510-515,590-597`, `WGE/useWallGeometryEditor.ts:691-736` | — | gap (P2: canvas gestures per tool) |
| 58 | Keyboard | Esc leaves the top layer of the editor | `WGE/useWallGeometryEditor.ts:608-609` | — | gap (P3) |
| 59 | State | Editor locked in section orthographic / multi-wall height only | `WGE/wallGeometryEditorTypes.ts:567,578-579` | — | gap (P3) |
| 60 | Nav | "Bảng phụ của khung nhìn 3D": Diện tích phòng / Thư viện đồ đạc / Lịch sử thao tác (aria-expanded, exclusive) | `V3/Viewer3DPanels.tsx:87-98,174-201,267-276` | M SCR-23 side panels | covered |
| 61 | Toggle | Clicking the open panel's button closes it | `V3/Viewer3DPanels.tsx:193-195` | E "SCR-23 Diện tích phòng with no room" | covered |
| 62 | Keyboard | Esc closes the open side panel | `V3/Viewer3DPanels.tsx:207-218` | M SCR-23 side panels | covered |
| 63 | Panel | Rooms panel empty "Chưa khép được vòng phòng nào" + "Kiểm tra khe hở tường" → walls of the floor | `RAP/RoomAreaPanel.chrome.tsx:57-60`, `RAP/RoomAreaPanel.tsx:158-169`, `RAP/useRoomAreaPanel.model.ts:575-576`, `V3/Viewer3D.container.tsx:272-280` | E "SCR-23 Diện tích phòng with no room" | covered |
| 64 | Panel | Rooms panel ready/partial/collapsed: level select, grouping, sort, "Sao chép bảng", full-page table, export | `RAP/RoomAreaPanel.chrome.tsx:43-70`, `RAP/RoomAreaTable.tsx:75-84` | — | gap (P2, next edge round) |
| 65 | Panel | Furniture library "Thư viện nội thất" (filters, upload, drag-drop, "Xoá bộ lọc") | `src/screens/viewer/FurnitureLibraryPanel/FurnitureLibraryPanel.tsx:74-83` | M SCR-23 side panels (opens) | gap (content; plan G7: ModelLibrary writes off) |
| 66 | Panel | History "Lịch sử chỉnh sửa" timeline, category chips | `src/screens/viewer/HistoryPanel/HistoryPanel.chrome.tsx:49-52` | M SCR-23 side panels (opens) | gap (content; P3) |
| 67 | Nav | "Màn 3D khác": Tách tầng / Công cụ đo / Đối chiếu bản vẽ (overlay only with a floor) | `V3/Viewer3DPanels.tsx:104-115,221-224,278-294`, `V3/Viewer3D.container.tsx:261-270` | M SCR-23 sibling navigation | covered |
| 68 | Save | Save strip (reload / blocked banner, A9) on /3d | `V3/Viewer3D.tsx:290-296`, `V3/Viewer3D.container.tsx:226,319` | — | gap (needs a 409 during a 3D edit; phase04 E covers the same banner on walls) |
| 69 | Back/refresh | Reload keeps `/3d`, re-reads N15, writes nothing | `hooks/useProjectSpatial.ts:114-123` | E "SCR-23 breadcrumb + status bar" | covered |
| 70 | Back | Browser Back from a sibling screen returns to `/3d` | `V3/Viewer3D.container.tsx:261-270` | M SCR-23 sibling navigation | covered |

## SCR-24 Exploded View (`/projects/:p/3d/exploded`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 71 | State | empty (< 2 storeys): "Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.", no controls; ≥ 2 storeys without a model: "Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường." (BUG-382) | `EX/ExplodedView.tsx:42-48,73-89`, `EX/useExplodedView.ts:143-146,849-860` | E "SCR-24 one floor", M SCR-24 (asserted absent, two seeded storeys) | covered |
| 72 | State | loading "Đang tách các tầng..." | `EX/ExplodedView.tsx:52-60,88` | — | gap (transient; P3) |
| 73 | State | error "Không tách được các tầng lúc này. Vui lòng thử lại sau." | `EX/ExplodedView.tsx:62-70,89`, `EX/useExplodedView.ts:835-836` | M SCR-24 (asserted absent) | gap (needs a build failure; not producible) |
| 74 | State | forbidden sr-only "…không sửa được vị trí tầng." | `EX/ExplodedView.tsx:129-131` | — | gap (role matrix) |
| 75 | Segmented | "Mức tách sẵn": Gộp / Tách vừa / Tách hết | `EX/ExplodedViewRail.tsx:81-85`, `EX/explodedViewTypes.ts:132-140` | M SCR-24 (Tách hết), E "SCR-24 presets" (Gộp, Tách vừa) | covered |
| 76 | Slider | "Độ tách các tầng" — collapsed variant only; the normal layout uses the shell "Độ tách" (#19, FIX-1724) | `EX/ExplodedViewRail.tsx:98-113,127-137` | E "SCR-24 presets" (asserted absent in the normal layout) | gap (collapsed layout; P3) |
| 77 | Live | aria-live "Đã tách {x %}" | `EX/ExplodedView.tsx:133-135`, `EX/useExplodedView.ts:143,411` | E "SCR-24 presets" | covered |
| 78 | Cards | Floor cards only when separation > 20 % | `EX/ExplodedViewFloorCards.tsx:75-77`, `EX/useExplodedView.ts:399`, `EX/explodedViewTypes.ts:170` | E "SCR-24 presets" | covered |
| 79 | Button | Card "Chọn {inline name}, cao độ …, diện tích …" ("Tầng 1" → "Chọn tầng 1, cao độ …"; storeyInlineName) → storey activated (+ frame); top card must take the click | `EX/ExplodedViewFloorCards.tsx:95-96,130-135`, `EX/useExplodedView.ts:377-384` | E "SCR-24 floor card" (lower card), E "SCR-24 … receive a mouse click" (top card) | covered — top card failed in run-25 (minimap intercepts); app fix FIX-1721, re-run pending |
| 80 | Toggle | "Ẩn {inline name}" / "Hiện {inline name}" ("Tầng 1" → "Ẩn tầng 1" / "Hiện tầng 1") | `EX/ExplodedViewFloorCards.tsx:173` | M SCR-24 | covered |
| 81 | Badge | "Cần chú ý" + attention caption in the card name | `EX/ExplodedViewFloorCards.tsx:121-125,148-152` | — | gap (needs an attention caption from the alignment model; P3) |
| 82 | Keyboard | Space: separate fully, then back after one ambient beat | `EX/useExplodedView.ts:131,798-825`, `EX/explodedViewTypes.ts:194` | E "SCR-24 presets" | covered |
| 83 | Button | "Chụp ảnh khung nhìn" (disabled while capturing), error "Chưa chụp được khung nhìn…" | `EX/ExplodedView.tsx:116-128`, `EX/useExplodedView.ts:152-153,740-774` | E "SCR-24 … receive a mouse click" | covered — failed in run-25 (ViewCube "Trục đo" intercepts the click); app fix FIX-1721, re-run pending; error branch: gap |
| 84 | Hover | Card hover dims the other floors | `EX/ExplodedViewFloorCards.tsx:91-116` | — | gap (P3, visual) |

## SCR-25 Measurement Tool (`/projects/:p/3d/measure`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 85 | Network | `GET /api/projects/:p/measurements` on open | `MT/measurementToolGateway.ts`, `MT/useMeasurementTool.ts` rowsQuery | M SCR-25 pin, E every SCR-25 test | covered |
| 86 | State | empty: "Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình." (overlay + list) | `MT/MeasurementTool.tsx:82,131-137,150`, `MT/MeasurementList.tsx:61,229-231`, `MT/useMeasurementTool.ts:949-950` | E "SCR-25 no measurement" | covered |
| 87 | Segmented | "Chọn chế độ đo": Điểm đến điểm / Vuông góc với bề mặt / Chiều cao / Diện tích mặt sàn | `MT/MeasurementTool.tsx:76-79,161-167`, `MT/measurementToolTypes.ts:45-50` | M SCR-25 pin (Điểm đến điểm), E "SCR-25 four modes" | covered |
| 88 | Button | "Bật tắt công cụ đo (phím M)" toggles the rail tool (orbit ↔ đo) | `MT/MeasurementTool.tsx:188-193`, `MT/useMeasurementTool.ts:185-186,781-784` | E "SCR-25 four modes" | covered |
| 89 | Keyboard | M (shell) activates "Đo (M)" | `VS/viewerShellShortcuts.ts:65,76` | M SCR-25 pin | covered |
| 90 | Canvas | Two picks → draft; "Ghim phép đo (phím Enter)" (disabled until pinnable) → `POST measurements` | `MT/MeasurementTool.tsx:171-179`, `MT/useMeasurementTool.ts` onPin | M SCR-25 pin | covered |
| 91 | Keyboard | Enter pins (scope canvas, enabled only when canPin) | `MT/useMeasurementTool.ts:165,911-913` | — | gap (P2: needs a canvas draft) |
| 92 | Button/Key | "Bỏ phần đo dở (phím Esc)" / Esc drops the draft, tool stays on | `MT/MeasurementTool.tsx:181-186`, `MT/useMeasurementTool.ts:168,776-779,895-909` | M SCR-25 manage | covered |
| 93 | State | partial hint "Chuỗi đo chưa đóng…" (floorArea with < 3 picks closed) | `MT/MeasurementTool.tsx:85,214-218`, `MT/useMeasurementTool.ts:944-947` | — | gap (P2: floorArea picks on the canvas) |
| 94 | Chip | Snap chip ("Chưa bắt vào đâu" …) | `MT/MeasurementSnapChip.tsx`, `MT/measurementToolGateway.ts:125` | — | gap (P3) |
| 95 | Error | "Chưa bắt được bề mặt để đo vuông góc…" (perpendicular without a normal) | `MT/useMeasurementTool.ts:190-191,317-319` | — | gap (P3) |
| 96 | Error | List load 5xx → "Chưa tải được danh sách phép đo của dự án…" + "Thử lại" refetch | `MT/useMeasurementTool.ts:194-195,310-323,886-890,936-937`, `MT/MeasurementTool.tsx:226-233` | E "SCR-25 [mocked response] GET measurements 500" | covered |
| 97 | Error | Scene failed "Chưa dựng được mô hình để đo. Bấm thử lại để dựng lại." | `MT/useMeasurementTool.ts:198,300-306` | — | gap (no scene failure on the real stack) |
| 98 | List | Rows: name, value label, "Ẩn/Hiện {name}", "Xoá {name}" | `MT/MeasurementList.tsx:93-164` | M SCR-25 manage | covered |
| 99 | Select | "Đơn vị" mm / cm / m relabels values (screen opens in m) | `MT/MeasurementList.tsx:62,216-223`, `MT/measurementToolTypes.ts:206-210`, `MT/useMeasurementTool.ts:860-863` | M SCR-25 manage (mm, m), E "SCR-25 seeded record" (cm) | covered |
| 100 | Toggle | "Ẩn {name}" is local only: reload shows the row again, no write | `MT/useMeasurementTool.ts:848-858` | E "SCR-25 Ẩn {name} is local" | covered |
| 101 | Button | "Thu gọn mục Phép đo" collapses the list; the list's own "Mở mục Phép đo, {n} phép đo" is out of reach because the shell inspector collapses with it | `MT/MeasurementList.tsx:63,180-196,206-211`, `MT/useMeasurementTool.ts:939-940,995-997`, `VS/ViewerShell.tsx:112,208-218` | E "SCR-25 seeded record" | covered |
| 102 | Button | Collapsed overlay chip "{n} phép đo — mở lại danh sách phép đo" re-opens the list | `MT/MeasurementTool.tsx:198-211`, `MT/measurementToolGateway.ts:322,434` | E "SCR-25 seeded record" | covered |
| 103 | Delete | "Xoá {name}" → `DELETE …/measurements/:id` 204 + toast "Hoàn tác" → re-POST | `MT/MeasurementList.tsx:154`, `MT/useMeasurementTool.ts:819-846` | M SCR-25 manage | covered |
| 104 | Keyboard | Delete key removes the hovered (highlighted) row | `MT/useMeasurementTool.ts:170,915-925`, `MT/MeasurementList.tsx:110-115` | E "SCR-25 Delete key" | covered |
| 105 | Edge | After the 8 s undo window the delete sticks (reload, no re-POST) | `lib/mutations/undoTicket.ts` window, G5 | E "SCR-25 Delete key" | covered |
| 106 | Error | Delete of a record deleted elsewhere → 404 → toast "Phép đo này đã bị xoá ở nơi khác", list re-read | `MT/useMeasurementTool.ts:216,826-844` | E "SCR-25 deleted elsewhere" | covered |
| 107 | Error | Delete 403 "Bạn không có quyền xoá…" / other "Chưa xoá được phép đo, hãy thử lại" / undo failed | `MT/useMeasurementTool.ts:215-218,832-836` | — | gap (403 needs a role change mid-session; BE 403 in API spec) |
| 108 | Error | Pin errors by code: MEASUREMENT_LIMIT_REACHED / MEASUREMENT_ID_TAKEN / FORBIDDEN / generic | `MT/useMeasurementTool.ts:208-214,806-810` | — | gap (P2: BE codes proven in the API spec; UI needs a canvas draft) |
| 109 | Edge | Double click "Ghim" → one POST (`pinInFlightRef`) | `MT/useMeasurementTool.ts:812-814` | — | gap (P2: needs a canvas draft) |
| 110 | State | Viewer role: pin blocked caption "Bạn chỉ có quyền xem dự án này…", no "Xoá" | `MT/useMeasurementTool.ts:201-202,788,993`, `MT/MeasurementList.tsx:152` | R9 SCR-25 [V] gap | covered |
| 111 | Badge | Stale row "Cần chú ý" | `MT/MeasurementList.tsx:120-128`, `MT/measurementToolGateway.ts:113,494-495` | — | n/a-by-design (stale is always false: records carry no entity id) |

## SCR-26 Pascal Viewer (`/projects/:p/3d/pascal`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 112 | Network | `GET /api/feature-flags`, `pascal-mount.js?v=<8hex>` no-cache | `PV/usePascalViewer.ts:42-49,136-185,216` | M SCR-26 load | covered |
| 113 | State | success/partial caption + canvas "Khung dựng mô hình 3D" | `PV/PascalViewer.tsx:146-163`, `PV/pascalViewerTypes.ts:93-94` | M SCR-26 load | covered |
| 114 | State | summary Tầng / Tường / Ô mở / Phòng from the graph | `PV/PascalViewer.tsx:165-184`, `PV/usePascalViewer.ts:422-430` | E "SCR-26 summary" | covered |
| 115 | State | partial list "Chưa chuyển sang được" (+ "Phần mô hình" dropped nodes) | `PV/PascalViewer.tsx:186-200`, `PV/usePascalViewer.ts:392-405` | — | gap (needs an entity the adapter skips; P3) |
| 116 | State | empty "Chưa có gì để dựng" + caption | `PV/PascalViewer.tsx:61-71`, `PV/pascalViewerTypes.ts:92`, `PV/usePascalViewer.ts:248-253` | E "SCR-26 floor without geometry" | covered |
| 117 | State | forbidden (flag off) "Chưa bật cho tài khoản này", no mount script | `PV/PascalViewer.tsx:49-59`, `PV/pascalViewerTypes.ts:96`, `PV/usePascalViewer.ts:267,290,407` | E "SCR-26 [mocked response] flag … off" | covered |
| 118 | State | error PASCAL-01 "Không nạp được khung dựng hình" + "Thử lại" | `PV/PascalViewer.tsx:101-116`, `PV/usePascalViewer.ts:165-176,327-329` | E "SCR-26 [mocked response] pascal-mount.js network loss" | covered |
| 119 | State | error PASCAL-02 (mount fatal) / PASCAL-03 "Máy này chưa dựng được mô hình 3D" (no retry) | `PV/PascalViewer.tsx:85-99`, `PV/usePascalViewer.ts:315-324` | — | gap (no WebGL-less browser / fatal mount on the real stack) |
| 120 | State | loading skeleton "Đang nạp khung dựng hình…" | `PV/PascalViewer.tsx:146,158-162`, `PV/pascalViewerTypes.ts:91` | — | gap (transient; P3) |
| 121 | Keyboard | Esc collapses, E re-opens, R retries only while failing | `PV/usePascalViewer.ts:360-389` | M SCR-26 load (Esc, E, R inert), E "SCR-26 [mocked response] … network loss" (R retries) | covered |
| 122 | Button | "Mở khung xem" in the collapsed state | `PV/PascalViewer.tsx:118-128`, `PV/usePascalViewer.ts:337-340` | E "SCR-26 summary" | covered |
| 123 | Button | "Thử lại" (click) on the error state | `PV/PascalViewer.tsx:112`, `PV/usePascalViewer.ts:332-335` | — | gap (R key path covered; click path P3) |

## SCR-27 Mobile Viewer (`/m/du-an/:p`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 124 | Region | "Xem mô hình 3D trên điện thoại", h1 project name; model area `<main>` fills the space between top bar and bottom bar | `MV/MobileViewer.tsx:206-236` | M SCR-27 tools, E "SCR-27 floor without geometry" (area height) | covered — area FAILS (0 px tall at 375×812) |
| 125 | Button | "Chia sẻ dự án" absent (onShare null) | `MV/MobileViewer.tsx:225-232` | M SCR-27 tools | covered |
| 126 | Nav | "Công cụ xem mô hình": Tầng / Chế độ xem / Đo / Thông tin (aria-pressed) | `MV/MobileViewerBottomBar.tsx:43-48,194-212` | M SCR-27 tools | covered |
| 127 | Toggle | Second tap on the active tool closes its panel | `MV/MobileViewerBottomBar.tsx:205-207` | E "SCR-27 walls without room" | covered |
| 128 | Keyboard | Esc closes the open sheet / tool | `MV/MobileViewer.tsx:187-203` | E "SCR-27 walls without room" | covered |
| 129 | Panel | "Tầng" panel rows (aria-pressed) + "Chưa có phòng" badge; "Chưa có tầng nào để hiện." | `MV/MobileViewerBottomBar.tsx:84-99,130-156` | M SCR-27 tools (opens), E "SCR-27 walls without room" (badge) | covered (no-floor sentence: n/a, a project always has a floor) |
| 130 | Panel | "Đo" panel: empty "Chưa có phép đo nào. Chạm hai điểm trên mô hình để đo." / rows | `MV/MobileViewerBottomBar.tsx:172-190`, `MV/useMobileViewer.ts:409` | M SCR-27 tools (opens), E "SCR-27 walls without room" (empty text) | covered (rows: gap, need touch picks) |
| 131 | Layout | < 360 px compact: three tools; "Chế độ xem" row inside "Tầng" keeps the floor sheet open (view folded into floors) | `MV/MobileViewerBottomBar.tsx:125-127,158-167`, `MV/useMobileViewer.ts:220,343,648-653` | E "SCR-27 320 px compact" | covered |
| 132 | Dialog | Info sheet "Thông tin đối tượng đang chọn": empty text, "Mở rộng/Thu gọn tấm thông tin", "Đóng tấm thông tin" | `MV/MobileViewerInfoSheet.tsx:146-150,202-251` | M SCR-27 tools (opens), E "SCR-27 320 px compact" | covered — FAILS at 320×640 (sheet header above the viewport) |
| 133 | Dialog | Selection rows + "Sửa trên máy tính…" + "Gửi liên kết sang máy tính" | `MV/MobileViewerInfoSheet.tsx:252-282` | — | gap (needs a touch pick on the canvas; P2) |
| 134 | Gesture | Sheet drag between snaps | `MV/MobileViewerInfoSheet.tsx:210-216` | — | gap (P3) |
| 135 | State | empty "Chưa có mô hình để xem" | `MV/MobileViewer.tsx:105-114`, `MV/useMobileViewer.ts:698-699` | E "SCR-27 floor without geometry" | covered — FAILS (rendered inside a 0 px model area, not on screen) |
| 136 | State | partial "Mô hình mới có một phần: một số tầng chưa có phòng nào…" | `MV/MobileViewer.tsx:138-145`, `MV/useMobileViewer.ts:675-681,701-702` | E "SCR-27 walls without room" | covered |
| 137 | State | partial weak network "Mạng đang yếu. Mô hình đã tải xong vẫn xem được." | `MV/MobileViewer.tsx:141-142` | — | gap (needs `navigator.connection` emulation; P3) |
| 138 | State | forbidden "Bạn chưa có quyền xem mô hình này" | `MV/MobileViewer.tsx:117-126`, `MV/useMobileViewer.ts:685-686` | — | gap (role matrix) |
| 139 | State | error (weak device layer) / loading "Đang tải mô hình" | `MV/MobileViewer.tsx:100-102,128-134` | — | gap (no WebGL-less device; transient loading) |
| 140 | State | 404 project via the gate | `MV/MobileViewer.container.tsx:147`, `PSG:73-75` | E "SCR-27 unknown project id" | covered |

## Mocked tests and API pairs

| UI test | Mocked response | Pair |
|---|---|---|
| E "SCR-23 [mocked response] GET …/spatial 500" | `GET /api/projects/:p/spatial` → 500 | unpairable: 5xx is not producible on the shared stack (row owed in `coverage/phase05-be.md`) |
| E "SCR-25 [mocked response] GET measurements 500" | `GET /api/projects/:p/measurements` → 500 | unpairable: 5xx is not producible on the shared stack |
| E "SCR-26 [mocked response] pascal-mount.js network loss" | `/assets/pascal/pascal-mount.js` aborted | unpairable: network loss of a static asset, no API involved |
| E "SCR-26 [mocked response] flag … off" | `GET /api/feature-flags` with `scene.pascal-viewer: false` (real response, one key overridden) | unpairable: stack-wide env flag (CP-0); turning it off breaks every Pascal test on the shared stack |

Mock share (edge layer): 4 / 33 = 12,1 % (limit `rules.maxMockedShare` 35 %).

## Summary

- FE rows: 140. covered 94 (6 of them FAILED in run-25: #54, #79, #83, #124, #132, #135 — listed below), gap 43, UNKNOWN 1 (#9), n/a-by-design 2 (#6, #111) — counts by the Status column.
- Edge tests authored: 33 (`tests/phase05_3d_viewer_edge.spec.ts`), 29 real + 4 mocked. Author run `run-25-author`
  (`phase05-edge`): 29 passed, 4 failed — all four are suspected APP failures, left failing:
  - #54 SCR-23 wall editor: after "abc" + Enter the message says the coordinate went back to the old number, but the field
    still shows "abc" (`WallGeometryVertexTable.tsx:41` shows `draftValue` while the cell is `invalid`). No PUT is sent.
  - #79/#83 SCR-24: "Chụp ảnh khung nhìn" (`ExplodedView.tsx:116`, `right-3 top-3`) sits under the shell ViewCube ("Trục đo"
    intercepts), and the top floor card sits under the minimap viewport rectangle (`components/canvas/MiniMap.tsx:118`) —
    neither takes a mouse click (`E05_exploded_top_right_click.json`). QA-05 FIX-1721 moved both (`explodedViewTypes.ts:165`
    `captureRightPx` 88, `:171` `cardsRightPx` 176); re-run pending.
  - #124/#135 SCR-27 at 375×812: the model area `<main>` (`MobileViewer.tsx:236`, `min-h-0 flex-1`) is 0 px tall — the route
    is mounted outside `ScreenMain` with no viewport height (compare the `h-screen` fix of `PascalViewerRoute`, B-V10-02), so
    the bottom bar sits right under the top bar and every state layer is clipped. The partial/empty tests that "passed"
    show the same blank area in their evidence.
  - #132 SCR-27 at 320×640: same cause — the info sheet (`absolute bottom-0`, 45 %) opens with its header above the viewport,
    "Mở rộng tấm thông tin" cannot be clicked.
  Observation (not asserted): in the SCR-25 collapsed state the 3D viewport shrinks to about 320 px tall with an empty band
  below it (`E05_measure_collapsed.png`) — UI-verify should check it.
- Priority gaps (next edge round): PropertyInspector edits on /3d (#50), rooms panel ready/partial controls (#64), wall editor
  tools and refusals (#57), Enter-to-pin / double pin / pin error codes (#91, #108, #109), measurement partial chain (#93),
  mobile selection sheet (#133), role-matrix forbidden states for /3d, exploded and mobile (#29, #38, #74, #138).
