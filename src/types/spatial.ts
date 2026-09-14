/**
 * Hình dạng Spatial JSON như **đặc tả nghiên cứu** mô tả nó (Phần IV) — không
 * phải mô hình không gian mà ứng dụng chạy trên đó.
 *
 * ## Hai nửa của file này có số phận khác hẳn nhau
 *
 * Đo ngày 2026-09-14 bằng `grep -rn "types/spatial" src`:
 *
 * - **`WallThickness` là nửa đang sống.** Chín nơi nhập nó — `components/canvas`,
 *   `hooks/useWallThicknessLegend`, `lib/geometry/standardize`, và bốn màn QC.
 *   Đây là bốn giá trị độ dày sau chuẩn hoá của đặc tả nghiên cứu (Bước 3.3):
 *   110, 220, 330 mm, hoặc cột bê tông cốt thép.
 * - **Phần còn lại chỉ có đúng một nơi dùng:** `src/mocks/spatial.ts`, tức dữ
 *   liệu demo. `SpatialProject`, `Geometry`, `Wall`, `Door`, `Window`, `Room`,
 *   `Dimension`, `Point2D`, `Level`, `GlobalAnchor`, `ProjectMetadata` **không**
 *   được một màn, một hook hay một module `src/lib` nào nhập.
 *
 * Nói cách khác: hợp đồng của đặc tả nghiên cứu hiện chỉ định hình **dữ liệu
 * giả**. Mô hình thật của ứng dụng là `src/domain/spatial/types.ts`.
 *
 * ## Nó khác mô hình thật ở đâu
 *
 * | Ở đây (hợp đồng nghiên cứu) | `domain/spatial/types.ts` (mô hình thật) |
 * |---|---|
 * | `level_id`, `elevation_m`, `height_m` — **mét** | `id`, `elevationMm`, `heightMm` — **milimét** |
 * | `Wall.from`/`to` trỏ vào `Point2D` theo mã | `Wall.centreline: Segment` mang thẳng toạ độ |
 * | `thickness_mm` là bốn giá trị đóng | `thicknessMm: Millimetres`, số bất kỳ, cộng `kind` |
 * | `Door.position_t` trong `[0, 1]` | `Opening.offsetMm` tính từ đầu trục tường |
 * | `Window.elevation_m` | `Opening.sillHeightMm` |
 * | `Room.vertices` là mảng **mã** điểm | `Room.outline` là mảng **toạ độ** |
 * | `Furniture.type` trộn cả `door`/`window` | `Furniture.kind` tám nhóm, cửa là `Opening` riêng |
 * | không có mỏ neo → có `global_anchor` | không có khái niệm tương đương |
 *
 * ## Nếu bạn đang nối backend thật vào
 *
 * Chỗ chuyển đổi giữa hai hình dạng trên **chưa tồn tại**, và nó không nên nằm
 * trong một màn. Quy đổi mét ↔ milimét chỉ được đi qua
 * `src/domain/units/types.ts` (`metresToMillimetres`) — R-44. Phần kiểm hình
 * dạng của lượt trả về đã có: `src/api/schemas/spatial.ts`, viết theo mô hình
 * thật chứ không theo file này.
 *
 * Trạng thái mong muốn: `WallThickness` chuyển xuống `src/domain/walls`, phần
 * còn lại rời đi cùng `src/mocks/spatial.ts` khi màn thật thay hết chín màn
 * demo. Đừng thêm kiểu mới vào file này.
 */

export type ReviewState = 'pending' | 'approved' | 'rejected';

export interface BaseEntity {
  id: string;
  confidence?: number;
  review_state?: ReviewState;
}

export interface Point2D extends BaseEntity {
  x: number;
  y: number;
}

export type WallThickness = 110 | 220 | 330 | 'CONCRETE_COLUMN';

export interface Wall extends BaseEntity {
  from: string; // Point2D id
  to: string; // Point2D id
  thickness_mm: WallThickness;
}

export interface Door extends BaseEntity {
  wall_id: string;
  position_t: number; // 0 to 1 along the wall
  width_mm: number;
  height_mm: number;
  type: string;
}

export type FurnitureType =
  | 'door'
  | 'double_door'
  | 'window'
  | 'bed'
  | 'sofa'
  | 'dining_table'
  | 'toilet'
  | 'kitchen_sink';

export interface Furniture extends BaseEntity {
  type: FurnitureType;
  x: number;
  y: number;
  rotation_deg: number;
}

export interface Window extends BaseEntity {
  wall_id: string;
  position_t: number;
  width_mm: number;
  height_mm: number;
  elevation_m: number;
}

export interface Room extends BaseEntity {
  label: string;
  vertices: string[]; // array of Point2D ids
  area_m2: number;
}

export interface Dimension extends BaseEntity {
  p1: string; // Point2D id
  p2: string; // Point2D id
  value_mm: number;
}

export interface Geometry {
  vertices: Record<string, Point2D>;
  walls: Record<string, Wall>;
  doors: Record<string, Door>;
  windows: Record<string, Window>;
  furniture: Record<string, Furniture>;
  rooms: Record<string, Room>;
  dimensions: Record<string, Dimension>;
}

export interface Level {
  level_id: string;
  name: string;
  elevation_m: number;
  height_m: number;
}

export interface GlobalAnchor {
  axis_intersection: string; // e.g. "A-1"
  x_offset: number;
  y_offset: number;
}

export interface ProjectMetadata {
  scale_ratio_mm_per_px: number;
}

export interface SpatialProject {
  project_metadata: ProjectMetadata;
  levels: Level[];
  global_anchor: GlobalAnchor;
  geometry: Record<string, Geometry>; // key is level_id
}
