# Kiểm kê thay thế toàn bộ — Bản 6

Theo quyết định Bản 6 (`docs/pascal/00-quyet-dinh.md`): Pascal thay HOÀN TOÀN mọi phần 3D của
AppFront mà Pascal thay được. Tài liệu này gắn lại ba nhãn cho **109 tính năng** đã đo ở
`docs/pascal/04-doi-chieu-tung-tinh-nang.md`, cộng các màn/chỗ dùng `three`/`@react-three/*` không
nằm trong 04.

## 0. Ba nhãn, và luật gắn

| Nhãn | Khi dùng |
|---|---|
| **THAY ĐƯỢC** | Pascal (bản hiện tại hoặc chỉ cần việc AppFront-side, không sửa vendor) đủ dùng ngay |
| **THAY ĐƯỢC SAU KHI SỬA PASCAL** | thiếu/một phần/không có → sửa trong `vendor/pascal/packages/*`; mặc định cho mọi nhãn 04 là KHÔNG hoặc KHÔNG BIẾT không có bằng chứng ngược |
| **KHÔNG THAY ĐƯỢC** | chỉ khi sửa Pascal tốn hơn hẳn giữ màn cũ — luôn kèm **hai** ước lượng giờ + bằng chứng |

Luật người dùng áp dụng xuyên suốt: **"KHÔNG" của tài liệu 04 không tự thành "KHÔNG THAY ĐƯỢC"** —
nó chỉ nói Pascal **gốc** chưa có; vì vendor được sửa trực tiếp, phần lớn các dòng "KHÔNG"/"KHÔNG
BIẾT" rơi vào nhãn giữa. Giờ ước lượng trong tài liệu này là bậc độ lớn (order-of-magnitude) để xếp
đợt thi công, không phải cam kết. "Việc AppFront-side" nghĩa là sửa trong `src/components/pascal`
hoặc `src/lib/pascal` (whitelist cho phép, không phải sửa vendor) — vẫn tính vào "thay được", vì
F-15 chỉ cấm giữ hai engine chạy song song, không cấm lớp bọc hợp lệ ở `src/components/pascal`.

---

## 1. `PropertyInspector` + `WallGeometryEditor` (#1–28)

