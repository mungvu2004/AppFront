# Mười màn của `src/screens/viewer` đối chiếu với Pascal — từng tính năng một

2026-09-28. Câu hỏi của người dùng: *"các thành phần trong editor của dự án đã dùng của Pascal
rồi thì sao không xoá cái editor hiện có đi, phần nào là riêng biệt của dự án thì tạo mới"*.

Đây là phép đo trả lời câu ấy. **109 tính năng**, mỗi dòng có bằng chứng **cả hai phía** —
đường dẫn:dòng bên AppFront và bên `vendor/pascal`, hoặc ghi rõ "grep → rỗng". Nhãn
**"không biết"** được dùng khi chưa đủ bằng chứng, và nó hợp lệ.

---

## 1. Con số

| Nhãn | Số tính năng | Nghĩa |
|---|---|---|
| **CÓ** | **15** | Pascal có thứ tương đương dùng được |
| **MỘT PHẦN** | **36** | có nhưng thiếu, khác cơ chế, hoặc mất một bất biến |
| **KHÔNG** | **49** | Pascal không có |
| **KHÔNG BIẾT** | **9** | chưa đủ bằng chứng |
| | **109** | |

Chia theo màn:

| Màn | CÓ | MỘT PHẦN | KHÔNG | KHÔNG BIẾT |
|---|---|---|---|---|
| **PropertyInspector** + **WallGeometryEditor** | **7** | 8 | 8 | 4 |
| ViewerShell + Viewer3D + HistoryPanel | 3 | 9 | 13 | 3 |
| MeasurementTool + RoomAreaPanel | 3 | 11 | 14 | 2 |
| OverlayComparison + ExplodedView + FurnitureLibraryPanel | **2** | 8 | 14 | 0 |

## 2. Danh sách xoá — trả lời thẳng

**Xoá được ngay, hôm nay: không màn nào.**

| Màn | Phán quyết | Vì sao |
|---|---|---|
| `PropertyInspector` | **ứng viên thật** — tầng tương tác | Pascal có đủ: giá trị lệch → gạch ngang (`multi-field-value.ts:9-40`), xem trước lúc kéo rồi mới ghi (`previewMultiNodeFields`), một phiên kéo = một bước hoàn tác (`runAsSingleSceneHistoryStep`). Nhưng tầng QC thì **không có gì**: duyệt, `confidence`, `source: ai\|human`, cảnh báo va chạm nêu tên |
| `WallGeometryEditor` | **ứng viên thật** — tầng tương tác | Pascal có kéo-một-bước, Esc trả về chỗ cũ, bắt điểm, 2D dựng từ cùng một `WallNode`. Thiếu: ô mở dịch theo tỉ lệ khi tường co giãn, bảng đỉnh x/y, chip đối chiếu bản vẽ AI |
| `MeasurementTool` | **không** | Pascal có phép toán (`measurement-geometry.ts`), không có đo vuông góc, đo chiều cao, bắt giao trục, và mất A6/A15 |
| `RoomAreaPanel` | **không** | Pascal chỉ có inspector **một** zone; không bảng liệt kê, không nhóm theo công năng, không tổng phụ, không thanh xếp chồng |
| `HistoryPanel` | **không** | xem mục 4 |
| `ViewerShell` · `Viewer3D` | **không** | không bảy trạng thái, không mặt phẳng cắt, không ViewCube, không tìm đối tượng không dấu, không registry phím tắt |
| `OverlayComparison` | **không** | `grep deviation\|tolerance\|mismatch` trên `vendor/pascal` → **rỗng**. Xem mục 3 |
| `ExplodedView` | **không** | Pascal có ba chế độ **rời rạc** với khoảng cách cố định `EXPLODED_GAP=5`; AppFront có thang **liên tục**, thẻ tầng, chỉ báo lệch trục |
| `FurnitureLibraryPanel` | **không — bài toán ngược nhau** | xem mục 3 |

## 3. Hai chỗ bất ngờ, và chúng đổi câu hỏi

### 3a. Có mã đáng xoá — nhưng là mã **chưa làm xong của AppFront**, không phải mã Pascal thay được

`OverlayComparison` (4 300 dòng) **hôm nay không đo gì cả**. Chính docblock của nó khai bốn khả
năng lõi vẫn là `supported: false` ngay trong `src/domain`:
`imageToModelTransform`, `deviationRegions`, `matchMetrics`, `confirmFloorMatch`
(`overlayComparisonGateway.ts:52-64`).

Cùng loại: chip đối chiếu bản vẽ gốc của `WallGeometryEditor` **luôn trả `null`** vì không tầng
nào giữ hình học gốc (`wallGeometryEditorGateway.ts:15-21`); đồng bộ hover của `RoomAreaPanel`
tự khai chưa nối (`useRoomAreaPanel.ts:34-40`).

**Nên câu hỏi "xoá gì" có một đáp án mà không ai hỏi tới:** thứ đáng cân nhắc xoá là **phần chưa
bao giờ chạy**, không phải phần Pascal làm được. Đó là quyết định riêng, và là của người dùng.

### 3b. `FurnitureLibraryPanel` và `item-catalog` giải hai bài toán **ngược nhau**

