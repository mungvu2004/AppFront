# Domain Contracts (Pure Logic)

Tài liệu này liệt kê chữ ký và hợp đồng của các hàm thuần (pure functions) xử lý dữ liệu không gian, hình học và logic miền.

## `src/lib/scale.ts`

- **`computeScaleRatio(knownMm: number, measuredPx: number): number`**
  - Đầu vào: Khoảng cách thực tế (mm), khoảng cách đo được trên ảnh (px)
  - Đầu ra: Tỷ lệ (mm/px), làm tròn 2 chữ số.

- **`pxToMm(px: number, scaleRatioMmPerPx: number): number`**
  - Đầu vào: Kích thước pixel, tỷ lệ
  - Đầu ra: Kích thước (mm)

- **`mmToPx(mm: number, scaleRatioMmPerPx: number): number`**
  - Đầu vào: Kích thước (mm), tỷ lệ
  - Đầu ra: Kích thước pixel

## `src/lib/geometry/wall.ts`

- **`getWallLength(wall: Wall, p1: Point2D, p2: Point2D): number`**
  - Đầu ra: Chiều dài tường (đơn vị cùng với tọa độ, thường là mm).

- **`getWallNormal(p1: Point2D, p2: Point2D): { nx: number, ny: number }`**
  - Đầu ra: Vector pháp tuyến chuẩn hóa (độ dài 1).

- **`isExteriorWall(wall: Wall, allRooms: { vertices: string[] }[]): boolean`**
  - Đầu ra: Trả về `true` nếu tường chỉ thuộc 1 hoặc 0 phòng.

## `src/lib/geometry/area.ts`

- **`calculatePolygonArea(vertices: Point2D[]): number`**
  - Đầu vào: Đa giác liên tiếp.
  - Đầu ra: Diện tích (đơn vị bình phương). Dùng thuật toán Shoelace.

- **`formatAreaM2(areaM2: number): string`**
  - Đầu ra: Chuỗi diện tích, ví dụ `"248,60 m²"` (locale tiếng Việt).

## `src/lib/geometry/standardize.ts`

- **`standardizeThickness(rawThicknessMm: number): { original_mm: number, standardized: WallThickness }`**
  - Đầu vào: Bề dày tường AI dự đoán (mm).
  - Đầu ra: Làm tròn về `110`, `220`, `330`, hoặc `'CONCRETE_COLUMN'` theo ngưỡng định trước.

## `src/lib/three/build/`

Sinh hình khối 3D từ dữ liệu mặt bằng. Đơn vị trong cảnh là **mét**; quy đổi từ
mm đúng một lần, tại `scene.ts`. Mọi lưới mang `userData` trỏ về mã đối tượng.
Module `build3d.ts` cũ trong `src/lib/geometry/` đã bị xoá — nó chạy trên hệ kiểu
`src/types/spatial`, không ai import, và trùng mục đích với gói này.

- **`plan.ts`** — tầng thuần, **không import three**: `planCuts`, `planPanels`,
  `panelOutline`, `panelHoles`, `panelRects`, bề dày sàn và tấm cánh. Luồng chính
  và worker cùng đọc file này nên hai bên không thể lệch nhau.
- **`buildWallMesh(wall, { levelId, openings }): Mesh`** (`wall.ts`)
  - Đầu ra: Tim tường đùn theo bề dày và chiều cao, khoét cửa đi/cửa sổ.
- **`buildFloorSlab` · `buildCeiling` · `buildFloorMesh(input): Group`** (`floor.ts`)
  - Đầu ra: Sàn và trần dày 150 mm; `buildFloorMesh` gom cả tầng, nhóm mang tên
    theo mã tầng.
- **`mergeByMaterial(meshes, options): MergeResult`** (`merge.ts`)
  - Đầu ra: Gộp theo vật liệu, kèm bảng phạm vi đỉnh để tra ngược và tô sáng;
    hình học lặp lại dùng `InstancedMesh`.
- **`detailLevelAt(distanceM)` · `buildFloorLod(input): LOD`** (`lod.ts`)
  - Đầu ra: Ba mức chi tiết, ngưỡng 25 m và 60 m.
- **`BuildQueue` · `planWallChange(model, wallId)`** (`buildQueue.ts`, `build.worker.ts`)
  - Tác dụng: Dựng tăng dần trong worker, xếp hàng và huỷ yêu cầu cũ cùng mã đối
    tượng; worker trả mảng đệm chuyển giao được, không trả đối tượng Three.js.

## `src/domain/rules/`

Bộ luật QC. `registry.ts` giữ sổ luật (`Rule`, `RuleContext`, `RuleFinding`,
`Violation`) và các luật dựng sẵn; `runner.ts` chạy một lượt và chỉ chạy lại
những luật đã cũ đi. Mỗi nhóm tự đăng ký vào sổ bằng `registerXRules(registry)`.

- **`geometry/`** — 7 check hình học: chồng tường, đầu tường lơ lửng, phòng chưa
  khép, cánh cửa kẹt, lỗ mở chồng nhau, tường không có đỡ, thang lệch trục.
- **`function/`** — 7 check công năng và thoát nạn, đọc bảng `USAGE_REQUIREMENTS`.
  Thay thế `ROOM-HAS-DOOR` và `ROOM-MIN-AREA` dựng sẵn (tự tắt hai mã đó khi đăng ký).
- **`fitout/`** — 3 check nội thất: `ROOM-FURNITURE-MISMATCH` (đồ đạc trái công
  năng phòng, theo bảng `MISPLACED_FURNITURE`), `FIXTURE-OFF-WALL` (thiết bị vệ
  sinh / tủ bếp cách mặt tường quá 50 mm), `WINDOW-ON-INNER-WALL` (cửa sổ không
  nằm trên tường bao ngoài).
- **`healthScore.ts`** — quy danh sách vi phạm về một điểm sức khoẻ hồ sơ.

Nhóm `fitout` thay cho `src/lib/rules/engine.ts` cũ (đã xoá): module đó chạy trên
hệ kiểu `src/types/spatial`, không được nơi nào import, và chỉ biết hai tên phòng
viết cứng. Ở đây công năng phòng và loại đồ đạc đều là enum nên bảng phủ đủ mọi
trường hợp thay vì hai ngoại lệ.

## `src/store/commit.ts`

- **`commit(patchFn: (draft: SpatialProject) => void, label: string): { undo: () => void, label: string, timestamp: number }`**
  - Đầu vào: Hàm mutate dữ liệu không gian, nhãn thao tác tiếng Việt.
  - Tác dụng phụ: Ghi nhận lịch sử cho Zundo, trigger flash và toast UI.
