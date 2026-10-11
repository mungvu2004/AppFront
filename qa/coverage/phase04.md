<!-- qa-sources fe=60778e96 -->
# Phase 04 — QC layers: FE coverage inventory

Screens SCR-16 walls, SCR-17 objects, SCR-18 dimension OCR, SCR-19 axes, SCR-20 rooms, SCR-21 thickness, SCR-14 scale,
SCR-22 overlay. Source `F:/App/AppFront` @ 60778e96 (rows 1-172 inventoried @ 8f03047b; the 8f03047b..60778e96 diff touches
no phase-04 screen file, only the shared pieces listed under "Change impact" below). Backend rules (#35 write, W20 409, W4 ids, integrity, A5) live in
`coverage/phase04-be.md` (API spec), not here.

Test keys:
- **M** `tests/phase04_qc_layers.spec.ts` (serial per screen; SCR-16/17/19/20/21 on its own API-seeded floor, `support/layerSeed.ts`; SCR-18/14/22 + CP-6 on the CP-5 work floor, skipped with an `Environment:` reason without it — BUG-346) — title quoted by its prefix.
- **E** `tests/phase04_qc_layers_edge.spec.ts` (non-serial, own project per test) — `E04 · …` titles.
- **R9** `tests/phase09_roles_matrix.spec.ts` (Track B mock, viewer/engineer).
- **UI** `tests/phase04_qc_layers_ui.spec.ts` (`U04 · …`, 4 viewports 1440/1024/768/375 with layout measurements; walls/objects/axes/rooms/thickness on an own seeded floor per test, dimensions/scale/overlay on the CP-5 work floor — BUG-323).

Path short names: `W/` = `src/screens/qc/WallLayerReview/`, `O/` = `…/ObjectLayerReview/`, `D/` = `…/DimensionOcrReview/`,
`A/` = `…/AxisGridManager/`, `R/` = `…/RoomLabelReview/`, `T/` = `…/ThicknessStandardization/`,
`S/` = `src/screens/pipeline/ScaleCalibration/`, `V/` = `src/screens/viewer/OverlayComparison/`.

## Shared — floor-layer save path (all four QC editors + scale)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 1 | Network | `GET /api/projects/:p/floors/:f/spatial/layer` on open | `hooks/useFloorLayer.ts:65-143`, `api/endpoints.ts` spatial.layer | M (every screen), E (every seeded test) | covered |
| 2 | Network | Autosave `PUT …/spatial/layer` 800 ms after last change, `{baseVersion, body}` | `hooks/useAutosave.ts:503-631`, `lib/autosave/spatialLayerSave.ts` | M SCR-16 approve / thickness | covered |
| 3 | Keyboard | Ctrl+S flushes pending PUT | `routes/router.tsx` global.save | M SCR-16 undo + flush | covered |
| 4 | Keyboard | Ctrl+S with nothing dirty → no PUT | same | E "SCR-16 Chỉ hiện độ dày không chuẩn … Ctrl+S" | covered |
| 5 | Feedback | No "Lưu" button (A7) | `W/WallLayerReview.tsx` (no save control) | M SCR-16 approve | covered |
| 6 | Feedback | Status bar save label "Đã lưu lúc HH:MM" | `W/WallLayerStatusBar.tsx:95-110`, `hooks/useSaveIndicator.ts` | M SCR-18 local only | covered |
| 7 | Error | 409 / 422 baseVersion → reload banner "Tầng này vừa được sửa ở nơi khác…" + "Tải lại" | `lib/autosave/spatialLayerSave.ts:83,93-94`, `W/FloorLayerSaveBanner.tsx:30-38` | E "SCR-16 409 after a write elsewhere" | covered |
| 8 | Modal | A9 "Bỏ thay đổi chưa lưu của tầng này?" — "Huỷ" / "Tải lại và bỏ thay đổi" | `W/FloorLayerSaveConfirm.tsx:56-66`, `hooks/useAutosave.ts:609-627` | E "SCR-16 409 …" | covered |
| 9 | Error | Blocked banner (403 "Bạn không còn quyền sửa tầng này.", integrity count, unnamed room, unknown) | `lib/autosave/spatialLayerSave.ts:80-86,108-130`, `W/FloorLayerSaveBanner.tsx:26-27` | — (needs a role change mid-session or an invalid body the FE refuses to send) | gap (API spec proves the 403/422 codes) |
| 10 | Error | Reload itself fails → "Không tải lại được tầng này. Thử lại sau." | `hooks/useAutosave.ts:275,586-588` | — | gap (needs a 5xx on the re-read; mock only) |
| 11 | Feedback | "Lưu thất bại" label after a failed save | `hooks/useAutosave.ts:175` | E "SCR-16 409 …" (shown in `E04_walls_conflict_banner.png`, not asserted) | UNKNOWN (copy seen on screen; "Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới." source line not pinned) |
| 12 | Banner | Provisional scale banner (`scaleStatus: 'unresolved'`) | `screens/qc/shared/ProvisionalScaleBanner.tsx`, `W/WallLayerReview.tsx:125-128` | — | gap (needs a pipeline-inferred scale; not producible by the #35 API seed) |
| 13 | Tour | EditorTour on walls, "Bỏ qua hướng dẫn" | `W/WallLayerReview.container.tsx:262`, `e2e/fixtures/tour.ts:25` | M (every walls open), E (openWalls) | covered |

## SCR-16 Wall Layer Review (`/projects/:p/floors/:f/layers/walls`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 14 | List | listbox "Danh sách đoạn tường", option `#code — status`, virtualised | `W/WallLayerList.tsx:58,131,157,271-274` | M SCR-16 select | covered |
| 15 | List | Ctrl/⌘-click adds to selection | `W/WallLayerList.tsx:148` | M SCR-16 merge, E "SCR-16 nối đoạn …" | covered |
| 16 | Keyboard | J / K next / previous | `W/useWallLayerReview.ts:1232-1251` | M SCR-16 select | covered |
| 17 | Keyboard | J at the last row / K at the first row | `W/useWallLayerReview.ts:1221-1229` (neighbourWallId) | — | gap (P3) |
| 18 | Keyboard | Backspace deletes + toast "Đã xoá tường {code}." + "Hoàn tác" | `W/useWallLayerReview.ts:1252-1264`, `W/wallLayerReviewGateway.ts:719` | M SCR-16 delete + undo | covered |
| 19 | Keyboard | Mod+Z undo | `W/useWallLayerReview.ts:1266-1274` | M SCR-16 undo + flush | covered |
| 20 | Keyboard | Esc deselects → inspector prompt | `W/useWallLayerReview.ts:1287-1304`, `W/WallLayerInspector.tsx:51,106` | E "SCR-16 keyboard: digit 2 …" | covered |
| 21 | Keyboard | Digits 1/2/3 set 110/220/330 mm | `W/useWallLayerReview.ts:1315-1345`, `W/types.ts:168` | E "SCR-16 keyboard: digit 2 …" (2 only) | covered |
| 22 | Keyboard | V / W / M tools, F fit | `W/useWallLayerReview.ts:1346-1376,1615-1622`, `W/WallLayerToolRail.tsx:69-72` | — | gap (P3: drawing-tool gestures not in plan) |
| 23 | Inspector | heading "Đoạn tường", code, fields (chiều dài, Chiều cao, Độ tin cậy, vật liệu) | `W/WallLayerInspector.tsx:39-47,129-147` | M SCR-16 select | covered |
| 24 | Inspector | "Thông số nâng cao" expander (aria-expanded) | `W/WallLayerInspector.tsx:40,152-157` | E "SCR-16 keyboard …" | covered |
| 25 | Inspector | radiogroup "Độ dày tường" | `W/WallLayerInspector.tsx:48,116` | M SCR-16 thickness | covered |
| 26 | Inspector | "Duyệt đoạn này" → PUT, auto-advance | `W/WallLayerInspector.tsx:49,196-205`, `W/useWallLayerReview.ts:855-873` | M SCR-16 approve | covered |
| 27 | Edge | Double click "Duyệt đoạn này" → one PUT, then disabled | `W/WallLayerInspector.tsx:200`, `W/useWallLayerReview.ts:859` | E "SCR-16 double click …" | covered |
| 28 | Edge | Refresh after approve keeps "Đã duyệt" (server truth) | N16 re-read | E "SCR-16 double click … reload" | covered |
| 29 | Inspector | "Bỏ qua" next wall, no PUT | `W/WallLayerInspector.tsx:50,207`, `W/useWallLayerReview.ts:875` | M SCR-16 view controls | covered |
| 30 | Inspector | empty prompt "Chọn một đoạn tường…" | `W/WallLayerInspector.tsx:51,106` | E "SCR-16 floor with no wall", E keyboard | covered |
| 31 | Filter | "Chỉ hiện chưa duyệt", "Chỉ hiện độ tin cậy thấp" | `W/WallLayerLeftPanel.tsx:77-78`, `W/useWallLayerReview.ts:450-461` | M SCR-16 view controls | covered |
| 32 | Filter | "Chỉ hiện độ dày không chuẩn" | `W/WallLayerLeftPanel.tsx:79`, `W/wallLayerReviewGateway.ts:1216` | E "SCR-16 Chỉ hiện độ dày không chuẩn …" | covered |
| 33 | Filter | No-match line "Không có đoạn tường nào khớp bộ lọc…" | `W/WallLayerList.tsx:60-61,264` | E "SCR-16 every wall approved …" | covered |
| 34 | Toggle | "Hiện tim tường", "Ẩn/Hiện lớp tường" | `W/WallLayerLeftPanel.tsx:90-92,170-180` | M SCR-16 view controls | covered |
| 35 | Layout | "Thu gọn hai panel" / "Mở lại hai panel" | `W/WallLayerToolRail.tsx:78-79,169-173` | M SCR-16 view controls | covered |
| 36 | Rail | "nối đoạn — Chọn hai đoạn tường để gộp" disabled with < 2 selected | `W/WallLayerToolRail.tsx:75-76,106-111` | M SCR-16 merge, E "SCR-16 nối đoạn …" | covered |
| 37 | Rail | "nối đoạn" merge of a collinear pair → PUT | `W/useWallLayerReview.ts:913-919` | M SCR-16 merge (data-dependent skip) | covered |
| 38 | Edge | "nối đoạn" on a 90° pair → enabled, no merge, no PUT (silent) | `W/useWallLayerReview.ts:842-844,1384,1410` | E "SCR-16 nối đoạn on two perpendicular walls" | covered |
| 39 | Rail | "chọn (phím V)", "vẽ tường (phím W)", "Tách đoạn", "đo (phím M)" tools | `W/WallLayerToolRail.tsx:69-72,142-148` | — | gap (P3) |
| 40 | Canvas | context menu Duyệt / Đổi độ dày / Tách đoạn / Xoá | `W/WallLayerCanvas.tsx:66-69` | — | gap (P2) |
| 41 | Canvas | minimap "Mặt bằng thu nhỏ", zoom ± / 100 % / fit | `W/WallLayerCanvas.tsx:73` | — | gap (P3, visual — UI layer) |
| 42 | Navigation | "Cây lớp" → objects / dimensions / grids / rooms | `W/WallLayerLeftPanel.tsx:137-148,247-252`, `W/WallLayerReview.container.tsx` LAYER_ROUTE | M SCR-16 layer nav | covered |
| 43 | Navigation | "Tầng của bản vẽ" floor nav | `W/WallLayerLeftPanel.tsx:212-225` | M SCR-16 layer nav | covered |
| 44 | Navigation | success state "Sang lớp cửa và nội thất" → objects | `W/WallLayerLeftPanel.tsx:95,305-307`, `W/useWallLayerReview.ts:540` | E "SCR-16 every wall approved …" | covered |
| 45 | State | empty "Chưa có đoạn tường nào" + notice | `W/WallLayerList.tsx:59,247-250`, `W/useWallLayerReview.ts:205` | E "SCR-16 floor with no wall" | covered |
| 46 | State | loading (12 skeleton rows) | `W/WallLayerList.tsx:239-241` | — | gap (P3, transient; UI layer) |
| 47 | State | error 404 floor "Tầng này không còn tồn tại." | `hooks/useFloorLayer.ts:31,65-66`, `W/WallLayerLeftPanel.tsx:351-353` | E "SCR-16 unknown floor id" | covered |
| 48 | State | error unknown project (errors.notFound) — no ProjectSpatialGate on QC routes | `hooks/useFloorLayer.ts:65-66`, `i18n/vi.json` errors.notFound | E "SCR-16 unknown project id" | covered |
| 49 | State | error 5xx (errors.unknown "…Hãy thử lại sau ít phút.", copy changed in e5f7f279), screen not blank | `lib/errors/toAppError.ts:10-18,211`, `i18n/vi.json:63` | E "SCR-16 [mocked response] … 500" | covered (unpairable) |
| 50 | State | forbidden (viewer): notice, no approve, rail read-only | `W/useWallLayerReview.ts:207,520-521,572-573`, `W/WallLayerCanvas.tsx:75` | R9 SCR-16 [V] | covered |
| 51 | State | missing route params "Thiếu mã dự án hoặc mã tầng" | `W/WallLayerReview.container.tsx:91-93,281-291` | — | n/a-by-design (router always supplies both params) |
| 52 | Status bar | "Thanh trạng thái": cursor / scale / save label | `W/WallLayerStatusBar.tsx:95-110`, `W/wallLayerReviewGateway.ts:855` | — | gap (P3) |
| 53 | Layout | compact / responsive (canvas `min-w-[640px]`) | `W/WallLayerReview.tsx:150` | UI | gap (UI layer) |

## SCR-17 Object Layer Review (`…/layers/objects`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 54 | Filter | "Lọc theo loại" chips (aria-pressed) | `O/ObjectLayerLeftPanel.tsx:60,235` | M SCR-17 filter | covered |
| 55 | Toggle | "Ẩn lớp …" / "Hiện lớp …" per layer | `O/ObjectLayerLeftPanel.tsx:61-62` | — | gap (P3) |
| 56 | List | group "Danh sách đối tượng", "Mở nhóm …" / "Gấp nhóm …" | `O/ObjectLayerList.tsx:47,55-56` | M SCR-17 filter | covered |
| 57 | List | option select → inspector "Đối tượng" | `O/ObjectLayerList.tsx:94`, `O/ObjectLayerInspector.tsx:171` | M SCR-17 filter, E "SCR-17 double click …" | covered |
| 58 | List | orphan badge "Chưa gắn vào tường nào" + "Gắn vào tường gần nhất" | `O/ObjectLayerList.tsx:48-49`, `O/ObjectLayerInspector.tsx:180,183` | — | gap (orphan opening is a critical integrity issue on #35 — BE:integrity.py:55 — so not seedable; furniture "Đứng tự do" only) |
| 59 | Inspector | "Duyệt đối tượng này" → PUT | `O/ObjectLayerInspector.tsx:184`, `O/useObjectLayerReview.ts:755-773` | M SCR-17 edit | covered |
| 60 | Edge | Double click approve → one PUT, disabled | `O/useObjectLayerReview.ts:759` | E "SCR-17 double click …" | covered |
| 61 | Inspector | "hướng mở" radios mở trái / mở phải / hai cánh / Trượt | `O/ObjectLayerInspector.tsx:160-163,178` | M SCR-17 edit | covered |
| 62 | Inspector | combobox "Loại đối tượng" | `O/ObjectLayerInspector.tsx:172` | M SCR-17 edit | covered |
| 63 | Inspector | position slider "Vị trí trên tường", host wall link "Tường chứa nó" | `O/ObjectLayerInspector.tsx:176-177`, `O/useObjectLayerReview.ts:777-800` | — | gap (P2) |
| 64 | Inspector | empty prompt "Chọn một đối tượng…" | `O/ObjectLayerInspector.tsx:185` | E "SCR-17 double click … Esc" | covered |
| 65 | Keyboard | Esc closes inspector | `O/useObjectLayerReview.ts:1165-1173` | E "SCR-17 double click … Esc" | covered |
| 66 | Keyboard | Mod+Z undo → PUT | `O/useObjectLayerReview.ts:1147-1155` | E "SCR-17 double click … Mod+Z" | covered |
| 67 | Keyboard | D / W / F layer, 1 / 2 / 3 subtype | `O/useObjectLayerReview.ts:1087-1145`, `O/ObjectLayerToolRail.tsx:133,163` | — | gap (P2) |
| 68 | Canvas | right-click `g[aria-label=code]` → "Xoá", status bar "Hoàn tác" | `O/ObjectLayerStatusBar.tsx:34`, `O/objectLayerReviewGateway.ts:1183` | M SCR-17 delete + undo | covered |
| 69 | Status bar | "Thu gọn hai panel" / "Mở lại hai panel" | `O/ObjectLayerStatusBar.tsx:35-36` | — | gap (P3) |
| 70 | Filter | partial "Chỉ hiện mục dưới ngưỡng" (low-confidence preset) | `O/ObjectLayerReview.tsx:69,100-123`, `O/objectLayerReviewGateway.ts:1240` | — | gap (needs a pipeline partial result) |
| 71 | State | empty "Chưa nhận ra đối tượng nào" + explanation + "Thêm thủ công" | `O/ObjectLayerReview.tsx:67-68,83-90`, `O/useObjectLayerReview.ts:1294` | M SCR-17 filter (skip branch), E "SCR-17 no wall, no object" | covered |
| 72 | Action | "Thêm thủ công" with no wall → toast "Tầng này chưa có đoạn tường nào…" | `O/useObjectLayerReview.ts:946-962`, `O/objectLayerReviewGateway.ts:1261` | E "SCR-17 no wall, no object" | covered |
| 73 | Action | "Thêm thủ công" with a wall → door added (PUT) | `O/useObjectLayerReview.ts:953-980` | E "SCR-17 one wall, no object" | covered |
| 74 | Action | "Thêm thủ công" refused (domain reasons) "Không thêm được đối tượng vào tường." | `O/useObjectLayerReview.ts:968-976`, `O/objectLayerReviewGateway.ts:1262` | — | gap (P3) |
| 75 | State | loading skeleton, error "Không tải được lớp đối tượng của tầng." | `O/ObjectLayerReview.tsx:73-98`, `O/objectLayerReviewGateway.ts:1258` | — | gap (P3; same read path as #47-49) |
| 76 | State | furniture attention "Nhận diện nội thất lỗi, cửa vẫn xong" | `O/objectLayerReviewGateway.ts:1254` | — | gap (pipeline-only state) |
| 77 | State | forbidden (viewer) | `O/useObjectLayerReview.ts:216-218` | R9 SCR-17 [V] | covered |

## SCR-18 Dimension OCR Review (`…/layers/dimensions`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 78 | Filter | radiogroup "Lọc theo trạng thái duyệt": Tất cả / Độ tin cậy thấp / Chưa duyệt | `D/dimensionOcrText.ts:97-103,219` | M SCR-18 (Chưa duyệt only) | covered |
| 79 | Input | "Giá trị kích thước {code}" + Enter commits and approves | `D/dimensionOcrText.ts:120`, `D/DimensionOcrRow.tsx:212-236` | M SCR-18 local only | covered |
| 80 | Button | "Duyệt kích thước {code}" | `D/dimensionOcrText.ts:127`, `D/DimensionOcrRow.tsx:327-333` | M SCR-18 local only | covered |
| 81 | Persist | F-08 saved label but no PUT | `D/useDimensionOcrReview.ts:582` | M SCR-18 local only | covered |
| 82 | Keyboard | Enter save+next, Esc drop edit, R keyboard mode | `D/useDimensionOcrReview.ts:916-970` | — | gap (needs OCR dimensions; #35 cannot seed them — BE:writer.py:266-270) |
| 83 | Mode | "Bật/Tắt chế độ duyệt bàn phím", "Hoặc bấm R để bật" | `D/dimensionOcrText.ts:57-67`, `D/DimensionOcrKeyboardMode.tsx:111,167` | — | gap (same) |
| 84 | Bar | "Thanh so sánh với hình học", outlier sentence | `D/dimensionOcrText.ts:37,44,123` | — | gap (same) |
| 85 | State | empty "Chưa đọc được chuỗi kích thước nào" + description | `D/dimensionOcrText.ts:140-143`, `D/DimensionOcrReview.tsx:135-152` | M SCR-18 (skip branch), E "SCR-18 no dimension …" | covered |
| 86 | Navigation | empty-state link "Hiệu chỉnh tỷ lệ" → `/scale` | `D/DimensionOcrReview.tsx:148`, `D/DimensionOcrReview.container.tsx:132-135` | E "SCR-18 no dimension …" | covered |
| 87 | State | loading "Đang đọc kích thước", partial, success "Tất cả kích thước đã duyệt" | `D/dimensionOcrText.ts:150-184` | — | gap (pipeline data) |
| 88 | State | error "Không đọc được kích thước" + "Thử lại" | `D/dimensionOcrText.ts:174-176`, `D/DimensionOcrReview.tsx:155-164` | — | gap (P3; mock only) |
| 89 | State | forbidden "Không có quyền duyệt kích thước" | `D/dimensionOcrText.ts:191-193` | — | gap (R9 does not open SCR-18) |
| 90 | State | collapsed "Bảng duyệt đang thu gọn" | `D/dimensionOcrText.ts:200-201`, `D/DimensionOcrReview.tsx:251-252` | — | gap (P3) |

## SCR-19 Axis Grid Manager (`…/layers/grids`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 91 | Button | "Thêm trục ngang" | `A/useAxisGridManager.ts:155` | M SCR-19 (data-dependent) | covered |
| 92 | Button | "Thêm trục dọc" adds one listed axis | `A/useAxisGridManager.ts:156` | E "SCR-19 load-bearing rectangle …" | covered — FAILS (preview rows vanish, `A/useAxisGridManager.ts:455-462`) |
| 93 | Button | "Ẩn trục X" / "Hiện trục X", "Xoá trục X" + undo toast | `A/AxisGridLeftPanel.tsx:66,71`, `A/axisGridManagerGateway.ts:997` | M SCR-19 local only | covered |
| 94 | Toggle | "Hiện bóng ma tầng dưới" (switch) | `A/AxisGridLeftPanel.tsx:61,216` | E "SCR-19 load-bearing rectangle …" | covered |
| 95 | Preview | axes detected from ≥ 2 collinear walls (MIN_WALLS_PER_AXIS 2) | `A/useAxisGridManager.ts:447-462`, `domain/axes/detect.ts:49,243` | E "SCR-19 load-bearing rectangle …" | covered |
| 96 | State | empty "Chưa có trục nào" + notice + "Suy ra từ tường bao" | `A/AxisGridManager.tsx:96-97,140-149`, `A/useAxisGridManager.ts:159-160` | M SCR-19 (skip branch), E "SCR-19 no wall …" | covered |
| 97 | Action | "Suy ra từ tường bao" with nothing detected → no-op | `A/useAxisGridManager.ts:916-925` | E "SCR-19 no wall …" | covered |
| 98 | Panel | "Gốc toạ độ": "Chọn giao trục neo" select, offsets X/Y px/mm, session-only notice | `A/AxisGridOriginPanel.tsx:40-47`, `A/useAxisGridManager.ts:170,802` | — | gap (P2) |
| 99 | Panel | "Căn chỉnh giữa các tầng": "Căn chỉnh tự động", rows, toast + undo | `A/AxisGridFloorAlignList.tsx:50-70`, `A/axisGridManagerGateway.ts:725-728` | — | gap (P2; needs ≥ 2 floors with axes) |
| 100 | Validation | 100 mm spacing block "không thể đặt … cách nhau dưới …" | `A/AxisGridManager.tsx:209-214`, `A/axisGridManagerGateway.ts:677-686` | — | gap (P2; axis drag on canvas) |
| 101 | Keyboard | Mod+Z undo | `A/useAxisGridManager.ts:958` | — | gap (P3) |
| 102 | State | error "Không tính được trục" + "Thử lại", loading | `A/AxisGridManager.tsx:98-99,126-158` | — | gap (P3; mock only) |
| 103 | State | forbidden "Không có quyền sửa trục" | `A/AxisGridManager.tsx:100,166-173` | — | gap (R9 does not open SCR-19) |
| 104 | State | collapsed "Bảng trục đang thu gọn" | `A/AxisGridManager.tsx:101,276-281` | — | gap (P3) |
| 105 | Persist | no PUT for axes (F-08) | `A/axisGridManagerGateway.ts:155-157` | M SCR-19, E both SCR-19 tests | covered |

## SCR-20 Room Label Review (`…/layers/rooms`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 106 | List | listbox "Danh sách phòng", option `code · name · area · status`, ArrowUp/Down | `R/RoomLabelList.tsx:35,70,75-140` | M SCR-20 edit, E normalize | covered |
| 107 | Input | "Tên phòng" + Enter → PUT | `R/RoomLabelNameField.tsx:34,66-80` | M SCR-20 edit | covered |
| 108 | Validation | blank name → "Tên phòng không được để trống.", name kept, no PUT | `R/RoomLabelNameField.tsx:37,66-71` | E "SCR-20 Tên phòng blank …" | covered |
| 109 | Keyboard | Esc drops the draft | `R/RoomLabelNameField.tsx:101-104` | E "SCR-20 Tên phòng blank …" | covered |
| 110 | Chips | "Gợi ý tên phòng" suggestions | `R/RoomLabelNameField.tsx:38,114-130` | — | gap (P3) |
| 111 | Select | "Công năng" | `R/RoomLabelInspector.tsx:83` | M SCR-20 edit | covered |
| 112 | Button | "Duyệt phòng này" | `R/RoomLabelInspector.tsx:85,159` | M SCR-20 edit | covered |
| 113 | Modal | "Chuẩn hoá tên" → "Xem trước chuẩn hoá tên", Huỷ / Đóng | `R/RoomLabelNormalizePreview.tsx:35-46` | M SCR-20 modals | covered |
| 114 | Modal | normalize preview "Áp dụng" → PUT canonical name ("phòng ngủ 2") | `R/roomLabelReviewGateway.ts:1009-1066`, `domain/rules/registry.ts:421-430` | E "SCR-20 Chuẩn hoá tên …" | covered |
| 115 | Modal | "Gộp phòng" → "Gộp hai phòng", Huỷ | `R/RoomLabelActionDialogs.tsx:25-30` | M SCR-20 modals | covered |
| 116 | Modal | single room → "Không còn phòng nào khác ở tầng này để gộp.", Esc closes | `R/RoomLabelActionDialogs.tsx:28` | E "SCR-20 Gộp phòng with a single room" | covered |
| 117 | Modal | merge / split refusals "Chưa gộp được: …", "Chưa tách được: …" | `R/roomLabelReviewGateway.ts:232-241` | — | gap (P2; needs a dividing wall geometry) |
| 118 | Modal | "Tách phòng" dialog + hint | `R/RoomLabelInspector.tsx:88-90,177`, `R/RoomLabelActionDialogs.tsx:31-38` | — | gap (P2; canvas boundary click) |
| 119 | Filter | "Chưa đặt tên" toggle (aria-pressed + count) | `R/RoomLabelLeftPanel.tsx:44,98-112` | E "SCR-20 Chưa đặt tên filter …" | covered |
| 120 | Edge | filter empties the list → notice says "Tắt bộ lọc…", but the toggle is unmounted (left column = EmptyState) | `R/useRoomLabelReview.ts:155-156,876-880`, `R/RoomLabelReview.tsx:139-149` | E "SCR-20 Chưa đặt tên filter …" | covered — FAILS (dead end) |
| 121 | Section | "Vòng tường hở" gaps, "Xem tại lớp tường" → walls | `R/RoomLabelLeftPanel.tsx:45-49,115-125`, `R/useRoomLabelReview.ts:852-854` | — | gap (P2; needs an open wall loop from the pipeline) |
| 122 | Button | "Kiểm tra lại vòng hở" re-reads the layer | `R/useRoomLabelReview.ts:845-848` | E "SCR-20 no room …" | covered |
| 123 | State | empty "Chưa dò ra phòng nào" + notice | `R/RoomLabelReview.tsx:84-85,139-149`, `R/useRoomLabelReview.ts:153-154` | M SCR-20 (skip branch), E "SCR-20 no room …" | covered |
| 124 | State | error: a failed layer read with no document replaces the screen with `FloorLayerReadFailureScreen` (BUG-326; `R/RoomLabelReview.tsx:249`, `qc/shared/FloorLayerReadFailureScreen.tsx`); "Không đọc được lớp phòng" + "Thử lại" (`R/RoomLabelReview.tsx:89-90,139`) remains for other errors; loading | — | gap (P3; mock only) |
| 125 | State | forbidden "Không có quyền sửa lớp phòng" | `R/RoomLabelReview.tsx:88,166-173` | R9 SCR-20 [V] | covered |
| 126 | State | collapsed "Bảng phòng đang thu gọn" | `R/RoomLabelReview.tsx:89` | — | gap (P3) |
| 127 | Inspector | fields Diện tích / Chu vi / Chiều cao thông thuỷ / Độ tin cậy / Ảnh cắt gốc / "Xem luật không gian" | `R/RoomLabelInspectorFields.tsx:36-51` | — | gap (P3, display) |

## SCR-21 Thickness Standardization (`…/layers/thickness`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 128 | Slider | "Ngưỡng giữa 110 mm và 220 mm" (+ other thresholds) | `T/ThicknessHistogram.tsx:88` | M SCR-21 apply | covered |
| 129 | Checkbox | "Đồng ý chuẩn hoá {n} tường {m} mm về {group}" | `T/ThicknessGroupTable.tsx:43` | M SCR-21 apply, E accept + undo | covered |
| 130 | Buttons | "Xem trước" → "Áp dụng" → bulk PUT | `T/ThicknessApplyBar.tsx:56-58,122-126,194-204` | M SCR-21 apply, E accept + undo | covered |
| 131 | Edge | "Áp dụng" with no group accepted → no PUT | `T/useThicknessStandardization.ts:613-614` | E "SCR-21 preview …" | covered |
| 132 | Keyboard | Esc closes the preview | `T/useThicknessStandardization.ts:829-842` | E "SCR-21 preview …" | covered |
| 133 | Button | preview "Huỷ" | `T/ThicknessApplyBar.tsx:57,88-91` | E "SCR-21 preview …" | covered |
| 134 | Button | apply-bar "Hoàn tác" → PUT restoring thicknesses | `T/ThicknessApplyBar.tsx:55,116-118`, `T/useThicknessStandardization.ts:598-600` | E "SCR-21 accept + Áp dụng … Hoàn tác" | covered |
| 135 | Toast | undo toast "Hoàn tác" after apply | `T/useThicknessStandardization.ts:611-625` | M SCR-21 apply | covered |
| 136 | Input | "Dung sai" (NumericField, mm) | `T/ThicknessApplyBar.tsx:52,105-110` | — | gap (P2) |
| 137 | Button | "Áp dụng lại bộ lọc" + warning "…sẽ đổi tường đã duyệt", "Loại tường đã duyệt ra rồi áp lại" / "Vẫn áp dụng cho tất cả" / "Huỷ" | `T/ThicknessApplyBar.tsx:53,61-66,128-152` | — | gap (P2) |
| 138 | List | unchanged walls "{n} tường không đổi được:" + "Xem" / "Ẩn" | `T/ThicknessApplyBar.tsx:59-60,68-71,160-188` | — | gap (P2; 150 mm walls reach it — see notes) |
| 139 | Table | segment table: row/all checkboxes, "Độ dày chuẩn hoá của đoạn {code}", "Chọn nhóm áp cho …" + Huỷ / Áp dụng, sort "Sai lệch" | `T/ThicknessSegmentTable.tsx:51-63,113-115,195,229-233` | — | gap (P2) |
| 140 | Layout | "Thu gọn khung xem trước" / "Khung xem trước đang thu gọn" | `T/ThicknessStandardization.tsx:113-114` | — | gap (P3) |
| 141 | State | empty, no wall: "Chưa có đoạn tường nào để chuẩn hoá" + no-measurement notice | `T/ThicknessStandardization.tsx:112,166-174`, `T/useThicknessStandardization.ts:127-128,866-870` | M SCR-21 (skip branch), E "SCR-21 no wall" | covered |
| 142 | State | empty, all standard: "Mọi đoạn tường đã ở đúng nhóm chuẩn…" | `T/useThicknessStandardization.ts:125-126,250-252` | E "SCR-21 every wall already 220 mm" | covered |
| 143 | State | error "Không đọc được lớp số đo độ dày" | `T/ThicknessStandardization.tsx:110,185` | — | gap (P3; mock only) |
| 144 | State | forbidden "Không có quyền sửa độ dày tường" | `T/ThicknessStandardization.tsx:111,188-189` | R9 SCR-21 [V] | covered |

## SCR-14 Scale Calibration (`…/floors/:f/scale`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 145 | Radio | "Chọn cách xác định tỷ lệ": "Từ chuỗi kích thước" / "Vẽ đường tham chiếu" | `S/ScaleCalibrationPanel.tsx:51,123-127`, `S/useScaleCalibration.ts:169-170` | M SCR-14 refline, E reference line | covered |
| 146 | Canvas | drag "Bản vẽ đã nắn, kéo để vẽ đường tham chiếu" → two handles | `S/ScaleCalibrationCanvas.tsx:70-74` | M SCR-14 refline, E reference line | covered |
| 147 | Input | "Chiều dài thật" valid (5000 + Enter) → computation | `S/ScaleCalibrationMethodReference.tsx:39,118`, `S/useScaleCalibration.ts:672-695` | M SCR-14 refline | covered |
| 148 | Validation | "0" → apply disabled; "abc" → "Còn thiếu một vế, nên chưa ra được tỷ lệ." | `S/useScaleCalibration.ts:688,1458,1650`, `S/ScaleCalibrationPanel.tsx:57,185-188,233` | E "SCR-14 reference line …" | covered |
| 149 | Button | "Đo lại" disabled before a line, clears the line | `S/ScaleCalibrationMethodReference.tsx:42,100-105` | E "SCR-14 reference line …" | covered |
| 150 | Keyboard | Esc cancel drag, R remeasure, Enter confirm, arrows / Shift+arrows nudge, Shift axis lock | `S/useScaleCalibration.ts:1204-1295` | — | gap (P2) |
| 151 | Radio | "Phạm vi áp tỷ lệ": "Chỉ áp cho tầng này" / "Áp cho mọi tầng" | `S/ScaleCalibrationPanel.tsx:63`, `S/useScaleCalibration.ts:183-184` | M SCR-14 apply / all floors | covered |
| 152 | Button | "Áp dụng tỷ lệ" → PUT scale, "Đã áp tỷ lệ cho bản vẽ" | `S/ScaleCalibrationPanel.tsx:61-62,233-239`, `S/ScaleCalibration.tsx:74` | M SCR-14 apply | covered |
| 153 | Modal | "Áp tỉ lệ này cho N tầng có bản vẽ?" Huỷ / "Áp cho mọi tầng" + report toasts | `S/useScaleCalibration.ts:205-222` | M SCR-14 all floors (Huỷ only) | covered (confirm branch: gap P2) |
| 154 | Toast | "Đã đặt lại tỉ lệ cũ…" undo, "Chưa lưu được tỉ lệ…", "Không tải được danh sách tầng…" | `S/useScaleCalibration.ts:201-208` | — | gap (P2 / mock) |
| 155 | Layout | "Thu gọn bảng" / "Bung bảng" | `S/ScaleCalibrationPanel.tsx:45-46,97-99`, `S/useScaleCalibration.ts:1024-1026,1457` | E "SCR-14 reference line …" | covered — FAILS soft (no-op while state is error, `S/useScaleCalibration.ts:1466-1476,1735`) |
| 156 | State | error: drawing missing / warped → alert + "Quay lại bước tiền xử lý" (→ /quality) + "Tải lại ảnh" (re-read) | `S/ScaleCalibration.tsx:73,77-78,193-212`, `S/useScaleCalibration.ts:1029-1033,1466` | E "SCR-14 floor without drawing …" | covered |
| 157 | State | empty "Chưa có chuỗi kích thước nào để đối chiếu", partial "Chưa đủ dữ liệu để chốt tỷ lệ" | `S/ScaleCalibration.tsx:71-72` | — | gap (P3) |
| 158 | State | forbidden "Bạn không có quyền hiệu chỉnh tỷ lệ" | `S/ScaleCalibration.tsx:75` | R9 SCR-14 [V] | covered |
| 159 | Panel | cross-checks "Kiểm chứng", warnings (thickness / AI deviation) | `S/ScaleCalibrationPanel.tsx:58-60`, `S/useScaleCalibration.ts:179-181,264-269` | — | gap (P3) |

## SCR-22 Overlay Comparison (`…/floors/:f/overlay`)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 160 | Radio | "Kiểu đối chiếu": Chồng lớp / Trượt / Cạnh nhau | `V/OverlayComparisonToolbar.tsx:59,64-81`, `V/types.ts:151-153` | M SCR-22 swipe (Trượt) | covered |
| 161 | Slider | divider "Đường chia đôi…" + arrows | `V/OverlayComparisonCanvasDivider.tsx:35` | M SCR-22 swipe | covered |
| 162 | Slider | "Độ mờ ảnh nguồn" | `V/OverlayComparisonToolbar.tsx:60,103-108` | M SCR-22 swipe | covered |
| 163 | Switch | "Khoá căn" | `V/OverlayComparisonToolbar.tsx:61,164-170` | E "SCR-22 viewport 1024 …" | covered |
| 164 | Select | "Chọn tầng" (label "— Không có ảnh bản vẽ gốc") | `V/OverlayComparisonToolbar.tsx:57-58,70` | — | gap (P2; needs ≥ 2 floors) |
| 165 | Layout | < 1280 px → collapsed, "Cạnh nhau — Khung quá hẹp…" disabled | `V/useOverlayComparison.ts:122,165,362,830-833` | E "SCR-22 viewport 1024 …" | covered |
| 166 | Button | "Xác nhận mô hình khớp bản vẽ" disabled (no measurement source) | `V/useOverlayComparison.ts:104,881-891`, `V/overlayComparisonGateway.ts:338-343` | E "SCR-22 floor without drawing …" | covered |
| 167 | Panel | metrics Sai số trung bình / lớn nhất / số vùng vượt ngưỡng, "Dung sai", "Chưa đo được vùng lệch nào." | `V/OverlayComparisonPanel.tsx:49-56,115-125`, `V/useOverlayComparison.ts:118-120` | M SCR-22 swipe (sentence) | covered |
| 168 | State | error read "Không đọc được ảnh bản vẽ gốc của tầng này.", no fix link | `V/overlayComparisonGateway.ts:356-369`, `V/useOverlayComparison.ts:111,757-762,811-817` | E "SCR-22 floor without drawing …" | covered |
| 169 | State | error frame / scale conflict + link "Sang màn hiệu chỉnh tỷ lệ" | `V/useOverlayComparison.ts:110,112,811-822`, `V/OverlayComparison.tsx:78,168-171` | — | gap (pipeline data) |
| 170 | State | empty CAD "Tầng này nhập từ CAD…", no floor "Dự án này chưa có tầng nào…" | `V/useOverlayComparison.ts:109,121,765-767` | — | gap (CAD branch unreachable, plan F-07) |
| 171 | State | forbidden "Bạn chỉ được xem…", read-only notice | `V/useOverlayComparison.ts:113`, `V/OverlayComparisonToolbar.tsx:62` | — | gap (R9 does not open SCR-22) |
| 172 | State | loading "Đang tải ảnh bản vẽ gốc.", partial sentences | `V/useOverlayComparison.ts:117,128-136` | — | gap (P3) |

## Change impact 8f03047b..60778e96 (shared components)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 173 | Modal | SCR-16 A9 "Bỏ thay đổi chưa lưu của tầng này?" at 375 px: footer now wraps, "Huỷ" and "Tải lại và bỏ thay đổi" inside the viewport | `components/overlay/Modal.tsx:208,258-279`, `W/FloorLayerSaveConfirm.tsx:12-19` | E "SCR-16 409 at 375 px …" | covered |
| 174 | Keyboard | Esc closes the A9 dialog like "Huỷ": banner stays, no re-read, no write | `components/overlay/Modal.tsx:58-63,76-79`, `W/FloorLayerSaveConfirm.tsx:14` | E "SCR-16 409 at 375 px …" | covered |
| 175 | Modal | SCR-14 "Áp tỉ lệ này cho N tầng có bản vẽ?" footer at 375 px | `components/overlay/Modal.tsx:208`, `S/ScaleCalibration.tsx:243-251` | UI "U04 · SCR-14 scale, "Áp cho mọi tầng" → confirm dialog" | covered (UI layer) |
| 176 | Modal | SCR-20 "Xem trước chuẩn hoá tên" / "Gộp hai phòng" footers at 375 px | `components/overlay/Modal.tsx:208`, `R/RoomLabelNormalizePreview.tsx:92-101`, `R/RoomLabelActionDialogs.tsx:84-91` | UI "U04 · SCR-20 rooms, "Chuẩn hoá tên" …", "U04 · SCR-20 rooms, "Gộp phòng" …" | covered (UI layer) |
| 177 | Modal | SCR-20 "Tách phòng" footer at 375 px | `R/RoomLabelActionDialogs.tsx:110-117` | — | gap (same blocker as #118: needs a canvas boundary click) |

Not on any phase-04 screen (checked by grep over `src/screens/qc/{WallLayerReview,ObjectLayerReview,DimensionOcrReview,AxisGridManager,RoomLabelReview,ThicknessStandardization}`, `src/screens/pipeline/ScaleCalibration`, `src/screens/viewer/OverlayComparison`), so no row:
- `components/shell/Breadcrumb.tsx:62,143` 44×44 px levels under 640 px — Breadcrumb is mounted by FloorManager and AppShell users only; the QC screens build their own header.
- `components/feedback/ProgressOverlay.tsx:29`, `PipelineStepper.tsx:148` — blur written as an arbitrary property (visual only); used by processing/onboarding/export screens.
- `screens/qc/FloorManager/*`, `e2e/v7/floor-manager.spec.ts` — Floor Manager route belongs to an earlier phase; no phase-04 screen links to it.
- `i18n/vi.json` other keys (settings, upload, floorManager) — not read by phase-04 screens; only `errors.unknown.description` reaches them (row #49).

## Mocked tests and API pairs

| UI test | Mocked response | Pair |
|---|---|---|
| E "SCR-16 [mocked response] GET …/spatial/layer 500" | `GET /api/projects/:p/floors/:f/spatial/layer` → 500 | unpairable: 5xx is not producible on the shared stack (row owed in `coverage/phase04-be.md`) |

Mock share (edge layer): 1 / 30 = 3,3 % (limit `rules.maxMockedShare` 35 %).

## Summary

- FE rows: 177. covered 118 (rows citing E: 66, M: 61, R9: 5, UI: 2; a row may cite several), gap 57, UNKNOWN 1, n/a-by-design 1.
- Edge tests authored: 30 (`tests/phase04_qc_layers_edge.spec.ts`), 29 real + 1 mocked. New @ 60778e96: "SCR-16 409 at 375 px …" (#173-174);
  updated: the mocked 500 test now expects the new `errors.unknown` copy (#49).
- Covered rows that FAIL on the real stack (suspected app bugs, left failing):
  - #120 SCR-20 "Chưa đặt tên" filter dead end: the notice says to switch the filter off, but `RoomLabelReview.tsx:139-149` replaces the left column (and the toggle) with an EmptyState; title also reads "Chưa dò ra phòng nào" while a room exists.
  - #92 SCR-19 "Thêm trục dọc" on a wall-derived grid: the previewed axes (listed as normal rows with Ẩn/Xoá) vanish once one axis is stored (`useAxisGridManager.ts:455-462`) — 4 rows become 1; the preview can never be committed because "Suy ra từ tường bao" only renders in the empty state.
  - #155 SCR-14 "Thu gọn bảng" is a no-op while the state is `error` (warped drawing): `isPanelCollapsed: state === 'collapsed'` and `error` outranks `collapsed`.
- Priority gaps (next edge round): blocked-save banner (#9), object keys D/W/F/1/2/3 (#67), position slider / host-wall link (#63), thickness tolerance + re-apply warning + segment table (#136-139), scale keyboard path (#150) and all-floors confirm (#153), axis origin / auto-align (#98-99), room merge/split refusals (#117-118).