| # | Tính năng (xem 04 để đọc đầy đủ) | Nhãn | Việc vendor/AppFront cần | Giờ |
|---|---|---|---|---|
| 1 | Bảy trạng thái màn (WGE) | SAU KHI SỬA | `editor/src/state`: state machine `forbidden/empty/…` dùng chung cho mọi tool (gốc cho #14,29,39,48,69,82) | 12 |
| 2 | Kéo 1 đỉnh → 1 bước hoàn tác | THAY ĐƯỢC | — | 0 |
| 3 | Esc giữa kéo → trả về, không ghi | THAY ĐƯỢC | — | 0 |
| 4 | Kéo góc → tường nối đi theo (3A) | THAY ĐƯỢC | Pascal **hơn** AppFront (C1); chỉ cần nối, không sửa | 0 |
| 5 | "Mất dấu xác minh" khi sửa (A5) | SAU KHI SỬA | `core/src/schema`: thêm `reviewed?/confidence?/source?` cho các node bị sửa; lệnh sửa đặt `reviewed:false` (gốc cho #9,26,27,51,81) | 24 |
| 6 | Cửa/ô mở dịch theo tỉ lệ khi kéo đỉnh | SAU KHI SỬA | `nodes/src/wall/move-endpoint-tool.tsx`: cập nhật door/window con theo tỉ lệ chiều dài mới khi commit | 10 |
| 7 | Ba loại bắt điểm có tên riêng (kể cả "Vuông góc") | SAU KHI SỬA | `nodes/src/tools/wall/wall-snap-geometry.ts`: thêm nhãn riêng, cơ chế đã có | 3 |
| 8 | Sửa 3D ⇒ 2D khớp | THAY ĐƯỢC | Pascal **hơn** (C3 — một nguồn dữ liệu) | 0 |
| 9 | Chip đối chiếu bản vẽ gốc AI | SAU KHI SỬA | cộng vào #5: lưu `originalTrace` lúc tạo node | gộp #5 |
| 10 | Thêm/xoá đỉnh = split/merge nghiệp vụ | SAU KHI SỬA | `nodes/src/wall`: viết `merge-tool` nghiệp vụ (hiện chỉ gộp mesh hiển thị) | 10 |
| 11 | Bảng đỉnh sửa x/y, nudge phím mũi tên | SAU KHI SỬA | `editor/src/components`: panel "WallVertexTable" mới, gắn `sidebarTabs` | 14 |
| 12 | Ghi bị từ chối có lý do; Esc thoát lớp trên | SAU KHI SỬA | đo cơ chế từ chối hiện có trước (04 ghi KHÔNG BIẾT), vá câu giải thích nếu thiếu | 6 |
| 13 | Ghi qua `commit(patch,label)`, không `set()` | THAY ĐƯỢC | việc AppFront-side: mọi đường sửa đi qua `src/lib/pascal/fromPascal.ts` rồi `commit()` của store AppFront — không sửa vendor | 8 |
| 14 | Bảy trạng thái + a11y + vi + không màu thô (PI) | SAU KHI SỬA | dùng hạ tầng #1 | gộp #1 |
| 15 | Giữ layout ổn định nhiều dòng | SAU KHI SỬA | đo trước (04: KHÔNG BIẾT), vá nếu thiếu | 4 |
| 16 | Dấu gạch ngang khi giá trị lệch | THAY ĐƯỢC | — | 0 |
| 17 | Xem trước 3D sống khi kéo độ dày | THAY ĐƯỢC | — | 0 |
| 18 | Ghi vào model, đọc lại đúng | THAY ĐƯỢC | — | 0 |
| 19 | Ctrl+Z 1 bước, gộp theo phiên kéo (D-06) | THAY ĐƯỢC | chấp nhận gộp theo phiên thay vì cửa sổ 400 ms tường minh — cùng tinh thần D-06 | 0 |
| 20 | Từ chối đổi chiều cao tường thấp hơn ô mở (A9) | SAU KHI SỬA | `nodes/src/wall`: ràng buộc `wallHeight ≥ max(openingHeight)`, map sang dialog A9 ở AppFront overlay | 8 |
| 21 | Đổi bề rộng bao nội thất (qua `scale`, không phải mm) | THAY ĐƯỢC | việc AppFront-side: `src/lib/pascal` quy đổi scale↔mm hai chiều, không sửa vendor | 6 |
| 22 | Cảnh báo `FURNITURE-CLASH` nêu tên + link "Xem quy tắc" | SAU KHI SỬA | `nodes/src/lib/item-polygon-overlap.ts` lộ ra UI + `ruleCode`; panel cảnh báo mới trong `editor` | 16 |
| 23 | 4 phím tắt qua registry; không nút Lưu | SAU KHI SỬA | thiếu `?`/Ctrl+F — cộng việc #42 | gộp #42 |
| 24 | Tự lưu 800 ms, "Đã lưu lúc HH:MM" | THAY ĐƯỢC | việc AppFront-side: tự debounce 800 ms rồi gọi `onSave` của `<Editor>` (không dùng `localStorage` mặc định của Pascal); caption hiển thị ở `inspectorFooter` do AppFront vẽ | 6 |
| 25 | Nút "Lưu làm khuôn mẫu" | SAU KHI SỬA | đo trước (04: KHÔNG BIẾT); nếu thiếu, thêm nút trong `item-catalog` | 8 |
| 26 | Duyệt/Bỏ qua → `reviewed/source` cứng, badge chỉ người duyệt đặt | SAU KHI SỬA | cộng vào #5: UI nút Duyệt/Bỏ qua + badge | gộp #5 |
| 27 | Trường "Độ tin cậy" % | SAU KHI SỬA | cộng vào #5: hiển thị field `confidence` | gộp #5 |
| 28 | 8 kiểu control (thiếu "link", nhóm "inspection") | SAU KHI SỬA | `editor/src/components/parametric-field-control.tsx`: thêm kiểu "link" + nhóm "inspection" | 6 |

**Tổng giờ cụm 1 (không gộp trùng):** ~113 h vendor/AppFront (hạ tầng #1 ≈12h, #5 ≈24h dùng chung
nhiều dòng).

---

## 2. `ViewerShell` + `Viewer3D` + `HistoryPanel` (#29–56)

| # | Tính năng | Nhãn | Việc vendor/AppFront cần | Giờ |
|---|---|---|---|---|
| 29 | Bảy trạng thái (VS) | SAU KHI SỬA | hạ tầng #1 | gộp #1 |
| 30 | Vai Người xem đủ ray (VS-2) | SAU KHI SỬA | `core`: thêm `role` thật (viewer/editor/admin) thay `isVersionPreviewMode`; check ở mọi tool (gốc cho #41,67,108) | 16 |
| 31 | Xếp tầng + độ tách liên tục (VS-3) | SAU KHI SỬA | `viewer/src/systems/level-system`: đổi 3 nấc rời rạc → slider liên tục (gộp với #98) | 8 |
| 32 | Mặt phẳng cắt kéo được (VS-4,7) | SAU KHI SỬA | `viewer/src/systems`: clipping plane tương tác, tool mới | 20 |
| 33 | Panel trượt tôn trọng giảm chuyển động (VS-8) | SAU KHI SỬA | `editor`: bọc `prefers-reduced-motion` quanh animation sidebar | 3 |
| 34 | Minimap / ViewCube (VS-9) | SAU KHI SỬA | `viewer`: component ViewCube mới (three.js gizmo) | 16 |
| 35 | `frameStorey` khuôn camera vào tầng (VS-11/12) | SAU KHI SỬA | `viewer`: xác nhận/thêm `camera.fitToBounds(levelId)` khi đổi tầng (gốc cho #99) | 6 |
| 36 | `inspectorSections` — khe cắm nội dung (VS-13) | THAY ĐƯỢC | việc AppFront-side: dùng slot `sidebarTabs`/`extraSidebarPanels` có sẵn của `<Editor>`, không sửa vendor | 8 |
| 37 | 13 phím tắt qua registry có báo trùng (A12) | SAU KHI SỬA | AppFront tự đăng ký qua `shortcutRegistry` rồi forward xuống Pascal (ít sửa vendor) | 12 |
| 38 | Chip hiệu năng tam giác (VS-6) | THAY ĐƯỢC | — | 0 |
| 39 | Bảy trạng thái (V5-1) | SAU KHI SỬA | hạ tầng #1 | gộp #1 |
| 40 | Lỗi WebGL câu thường, tiếng Việt (A6) | SAU KHI SỬA | `unsupported-gpu-fallback.*`: Việt hoá — phần của việc 7 (nợ A6) trong prompt gốc F-15 | 4 |
| 41 | Không quyền: gỡ nút khỏi DOM | SAU KHI SỬA | hạ tầng RBAC #30 | gộp #30 |
| 42 | Ô tìm Ctrl+F, không dấu (Q2) | SAU KHI SỬA | lệnh mới trong command palette của Pascal gọi chuẩn hoá bỏ dấu đã có ở `lib/format` AppFront (gộp #23) | 20 |
| 43 | Lớp phủ cộng tác luôn có mặt (VO-1) | SAU KHI SỬA | `viewer`: hệ presence/cursor đa người dùng mới, nối `CollaborationLayer` hiện có | 24 |
| 44 | Chế độ sửa hình học tường (VO-2, VP-4) | THAY ĐƯỢC | — | 0 |
| 45 | Ba bảng phụ loại trừ nhau, cột 344px (VP-2) | SAU KHI SỬA | dùng slot `sidebarTabs` để dựng đúng 3 panel AppFront ("Diện tích phòng"/"Lịch sử thao tác"/…); nếu khe không đủ mềm, sửa `panel-manager.tsx` | 10 |
| 46 | Esc đóng bảng phụ đang mở (VP-3, A12) | SAU KHI SỬA | `editor/src/hooks/use-keyboard.ts`: thêm nhánh Escape đóng sidebar panel | 3 |
| 47 | `BuildQueue` tiến độ, giải phóng tài nguyên | SAU KHI SỬA | đo trước (04: MỘT PHẦN), vá nấc chi tiết nếu thiếu | 6 |
| 48 | Bảy trạng thái (HistoryPanel) | SAU KHI SỬA | hạ tầng #1 — **nhưng xem #49**: nếu HistoryPanel giữ nguyên thì #48 cũng giữ nguyên, không cần hạ tầng #1 cho màn này | — |
| 49 | Hoàn tác không phá huỷ, mục cũ hiện mờ (N1) | **KHÔNG THAY ĐƯỢC** | xem PHẦN Đ dưới — ước lượng đầy đủ ở đó | 80 / 0 |
| 50 | Diff cũ→mới theo trường (N2) | **KHÔNG THAY ĐƯỢC** | cùng lý do #49 | 80 / 0 |
| 51 | Chip loại việc edit/review/ai | **KHÔNG THAY ĐƯỢC** | cùng lý do #49 | 80 / 0 |
| 52 | Gộp theo ngày/phiên 30 phút (N3) | **KHÔNG THAY ĐƯỢC** | cùng lý do #49 | 80 / 0 |
| 53 | Mỗi mục dẫn tới đối tượng, khuôn camera (N5) | **KHÔNG THAY ĐƯỢC** | cùng lý do #49 | 80 / 0 |
| 54 | Nhảy về 1 bước, hoạt cảnh 340 ms | **KHÔNG THAY ĐƯỢC** | đi cùng màn #49 (HistoryPanel AppFront giữ nguyên) | 80 / 0 |
| 55 | Hoàn tác kèm toast (A8) | SAU KHI SỬA | độc lập khỏi #49: `core/history-control.ts` thêm event `onUndo/onRedo`; AppFront tự hiện toast (như #63) | 6 |
| 56 | `Ctrl+H` mở panel, không giành `Mod+Z` | THAY ĐƯỢC | không áp dụng — Pascal không có panel để giành phím | 0 |

**PHẦN Đ — vì sao #49–54 là KHÔNG THAY ĐƯỢC (hai ước lượng + bằng chứng):**

`04-doi-chieu-tung-tinh-nang.md` PHẦN E đã đo: AppFront lưu lịch sử bằng **lệnh có ngữ nghĩa**
(`Command { actorId, description, changes: EntityChange[] }`), Pascal lưu bằng **ảnh chụp toàn
cảnh** (`SceneSnapshot`, `zundo` — `history-control.ts:8-23,36-43`). "Mục cũ hiện mờ", "diff theo
trường", "chip ai/review", "gộp theo phiên hiển thị ra UI", "mỗi mục dẫn tới đối tượng" đều đọc
**ngữ nghĩa của lệnh** (ai làm gì trên đối tượng nào) — thứ `zundo` không lưu, nên không có gì để
dịch ra.

- **Ước lượng sửa Pascal:** dựng lại `HistoryStack` ngữ nghĩa trên nền `zundo` — viết tầng dịch
  snapshot→diff→command (so hai `SceneSnapshot` liên tiếp ra `EntityChange[]`, suy đoán actor/mô tả
  từ ngữ cảnh lệnh gọi, vì `zundo` không lưu chúng), rồi viết lại UI lịch sử trên dữ liệu suy luận
  được. **≈ 80 giờ**, rủi ro cao (suy luận có thể sai actor/mô tả vì nguồn không lưu).
- **Ước lượng giữ màn cũ:** `HistoryPanel` AppFront (3 991 dòng, đã chạy production, có test N1–N5)
  **đã làm xong** — chỉ cần đổi nguồn đọc sang log lệnh AppFront (vốn đã ghi `Command` ngữ nghĩa cho
  mọi sửa qua Pascal, vì `src/lib/pascal/fromPascal.ts` tạo `Command` AppFront thật trước khi `commit()`).
  **≈ 0 giờ việc mới** — nối lại, không viết lại.
- **Quyết định:** giữ `HistoryPanel` AppFront nguyên vẹn, đọc log lệnh AppFront (không đọc lịch sử
  nội bộ của Pascal). Hai engine không trùng việc: Pascal tự quản `Ctrl+Z` của riêng nó cho thao tác
  chưa commit, AppFront quản lịch sử đã commit.

---

## 3. `MeasurementTool` + `RoomAreaPanel` (#57–86)

| # | Tính năng | Nhãn | Việc vendor/AppFront cần | Giờ |
|---|---|---|---|---|
| 57 | Đo điểm-đến-điểm | THAY ĐƯỢC | AppFront tự vẽ nhãn đo bằng `viewerSceneSlot`, định dạng số ở `lib/format` (A15), không dùng HUD chữ của Pascal | 4 |
| 58 | Đo vuông góc bề mặt (point-to-plane) | SAU KHI SỬA | `core`: thêm `measurement-kind` `pointToPlane`; tool tương tác mới trong `nodes` | 14 |
| 59 | Đo chiều cao | SAU KHI SỬA | `core`: thêm `measurement-kind` `height`, dùng height-anchor sẵn có làm chế độ đo thật | 8 |
| 60 | Đo diện tích (≥3 điểm) | THAY ĐƯỢC | cùng cách #57 (AppFront format nhãn + đơn vị riêng) | 4 |
| 61 | Chip bắt điểm có "giao trục" | SAU KHI SỬA | `core/registry`: thêm snap kind `axisIntersection` | 6 |
| 62 | Ghim phép đo, tên "Phép đo N" | THAY ĐƯỢC | AppFront đặt tên lúc tạo qua API `createMeasurement(name)` | 2 |
| 63 | Xoá phép đo kèm toast hoàn tác (A8) | THAY ĐƯỢC | AppFront bọc `onDelete` rồi tự hiện toast (như #55) | 3 |
| 64 | Đổi đơn vị mm/cm/m (3 nấc) | THAY ĐƯỢC | AppFront overlay hiển thị số theo 3 nấc, Pascal lưu SI | 4 |
| 65 | Giá trị đo không "chạy số" cho tới ghim | SAU KHI SỬA | đo trước xem `@number-flow` có áp cho HUD đo không (nghi vi phạm A15, 04 ghi KHÔNG BIẾT); nếu có, AppFront tự vẽ HUD riêng thay Pascal's | 6 |
| 66 | Phím M/Esc/Enter/Delete có nút chuột song song (A12) | SAU KHI SỬA | xác nhận + thêm nút nếu thiếu | 4 |
| 67 | Trạng thái forbidden: đo được, không ghim được, có giải thích | SAU KHI SỬA | hạ tầng RBAC #30 | gộp #30 |
| 68 | Hover 1 hàng ghim: tô sáng, hàng khác mờ | SAU KHI SỬA | `floorplan-measurements-layer.tsx`: thêm hover-dim nếu đo trước thấy thiếu (04: KHÔNG BIẾT) | 4 |
| 69 | Bảy trạng thái | SAU KHI SỬA | hạ tầng #1 | gộp #1 |
| 70 | Nhãn tiếng Việt, **viết hoa chữ đầu** (A6, chốt 2026-10-04) | SAU KHI SỬA | phần của việc Việt hoá tổng (#40) — theo quy ước MỚI (hoa chữ đầu), không theo "viết thường" mà 04 ghi (tài liệu cũ trước khi chốt) | gộp #40 |
| 71 | Bảng phòng gộp tầng/công năng, tổng phụ | SAU KHI SỬA | `editor/src/lib/floorplan/schedules.ts`: thêm nhóm theo công năng + subtotal | 8 |
| 72 | Tổng diện tích, đơn vị là phần tử riêng (A15) | THAY ĐƯỢC | AppFront tự vẽ tổng diện tích đọc qua API, không sửa vendor | 2 |
| 73 | Sắp xếp / đổi cách nhóm | SAU KHI SỬA | AppFront dựng control sort riêng đọc dữ liệu qua `toSpatial` | 6 |
| 74 | Hai chế độ: panel thu gọn / bảng toàn trang | SAU KHI SỬA | AppFront dựng 2 chế độ UI riêng đọc dữ liệu Pascal, không sửa `core` | 8 |
| 75 | Bộ chọn tầng lọc bảng riêng (không khoá toàn ứng dụng) | SAU KHI SỬA | `zone-panel/index.tsx`: tách bộ lọc tầng riêng cho panel | 4 |
| 76 | Thanh xếp chồng diện tích theo công năng, tối đa 3 dải (A4) | SAU KHI SỬA | AppFront tự vẽ (đọc data qua API, đúng 3 màu trạng thái A4), không sửa vendor | 6 |
| 77 | Bấm dòng: chọn **và** khuôn camera 3D | SAU KHI SỬA | `viewer`: xác nhận/thêm `fitCameraTo(zoneId)` | 4 |
| 78 | Hover đồng bộ panel ↔ 3D | SAU KHI SỬA | `core`/`viewer`: thêm event `onZoneHover` báo ra ngoài (thiếu ở cả hai phía, 04 PHẦN A7) | 6 |
| 79 | Sửa tên tại chỗ, tự lưu 800 ms, dòng nháy (A7) | THAY ĐƯỢC | AppFront tự vẽ ô sửa tên gọi `updateZoneName`, autosave 800 ms dùng `hooks/useAutosave` AppFront có sẵn | 4 |
| 80 | Hoàn tác đổi tên kèm toast 8 giây (A8) | THAY ĐƯỢC | giống #55/#63 | 2 |
| 81 | Chấm trạng thái trusted/suspect/reviewed (A4+A5) | SAU KHI SỬA | cộng vào #5: field trên `ZoneNode` | gộp #5 |
| 82 | Bảy trạng thái | SAU KHI SỬA | hạ tầng #1 | gộp #1 |
| 83 | Trạng thái rỗng: nút "Kiểm tra khe hở tường" riêng | THAY ĐƯỢC | `space-detection.ts` đã có máy dò; AppFront lộ nút gọi nó qua API (vendor export hàm nếu chưa export, +2h) | 4 |
| 84 | Thu gọn: 5 phòng lớn nhất, giảm dần | THAY ĐƯỢC | AppFront tự sort/slice dữ liệu đọc qua API | 2 |
| 85 | Sao chép bảng ra text / xuất | THAY ĐƯỢC | AppFront thêm nút copy đọc dữ liệu bảng; xuất PDF của Pascal dùng được luôn | 2 |
| 86 | Chú giải cách tính + đếm cửa/sổ + chu vi/cao mỗi dòng | SAU KHI SỬA | `editor/quantities-panel.tsx` chỉ 1 zone → cần panel toàn bảng; đếm cửa/sổ tính ở domain AppFront, hiển thị qua panel mới | 10 |

---

## 4. `OverlayComparison` + `ExplodedView` + `FurnitureLibraryPanel` (#87–109)

| # | Tính năng | Nhãn | Việc vendor/AppFront cần | Giờ |
|---|---|---|---|---|
| 87 | Ba lớp thị giác đúng 3 (A4) | SAU KHI SỬA | AppFront vẽ thêm 2 lớp (hình học chiếu, lệch gạch chéo) qua `viewerSceneSlot`, không sửa `core` | 10 |
| 88 | Ba kiểu đối chiếu: chồng lớp / trượt / cạnh nhau | THAY ĐƯỢC | AppFront dựng swipe/side-by-side ở lớp UI riêng qua `viewerSceneSlot`, Pascal chỉ cấp canvas | 8 |
| 89 | Đường chia kéo chuột + phím, tay cầm tự nói là gì (A12) | THAY ĐƯỢC | cùng cách #88, AppFront-side | 6 |
| 90 | Độ mờ ảnh nguồn bằng slider % (mất A6/A15) | SAU KHI SỬA | AppFront bọc control riêng gọi `guide.opacity` qua API `<Editor>`, đổi nhãn/định dạng số | 3 |
| 91 | Đo lệch tự động: trung bình/lớn nhất/đếm vượt dung sai | **THAY ĐƯỢC** (chấp nhận mức Pascal) | AppFront tự khai chưa làm (04 §D1 — `supported:false` ở `overlayComparisonGateway.ts`); **khuyến nghị: không làm nốt tính năng chưa từng chạy**, dùng mức Pascal hiện có (không có đo lệch) | 0 |
| 92 | Danh sách vùng lệch, chọn hàng vẽ đường đo | **THAY ĐƯỢC** (chấp nhận mức Pascal) | cùng lý do #91 (D1) | 0 |
| 93 | Chỉnh dung sai (mm), đánh giá lại | **THAY ĐƯỢC** (chấp nhận mức Pascal) | cùng lý do #91 (D1) | 0 |
| 94 | Xác nhận "mô hình khớp bản vẽ" — chỉ người bấm mới đặt (A5) | **THAY ĐƯỢC** (chấp nhận mức Pascal) | cùng lý do #91 (D1) — `confirmFloorMatch` cũng `supported:false` ở AppFront | 0 |
| 95 | Lệch tỉ lệ giữa hai tầng → lối sang Hiệu chỉnh tỷ lệ | SAU KHI SỬA | tính toán ở domain AppFront, đọc `scaleReference` của 2 `GuideNode` qua API, không sửa vendor | 6 |
| 96 | Chọn tầng, biết tầng đã có scan/hình học chưa | SAU KHI SỬA | `floating-level-selector.tsx`: thêm cờ `hasScan`/`hasGeometry` | 3 |
| 97 | Khoá ảnh không cho dịch/xoay khi đang vẽ theo (mất A6) | THAY ĐƯỢC | đổi nhãn tiếng Việt ở lớp AppFront vẽ, không sửa vendor | 2 |
| 98 | Tách tầng theo trục đứng, liên tục 0/0,5/1 | SAU KHI SỬA | gộp với #31 (cùng `level-system`) | gộp #31 |
| 99 | Thẻ tầng hiện cao độ + diện tích, bấm kích hoạt + bay camera | SAU KHI SỬA | `floating-level-selector.tsx`: hiển thị elevation/area (đọc domain AppFront truyền qua scene metadata) + camera fly (dùng #35) | 10 |
| 100 | Nhãn tầng chỉ hiện khi tách đủ xa | SAU KHI SỬA | `level-system.tsx`: thêm ngưỡng ẩn/hiện theo khoảng tách | 3 |
| 101 | Chỉ báo lệch trục giữa các tầng | SAU KHI SỬA | tool mới: tính lệch tâm/trục giữa `WallNode` các tầng liên tiếp, vẽ overlay cảnh báo | 16 |
| 102 | Giảm chuyển động → nhảy thẳng (B) | SAU KHI SỬA | `viewer`: bọc `prefers-reduced-motion` quanh animation lerp exploded | 3 |
| 103 | Lưới thẻ ảnh **đơn sắc**, cấm ảnh thật nhiều màu (A1) | SAU KHI SỬA | `editor/catalog-items.tsx`: thêm chế độ hiển thị đơn sắc khi dùng trong luồng AppFront (prop/theme riêng, không đổi default của Pascal) | 8 |
| 104 | 9 nhóm chip lọc tiếng Việt cố định + tìm bỏ dấu | THAY ĐƯỢC | AppFront viết lớp filter riêng gọi API catalog của Pascal, không sửa `core` | 8 |
| 105 | Dải "Đã phát hiện" (YOLO) ghim đầu + "Thay thế tất cả" | SAU KHI SỬA | `editor`: API "pin items"; AppFront orchestrating batch-replace gọi nhiều lệnh Pascal | 10 |
| 106 | Thao tác hàng loạt luôn xem trước, gộp 1 bước hoàn tác (A8) | SAU KHI SỬA | `editor`: thêm "dry-run preview" trước khi áp `runAsSingleSceneHistoryStep` cho batch | 10 |
| 107 | Kéo thẻ thả vào đối tượng đích | SAU KHI SỬA | `editor/item-catalog`: thêm chế độ kéo-thả (`draggable`, `onDrop` → `targetEntityId`) cạnh cơ chế "vũ trang" hiện có | 12 |
| 108 | Không quyền: ẩn nút tải lên, thẻ khoá không kéo | SAU KHI SỬA | hạ tầng RBAC #30 | gộp #30 |
| 109 | Chiều cao thật đồ đạc | **THAY ĐƯỢC** | việc AppFront-side: `src/lib/pascal/toPascal.ts` bỏ `FURNITURE_HEIGHT_M = 0`, dùng `item.heightMm` thật — `ItemNode.asset.dimensions` của Pascal đã nhận giá trị thật, không cần sửa vendor | 4 |

**Đếm đã gắn nhãn: #1–109, đủ 109/109** (xem bảng tổng §7 để đối soát theo màn).

---

## 5. Hai màn ngoài 109 tính năng của 04: `MobileViewer`, `VersionVisualDiff`

| Màn | Nhãn | Ghi chú |
|---|---|---|
| `MobileViewer` (6 724 dòng, màn riêng cho `/m/:projectId`, LOD gọn-trước-rồi-nâng-dần theo R-04/S-45) | THAY ĐƯỢC SAU KHI SỬA PASCAL | Không có bằng chứng Pascal có mức LOD "gọn trước" tương đương cho di động (mặc định không bằng chứng → nhãn giữa). Vendor cần: `viewer/src` — chế độ dựng mức thô trước (giống `buildFloorAtDetail('block')` của AppFront) rồi nâng dần, cộng `PerfMonitor profile:'mobile'` tương đương. Ước lượng **~24h**. |
| `VersionVisualDiff` (208 dòng, `screens/export/VersionHistory`) | THAY ĐƯỢC | Màn này **không tự dựng cảnh riêng** — nó `await import()` động chính `screens/viewer/Viewer3D` (`mountViewerScene`) để vẽ mô hình hiện tại và tô sáng `selectedEntityIds`. Khi Viewer3D được thay bằng Pascal, chỉ cần đổi nguồn dựng sang `<Viewer>`/`<Editor>` của Pascal và dùng cơ chế chọn/tô sáng có sẵn (`selection-manager.tsx`) để tô các id đã đổi — không cần sửa vendor. Ước lượng **~10h AppFront-side**. |

---

## 6. `src/lib/three` — ở lại, không phải màn

`src/lib/three/present` là tầng trình diễn dùng ở `/login` (`houseScene.ts` của `AuthScreen`,
qua `mountPresentation(canvas, plan)`) — **không nằm trong phạm vi F-15** (không phải màn 3D nghiệp
vụ, không đọc/sửa dữ liệu dự án). Người gọi còn lại: `src/screens/auth/AuthScreen/houseScene.ts`
(duy nhất hiện tại, qua `ValuePanel.tsx:52` `import('./houseScene')`).

`src/lib/three/camera/frameObjects` (dùng ở `useCollaborationLayer.ts:11`, khuôn camera vào một
ghim cộng tác) và `src/lib/three/build`, `src/lib/three/perf` (dùng ở `useFloorLifecycle.ts`, xem
§7) là hạ tầng chung — chúng ở lại đúng vị trí (`src/lib/three`), và việc của F-15 chỉ là: khi màn
nào gọi chúng bị xoá (Viewer3D, ExplodedView, MeasurementTool, …), kiểm lại còn người gọi nào khác
không trước khi xoá chính hạ tầng đó.

---

## 7. Bốn chỗ khác còn `three`/`@react-three/*` ngoài danh sách 109 tính năng

| Tệp | Vai trò | Nhãn | Việc |
|---|---|---|---|
| `src/hooks/useFloorLifecycle.ts` (157 dòng) | Hook build/dispose một storey mesh (ledger tài nguyên, tránh rò bộ nhớ three.js) | — | **Không có nơi gọi nào ngoài chính nó và bài test** (`grep -rln useFloorLifecycle src` → chỉ ra đúng tệp của nó). Có thể là mã đã chết từ trước, hoặc còn người gọi gián tiếp chưa tra hết trong 35' của đợt này. Ghi vào "Nợ" — người gộp cần xác nhận rồi xoá cùng lúc với Viewer3D/ExplodedView/MeasurementTool nếu đúng là chết. |
| `src/lib/export/screenshot.ts` (1 242 dòng, `import { WebGLRenderTarget, Camera, Object3D } from 'three'`) | Chụp ảnh cảnh 3D cho xuất PDF/ảnh, nhận `Camera`/`Object3D` của cảnh cũ | SAU KHI SỬA / đơn giản hoá | Khi màn nguồn dựng bằng Pascal, canvas của Pascal có sẵn (`data-testid="pascal-canvas"`) — có thể chụp bằng `canvas.toDataURL()` thay vì tự dựng `WebGLRenderTarget`, **khả năng bỏ hẳn import `three` ở tệp này**. Cần viết lại phần nhận cảnh từ Pascal. Ước lượng **~12h AppFront-side**, không sửa vendor. |
| `src/screens/export/ExportPanel/useExportPanel.ts`, `src/lib/export/fitText.ts` | — | **không áp dụng** | Hai tệp này **không thực sự import `three`/`@react-three`** — khớp của `git grep` nằm trong **docblock (chú thích, câu chữ)**, không phải lệnh `import` (xác nhận bằng `grep -n "from ['\"]three"` chỉ ra số dòng rơi vào comment). Không cần việc gì. |
| `src/screens/system/CollaborationLayer/useCollaborationLayer.ts` (646 dòng) | Lớp phủ cộng tác — chỉ `import type { Object3D } from 'three'` để khuôn camera (`frameObjects`, R-07) | THAY ĐƯỢC | Chỉ là kiểu dữ liệu cho tham số của `frameObjects` (`src/lib/three/camera`, mục §6) — không dựng cảnh riêng. Khi Pascal cấp camera/API khuôn hình tương đương (hoặc dùng thẳng `frameObjects` hiện có trỏ vào camera của Pascal), tệp này không cần sửa gì khác ngoài đổi nguồn `Object3D`. ~2h kiểm lại. |

`src/screens/auth/AuthScreen/houseScene.ts` không có `import` trực tiếp `three`/`@react-three` (chỉ
tệp test của nó có) — nó dùng `src/lib/three/present`, đã xếp ở §6.

---

## 8. Mã chưa làm xong của AppFront (04 §D1) — khuyến nghị

| Chỗ | Trạng thái | Khuyến nghị |
|---|---|---|
| `OverlayComparison`: `imageToModelTransform`, `deviationRegions`, `matchMetrics`, `confirmFloorMatch` (`overlayComparisonGateway.ts:52-64`, cả bốn `supported:false`) | chưa đo gì cả, hôm nay | Thay bằng bản Pascal ở **mức hiện tại** (#91–94 ở trên) — không làm nốt tính năng AppFront chưa từng chạy |
| Chip đối chiếu bản vẽ gốc của `WallGeometryEditor` (#9, luôn trả `null`) | chưa có tầng nào giữ hình học gốc | Gộp vào hạ tầng #5 (nếu làm) — nếu không làm #5 sâu tới mức đó, giữ `null` như hiện tại, không phải nợ mới do F-15 |
| Hover đồng bộ của `RoomAreaPanel` (#78, tự khai chưa nối) | chưa nối ở cả hai phía | Làm mới ở Pascal (đã xếp #78: SAU KHI SỬA, event `onZoneHover`) — đây là việc thêm giá trị, không phải "làm nốt nợ cũ" vì phía Pascal cũng chưa có |
| Cờ `isHeavy` của `FurnitureLibraryPanel` (docblock tự khai "cảnh nền tính bằng KHÔNG hôm nay") | chưa đo | Không thuộc phạm vi màn-đổi-engine; để nguyên, đo riêng nếu cần khi màn `FurnitureLibraryPanel` mới (#103–109) được thi công |

---

## 9. Chặn BE

Prompt gốc F-15 liệt bốn mã chặn: **F-04b, F-04c, F-05, F-08**. Tra lại `F:/App/AppBack/backend/prompts/`:

- **F-04b.md** và **F-04c.md** mở đầu bằng `> ĐÃ THAY bởi F-04x-1/F-04x-2 (2026-10-05) — không chạy.`
  — hai mã này đã **lạc hậu** trước khi F-15 được viết.
- **F-05.md không tồn tại** — bản thật là **F-05a** (chất lượng ảnh, tải khúc) và **F-05b** (màn Xử
  lý); không sở hữu tệp nào liên quan 3D/Pascal.
- `git log --oneline --all | grep -E "F-04x|F-05a|F-05b|F-08"` trên AppFront: **F-04x-1, F-04x-2,
  F-05a, F-05b, F-08 đều đã merge vào master** (`efbda6bd merge: F-08`, `566e2fd2 merge: F-04x-2`,
  `f89ca1a3 merge: F-05a`, …).
- `grep -rn "F-04b\|F-04c\|F-05\|F-08\|F-04x" src/lib/pascal` → **rỗng** — không tệp nào trong tầng
  đổi dữ liệu Pascal còn chặn hay chờ các mã này.

**Kết luận: không còn chặn BE nào đang mở** khớp bốn mã cũ trong prompt gốc — chúng đã hợp nhất.
Phần chức năng mà các prompt đó phủ (lưu lớp tầng, nạp đồ thị/tầng từ ngoài, hiệu chỉnh tỷ lệ, phiên
bản theo tầng) đã có sẵn ở `useFloorLayerAutosave`, `useProjectSpatial`, `useFloorLayer`,
`scaleCalibrationGateway`, `VersionHistory` — tức là nền để `src/lib/pascal` (`fromPascal.ts`,
`guard.ts`) ghi lại đã có đủ, không phải đợi BE. Không giả lập gì — ghi đúng điều tra được.

---

## 10. Bảng tổng

| Màn/cụm | Nhãn chiếm đa số | Việc vendor chính | Ước lượng cộng dồn | Chặn BE |
|---|---|---|---|---|
| PropertyInspector + WallGeometryEditor | SAU KHI SỬA | `core` (reviewed/confidence), `nodes` (reflow ô mở, merge, snap), `editor` (panel đỉnh x/y, cảnh báo va chạm, state máy 7 trạng thái) | ~113h | không |
| ViewerShell + Viewer3D | SAU KHI SỬA | `viewer` (RBAC role, mặt cắt, ViewCube, presence), `editor` (panel loại trừ nhau, Esc đóng panel) | ~105h | không |
| HistoryPanel | **KHÔNG THAY ĐƯỢC** | — (giữ màn AppFront, đọc log lệnh AppFront) | 0h (nối lại) | không |
| MeasurementTool | SAU KHI SỬA | `core` (measurement-kind point-to-plane/height, snap giao trục) | ~52h | không |
| RoomAreaPanel | SAU KHI SỬA / THAY ĐƯỢC pha trộn | `editor` (schedules nhóm công năng, panel toàn bảng, đếm cửa/sổ) | ~26h vendor + ~26h AppFront-side | không |
| OverlayComparison | THAY ĐƯỢC (mức hiện tại) + SAU KHI SỬA một phần | `core` (GuideNode scaleReference 2 tầng, cờ hasScan), còn lại AppFront-side (viewerSceneSlot) | ~19h vendor + ~24h AppFront-side | không |
| ExplodedView | SAU KHI SỬA | `viewer/level-system` (slider liên tục, ngưỡng nhãn, chỉ báo lệch trục) | ~32h | không |
| FurnitureLibraryPanel | SAU KHI SỬA | `editor`/`nodes`/`item-catalog` (chế độ đơn sắc, kéo-thả, batch preview, pin YOLO) | ~38h vendor + ~12h AppFront-side | không |
| MobileViewer | SAU KHI SỬA | `viewer` (LOD mobile gọn-trước) | ~24h | không |
| VersionVisualDiff | THAY ĐƯỢC | — (AppFront-side, đổi nguồn dựng) | ~10h AppFront-side | không |
| `src/lib/three/present` (/login) | ở lại | — | — | không áp dụng |
| `useFloorLifecycle.ts` | nợ cần xác nhận | — | — (xoá nếu đúng là chết) | không |
| `lib/export/screenshot.ts` | SAU KHI SỬA (đơn giản hoá) | — (AppFront-side) | ~12h | không |
| `CollaborationLayer` | THAY ĐƯỢC | — | ~2h | không |
| Việc 7 — nợ A6 + `duration-700` + CPU 1,6× + cổng dung lượng (prompt gốc) | SAU KHI SỬA | `viewer`/`editor` Việt hoá chuỗi, bỏ `duration-700` trên Canvas, giảm `maxFps`/system mỗi khung, cắt gói Pascal không dùng | ~20h (Việt hoá + CSS) + đo riêng cho CPU/dung lượng | không |

---

## 11. Đợt thi công — chia ≤ 4 cụm theo vùng tệp vendor ít chồng nhau

1. **Cụm hạ tầng chung** (làm trước, mọi cụm khác dùng lại): hạ tầng #1 (bảy trạng thái, `editor/src/state`),
   hạ tầng #5 (reviewed/confidence/source, `core/src/schema`), hạ tầng #30 (role RBAC, `core`+mọi `nodes/*`),
   Việt hoá (`unsupported-gpu-fallback.*`, `duration-700`). Vùng tệp: `core/src/schema/**`,
   `editor/src/state/**`, chuỗi UI rải khắp `editor`+`viewer`.
2. **Cụm tường/đo đạc** (`nodes/src/wall/**`, `nodes/src/tools/wall/**`, `core/src/schema/nodes/measurement.ts`,
   `core/src/registry/**`): #6,7,9,10,11,20,22,28 (WallGeometryEditor/PropertyInspector còn lại) +
   #58,59,61,65,66,67,68 (MeasurementTool còn lại).
3. **Cụm khung xem** (`viewer/src/systems/**`, `viewer/src/components/viewer/**`, `editor/src/components/panel-manager.tsx`,
   `editor/src/hooks/use-keyboard.ts`): #32,33,34,35,37,43,45,46,47 (ViewerShell/Viewer3D) +
   #31,98,99,100,101,102 (ExplodedView) + MobileViewer (LOD mobile).
4. **Cụm bảng/thư viện** (`editor/src/lib/floorplan/**`, `editor/src/components/zone-panel/**`,
   `editor/src/components/item-catalog/**`, `nodes/src/cabinet/**` kiểu tương tự cho batch):
   #71,73,74,75,77,78,86 (RoomAreaPanel còn lại) + #103,105,106,107 (FurnitureLibraryPanel còn lại) +
   #87,90,95,96 (OverlayComparison phần cần sửa vendor).

Phần lớn các dòng **THAY ĐƯỢC** (AppFront-side, dùng slot có sẵn: #13,21,24,36,57,60,62-64,72,76,79,80,
83-85,88,89,91-94,97,104,109, VersionVisualDiff, CollaborationLayer, screenshot.ts) không nằm trong
bốn cụm vendor trên — chúng là việc ở `src/components/pascal`/`src/lib/pascal`/`src/lib/export`, làm
song song với bất cứ cụm nào vì không chung tệp vendor.

`HistoryPanel` (#49-54, KHÔNG THAY ĐƯỢC) không vào đợt thi công vendor — chỉ cần nối nguồn đọc, làm
cùng lúc với bất kỳ cụm nào.
