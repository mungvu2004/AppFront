/**
 * Hình dạng cảnh Pascal, **khai lại bằng tay** ở phía AppFront.
 *
 * ## Vì sao không nhập kiểu từ chính gói Pascal
 *
 * Lược đồ thật của Pascal là zod (`@pascal-app/core/schema`): 48 loại node,
 * mỗi loại vài chục trường, và `AnyNode` là hợp của cả 48. Nhập kiểu suy ra
 * từ hợp đó vào đây kéo theo hai thứ AppFront không muốn: một phụ thuộc kiểu
 * lên gói ngoài ở tầng `src/lib` (cổng nhập của `.eslintrc.cjs` chỉ cho
 * `import type`, và ngay cả thế vẫn buộc gói phải cài mới biên dịch được), và
 * một bề mặt 48 loại trong khi bộ đổi dữ liệu chỉ viết **tám**.
 *
 * File này vì thế khai đúng phần AppFront **viết ra hoặc đọc vào**, theo đúng
 * tên trường của lược đồ Pascal 1.0.0. Trường nào Pascal có giá trị mặc định
 * thì ở đây để trống — `zod` điền lúc `parse`, và bỏ trống giữ tệp cảnh nhỏ.
 *
 * ## Quy ước đơn vị và trục — chỗ dễ sai nhất
 *
 * | AppFront | Pascal |
 * |---|---|
 * | mọi độ dài là **milimét** | mọi độ dài là **mét** |
 * | mặt bằng là `(x, y)` | mặt bằng là `[x, z]`, `y` hướng lên |
 * | góc là **độ**, ngược chiều kim đồng hồ từ trục `+x` | góc là **radian** quanh trục `y`, **đảo dấu** |
 *
 * Dấu âm của góc không phải tuỳ tiện: `wall-system.js:828` dựng tường bằng
 * `setFromAxisAngle(yAxis, -atan2(end.z - start.z, end.x - start.x))`, nên một
 * góc mặt bằng θ của AppFront là `-θ` trong hệ của Pascal. Đồ đạc đi theo
 * đúng quy ước ấy để hai thứ không quay ngược nhau.
 *
 * ## Toạ độ của cửa đi và cửa sổ
 *
 * Ô mở là **con của tường**, và `position` của nó đo trong hệ của chính tường:
 * `[u, v, w]` với `u` là khoảng cách từ **đầu** trục tường (mesh tường đặt gốc
 * tại `start` — `wall-system.js:827`), `v` là chiều cao **tâm** ô mở so với
 * sàn tầng (`wall-system.js:1215` đọc `position[1] - height / 2` làm mép
 * dưới), `w` là độ lệch khỏi mặt phẳng giữa tường. AppFront lưu `offsetMm` là
 * mép **trái** và `sillHeightMm` là mép **dưới**, nên hai bên lệch nhau đúng
 * một nửa kích thước — `toPascal.ts` là nơi duy nhất quy đổi.
 */

import type { DataSource } from '@/domain/spatial/types';

/** Id một node trong cảnh Pascal, ví dụ `wall_W-WALL0010`. */
export type PascalNodeId = string;

/** Toạ độ mặt bằng của Pascal: `[x, z]`, mét. */
export type PascalPoint2 = readonly [number, number];

/** Toạ độ ba chiều của Pascal: `[x, y, z]`, mét, `y` hướng lên. */
export type PascalVec3 = readonly [number, number, number];

/**
 * Siêu dữ liệu của AppFront gắn vào node Pascal.
 *
 * Lược đồ Pascal khai `metadata` là "túi phẳng các thứ thêm của từng node"
 * (`schema/base.js`), và đây là đúng thứ nó dùng để chứa: những trường
 * AppFront có mà Pascal không có chỗ lưu — dấu xác minh, diện tích khai tay,
 * công năng phòng, loại tường.
 *
 * **Không có trường `id` ở đây, và đó là cố ý.** Id AppFront đã nằm trong
 * chính id của node (`wall_W-WALL0010`); chép nó thêm một lần nữa là tạo ra
 * hai nguồn sự thật có thể cãi nhau, và lượt về sẽ phải chọn một trong hai.
 */
export interface AppFrontOrigin {
  /** Độ tin cậy `[0, 1]` của bản ghi gốc. */
  readonly confidence: number;
  /** Dữ liệu đến từ mô hình AI hay từ người. */
  readonly source: DataSource;
  /**
   * Dấu "đã xác minh" của bản ghi gốc.
   *
   * **A5 sống hay chết ở đây.** Cờ này chỉ được tin khi id của node dịch ngược
   * được thành một id AppFront hợp lệ — tức node đó do chính AppFront viết ra.
   * Node Pascal tự đẻ mang id nanoid, không qua được phép kiểm, và luôn quay
   * về `reviewed: false`. Xem `toSpatial.ts`.
   */
  readonly reviewed: boolean;
  /** Trường riêng của từng loại mà lược đồ Pascal không có chỗ chứa. */
  readonly fields?: Readonly<Record<string, unknown>>;
}

/** Túi siêu dữ liệu của một node; `appfront` là phần AppFront sở hữu. */
export interface PascalMetadata {
  readonly appfront?: AppFrontOrigin;
  readonly [key: string]: unknown;
}

