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

## `src/lib/geometry/build3d.ts`

- **`build3DBoxes(geometry: Geometry, level: Level): Box3D[]`**
  - Đầu vào: Geometry tầng hiện tại.
  - Đầu ra: Danh sách các khối hình hộp chữ nhật để vẽ 3D (tường, lỗ hổng cho cửa). Tọa độ Z quy về mm từ cao độ tầng.

## `src/lib/rules/engine.ts`

- **`runSpatialRules(geometry: Geometry, level_id: string): Violation[]`**
  - Đầu vào: Geometry toàn tầng.
  - Đầu ra: Danh sách các vi phạm nghiệp vụ (`room-label`, `adjacency`, `exterior-window`).

## `src/store/commit.ts`

- **`commit(patchFn: (draft: SpatialProject) => void, label: string): { undo: () => void, label: string, timestamp: number }`**
  - Đầu vào: Hàm mutate dữ liệu không gian, nhãn thao tác tiếng Việt.
  - Tác dụng phụ: Ghi nhận lịch sử cho Zundo, trigger flash và toast UI.