| | AppFront | Pascal |
|---|---|---|
| Ảnh xem trước | **"CẤM TUYỆT ĐỐI"** ảnh nhiều màu — phải đơn sắc, vì A1 (`furnitureLibraryPanelTypes.ts:100-104`) | `<img src={resolveCdnUrl(item.thumbnail)}>` — ảnh thật từ CDN |
| Việc nó làm | soát và **thay thế** đồ đạc do AI dò ra từ bản vẽ | **đặt** mô hình `.glb` thật vào cảnh |
| Cách dùng | kéo thẻ thả vào đối tượng đích | bấm để "vũ trang" công cụ đặt theo con trỏ |

Không phải một bên thiếu tính năng của bên kia. Chúng là hai màn khác nhau tình cờ cùng tên.

## 4. `HistoryPanel` — không ghép được, và lý do là kiến trúc

| | AppFront | Pascal |
|---|---|---|
| Đơn vị lưu | **lệnh có ngữ nghĩa**: `Command { actorId, description, changes: EntityChange[] }` | **ảnh chụp toàn cảnh**: `SceneSnapshot` (nodes + collections + materials + plugins) |
| Hoàn tác báo cho người dùng | **toast** (A8) | `grep toast` trên toàn `editor/src` → **rỗng**; chỉ gọi `markPerfAction('undo')` |
| Diff từng trường | có (`useHistoryPanel.model.ts:405-475`) | không — ảnh chụp không so trường được |
| Ai làm / loại việc | `edit`/`review`/`ai` | `provenance` của Pascal là **lai lịch nguồn dựng hình** (scan/IFC/SketchUp), không phải "ai đã duyệt" |

Ghép hai thứ này không phải "nối hai ngăn xếp" — là **dựng lại `HistoryStack` từ đầu trên nền
`zundo`**.

## 5. Bốn bất biến, và Pascal đứng ở đâu

| Bất biến | Pascal | Bằng chứng |
|---|---|---|
| **A5** — dấu "đã xác minh", `confidence`, `source` | **không tồn tại trong mô hình dữ liệu** | `core/src/schema/nodes/zone.ts:5-48` không có `reviewed` lẫn `confidence`; grep trên toàn `vendor/pascal` → rỗng |
| **A11** — bảy trạng thái, màn trắng là thất bại | **ngược lại** | `viewer/src/components/viewer/render-error.tsx:29-45` dựng `fallback={null}` — ra **màn trắng thật** |
| **A8** — hoàn tác kèm toast | **có hoàn tác, không có toast** | `grep sonner\|useToast\|toast\.` trên `editor/src` → rỗng |
| **A6** · **A15** | tiếng Anh, `toFixed` dấu chấm, dán đơn vị vào chuỗi | `editor/src/lib/measurements.ts:156,174`; `schedules.ts:293-297` |
| **A7** — tự lưu 800 ms, theo trường, về máy chủ, nói cho trình đọc màn hình | **khác cơ chế** | `use-auto-save.ts:9` — 1 000 ms, chụp **toàn cảnh**, ghi `localStorage` |

**Đính chính một câu tôi đã nói sai trong phiên:** tôi báo tự lưu của Pascal "khớp mạnh với A7".
Không khớp — bảng trên là lý do.

## 6. Hai chỗ Pascal **hơn** AppFront

Phép đo này không chỉ tìm chỗ Pascal thiếu.

1. **Kéo góc tường thì tường nối đi theo — Pascal có, AppFront thì không.**
   `nodes/src/wall/move-endpoint-tool.tsx:150-200` (`getLinkedWallSnapshots`,
   `getLinkedWallUpdates`) kéo theo mọi tường chung góc trong **cùng một bước lịch sử**, và có
   Alt để tách. Còn `wallGeometryEditorGateway.ts` chỉ gọi `createDragWallEndCommand` cho **một**
   tường.

   Đây là **quyết định 3A** mà người dùng đã chốt ngày 2026-09-18 — và nó **chưa được thi công
   bên AppFront**.

2. **Nửa sau của 3A — "mất dấu xác minh" — cũng chưa ai làm, ở cả hai bên.**
   `src/lib/commands/business/shared.ts:19-24` nói rõ *"Review metadata is preserved on an
   update"*: chỉ lúc **tạo mới** mới đặt `reviewed: false`. Tức quyết định 3A hiện **không có
   trong mã** dù mọi tài liệu nhắc tới nó như một hành vi đang chạy.

3. **2D dựng từ cùng một nguồn.** `nodes/src/wall/floorplan.ts:282` dựng mặt bằng trực tiếp từ
   chính `WallNode` — chặt hơn cách AppFront đồng bộ hai chiều.

## 7. Kết luận

**Không màn nào xoá được hôm nay.** Hai màn là ứng viên thật — `PropertyInspector` và
`WallGeometryEditor` — nhưng chỉ ở **tầng tương tác**; tầng nghiệp vụ QC (A5, A9, ràng buộc
chiều cao–ô mở, ô mở dịch theo tỉ lệ) phải viết mới trên nền Pascal.

Nói cách khác: câu *"Pascal đã làm rồi thì xoá cái cũ đi"* đúng cho **15/109 tính năng**. 49
tính năng Pascal **không có**, và 36 tính năng nữa chỉ có một phần hoặc mất một bất biến.

Việc đúng tiếp theo **không phải xoá**, mà là ba việc theo thứ tự: dựng màn xem Pascal cho chạy
thật → thi công 3A (Pascal đã có sẵn, AppFront thì chưa) → rồi mới bàn từng màn một, mỗi lần một
commit kèm `pnpm verify`.