/** Phần mọi node Pascal đều có (`schema/base.js`). */
interface PascalNodeCommon {
  readonly object: 'node';
  readonly id: PascalNodeId;
  readonly parentId: PascalNodeId | null;
  readonly name?: string;
  readonly metadata?: PascalMetadata;
}

/** Khu đất — gốc của cây cảnh. */
export interface PascalSiteNode extends PascalNodeCommon {
  readonly type: 'site';
  readonly children: readonly PascalNodeId[];
}

/** Công trình; con của khu đất, cha của các tầng. */
export interface PascalBuildingNode extends PascalNodeCommon {
  readonly type: 'building';
  readonly children: readonly PascalNodeId[];
}

/**
 * Tầng.
 *
 * `level` là số thứ tự để xếp chồng, `height` là chiều cao tầng (m), và
 * `baseElevation` là **phần cộng thêm** vào vị trí xếp chồng tính được chứ
 * không phải cao độ tuyệt đối (`services/storey.js:41-73`). `toPascal.ts`
 * tính phần cộng thêm ấy sao cho cao độ ra đúng bằng cao độ AppFront lưu.
 */
export interface PascalLevelNode extends PascalNodeCommon {
  readonly type: 'level';
  readonly children: readonly PascalNodeId[];
  readonly level: number;
  readonly baseElevation: number;
  readonly height: number;
}

/** Tường; con của tầng, cha của các ô mở. */
export interface PascalWallNode extends PascalNodeCommon {
  readonly type: 'wall';
  readonly children: readonly PascalNodeId[];
  readonly start: PascalPoint2;
  readonly end: PascalPoint2;
  readonly thickness: number;
  readonly height: number;
}

/** Cửa đi; con của tường, `position` trong hệ toạ độ của tường. */
export interface PascalDoorNode extends PascalNodeCommon {
  readonly type: 'door';
  readonly wallId: PascalNodeId;
  readonly position: PascalVec3;
  readonly width: number;
  readonly height: number;
  readonly leafCount?: 1 | 2;
  readonly hingesSide?: 'left' | 'right';
  readonly doorType?: 'hinged' | 'sliding';
}

/** Cửa sổ; con của tường, `position` trong hệ toạ độ của tường. */
export interface PascalWindowNode extends PascalNodeCommon {
  readonly type: 'window';
  readonly wallId: PascalNodeId;
  readonly position: PascalVec3;
  readonly width: number;
  readonly height: number;
}

/** Phòng. Pascal gọi là `zone`; `spaceRole: 'room'` mới là phòng kiến trúc. */
export interface PascalZoneNode extends PascalNodeCommon {
  readonly type: 'zone';
  readonly name: string;
  readonly polygon: readonly PascalPoint2[];
  readonly spaceRole: 'room';
  readonly boundaryWallIds: readonly PascalNodeId[];
}

/**
 * Đồ đạc. Pascal gọi là `item`, và `asset` là trường **bắt buộc**.
 *
 * `asset.src` phải qua được `AssetUrl` (`schema/asset-url.js`), và
 * `asset://…` là dạng nội bộ mà lược đồ nhận — AppFront không có mô hình GLB
 * cho đồ đạc nên nó dùng đúng dạng ấy làm chỗ giữ chỗ.
 */
export interface PascalItemNode extends PascalNodeCommon {
  readonly type: 'item';
  readonly position: PascalVec3;
  readonly rotation: PascalVec3;
  readonly asset: {
    readonly id: string;
    readonly category: string;
    readonly name: string;
    readonly thumbnail: string;
    readonly src: string;
    readonly dimensions: PascalVec3;
  };
}

/** Một node bất kỳ trong số tám loại AppFront viết ra. */
export type PascalNode =
  | PascalSiteNode
  | PascalBuildingNode
  | PascalLevelNode
  | PascalWallNode
  | PascalDoorNode
  | PascalWindowNode
  | PascalZoneNode
  | PascalItemNode;

/** Loại node AppFront viết ra, đọc từ chính hợp trên. */
export type PascalNodeType = PascalNode['type'];

/**
 * Cảnh Pascal như tệp JSON của nó: bảng node phẳng cộng danh sách gốc.
 *
 * Đây đúng là hình dạng `{ nodes, rootNodeIds }` mà `validateBuildJson` và
 * `setScene` của Pascal nhận (`core/dist/validation/validate-build-json.d.ts`).
 */
export interface PascalScene {
  readonly nodes: Readonly<Record<PascalNodeId, PascalNode>>;
  readonly rootNodeIds: readonly PascalNodeId[];
}

/** Một đối tượng AppFront không chuyển được, kèm lý do đọc được bằng tiếng Việt. */
export interface SkippedEntity {
  /** Id phía AppFront. */
  readonly id: string;
  /** Loại đối tượng, bằng tiếng Việt. */
  readonly kind: string;
  /** Vì sao nó không sang Pascal được. Một câu, chữ thường, kiểu câu (A6). */
  readonly reason: string;
}

/** Kết quả một lượt đổi AppFront → Pascal. */
export interface PascalSceneResult {
  readonly scene: PascalScene;
  /** Mọi đối tượng bị bỏ qua, theo thứ tự của đồ thị. Không bao giờ là `null`. */
  readonly skipped: readonly SkippedEntity[];
}
