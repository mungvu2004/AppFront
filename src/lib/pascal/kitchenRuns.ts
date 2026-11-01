/**
 * Hộp YOLO quanh cả dãy bếp chữ L/U hay quầy bar (3,1 × 1,8 m) không dựng thành một khối đặc:
 * thay bằng các dãy tủ sâu 600 mm dọc những mép hộp tựa tường; không mép nào tựa tường thì một
 * đảo bếp sâu 900 mm giữa hộp.
 *
 * Lượt về: món gốc GIỮ NGUYÊN id + hộp bao (bên dựng ẩn node của nó bằng `visible: false`, như
 * thang dò nhầm — lượt về không đọc `visible`), còn các dãy là đồ sinh ra `DRESS-kitchenRun-…`
 * không `roomId` → không bao giờ được nhận nuôi hay lưu (`isGeneratedNodeId`). Lưu không tạo,
 * không xoá, không sửa đồ đạc nào ở máy chủ.
 */

import type { Furniture, FurnitureId, Wall } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { furnitureFacingDeg } from './placement';
import { GENERATED_DRESS_PREFIX } from './sceneDressing';

/** Tủ bếp có cạnh ngắn hơn chừng này (mm) đã là một dãy thẳng, giữ nguyên. */
const RUN_HOST_MIN_SHORT_MM = 900;
const RUN_DEPTH_MM = 600;
const ISLAND_DEPTH_MM = 900;
/** Mép hộp cách mặt tường tối đa chừng này (mm) thì coi là tựa tường. */
const WALL_TOUCH_MM = 300;
/** Mẩu dãy ngắn hơn chừng này (mm) bỏ đi. */
const MIN_RUN_LENGTH_MM = 300;

export const KITCHEN_RUN_ID_PREFIX = `${GENERATED_DRESS_PREFIX}kitchenRun-`;

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tủ bếp dò được (không variant, không mẫu người dùng chọn) quá sâu để là một dãy.
 * Dãy `baseRun`/`upperRun` của bản vẽ người vẽ đi đường V1 (`lShapedRunArms`).
 */
// ponytail: chỉ hộp không xoay; mở rộng khi bản dò cho tủ bếp xoay.
export const isKitchenRunHost = (f: Furniture): boolean => {
  const { min, max } = f.boundingBox;
  return (
    f.kind === 'kitchenCabinet' &&
    f.variant === undefined &&
    f.model === undefined &&
    ((f.rotationDeg % 360) + 360) % 360 === 0 &&
    Math.min(max.x - min.x, max.y - min.y) > RUN_HOST_MIN_SHORT_MM
  );
};

/** Mép hộp nào tựa một tường thẳng song song trục (cùng tầng, chồng lên nhau theo chiều dọc mép). */
const touchingSides = (f: Furniture, walls: readonly Wall[]): ReadonlySet<Side> => {
  const { min, max } = f.boundingBox;
  const sides = new Set<Side>();
  for (const wall of walls) {
    if (wall.levelId !== f.levelId || wall.curveOffsetMm) continue;
    const { start: a, end: b } = wall.centreline;
    const reach = wall.thicknessMm / 2 + WALL_TOUCH_MM;
    if (Math.abs(a.y - b.y) < 1) {
      if (Math.min(Math.max(a.x, b.x), max.x) - Math.max(Math.min(a.x, b.x), min.x) <= 0) continue;
      if (Math.abs(min.y - a.y) <= reach) sides.add('top');
      if (Math.abs(max.y - a.y) <= reach) sides.add('bottom');
    } else if (Math.abs(a.x - b.x) < 1) {
      if (Math.min(Math.max(a.y, b.y), max.y) - Math.max(Math.min(a.y, b.y), min.y) <= 0) continue;
      if (Math.abs(min.x - a.x) <= reach) sides.add('left');
      if (Math.abs(max.x - a.x) <= reach) sides.add('right');
    }
  }
  return sides;
};

interface Run {
  readonly key: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** Hướng mặt trước (vào phòng). */
  readonly inward: { readonly x: number; readonly y: number };
}

const runsOf = (f: Furniture, sides: ReadonlySet<Side>): readonly Run[] => {
  const { min, max } = f.boundingBox;
  const w = max.x - min.x;
  const h = max.y - min.y;
  if (sides.size === 0) {
    const half = Math.min(ISLAND_DEPTH_MM, Math.min(w, h)) / 2;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    return w >= h
      ? [{ key: 'island', minX: min.x, maxX: max.x, minY: cy - half, maxY: cy + half, inward: { x: 0, y: 1 } }]
      : [{ key: 'island', minX: cx - half, maxX: cx + half, minY: min.y, maxY: max.y, inward: { x: 1, y: 0 } }];
  }
  const d = Math.min(RUN_DEPTH_MM, Math.min(w, h) / 2);
  // Dãy theo mép ngang lấy trọn góc; dãy theo mép đứng chạy phần còn lại, không chồng lên.
  const y0 = min.y + (sides.has('top') ? d : 0);
  const y1 = max.y - (sides.has('bottom') ? d : 0);
  const all: Run[] = [
    { key: 'top', minX: min.x, maxX: max.x, minY: min.y, maxY: min.y + d, inward: { x: 0, y: 1 } },
    { key: 'bottom', minX: min.x, maxX: max.x, minY: max.y - d, maxY: max.y, inward: { x: 0, y: -1 } },
    { key: 'left', minX: min.x, maxX: min.x + d, minY: y0, maxY: y1, inward: { x: 1, y: 0 } },
    { key: 'right', minX: max.x - d, maxX: max.x, minY: y0, maxY: y1, inward: { x: -1, y: 0 } },
  ];
  return all.filter((r) => sides.has(r.key as Side));
};

/** Một dãy thành đồ sinh ra: khung riêng dài theo x, sâu theo y, mặt trước quay vào phòng. */
const runFurnitureOf = (host: Furniture, run: Run): Furniture => {
  const alongX = run.inward.y !== 0;
  const length = alongX ? run.maxX - run.minX : run.maxY - run.minY;
  const depth = alongX ? run.maxY - run.minY : run.maxX - run.minX;
  const cx = (run.minX + run.maxX) / 2;
  const cy = (run.minY + run.maxY) / 2;
  // Không `roomId` → không bao giờ được nhận nuôi hay lưu (như nhánh V1 `lShapedRunArms`).
  const rest = Object.fromEntries(Object.entries(host).filter(([key]) => key !== 'roomId')) as Omit<Furniture, 'roomId'>;
  return {
    ...rest,
    id: `${KITCHEN_RUN_ID_PREFIX}${host.id}-${run.key}` as FurnitureId,
    centre: { x: millimetres(cx), y: millimetres(cy) },
    boundingBox: {
      min: { x: millimetres(cx - length / 2), y: millimetres(cy - depth / 2) },
      max: { x: millimetres(cx + length / 2), y: millimetres(cy + depth / 2) },
    },
    rotationDeg: furnitureFacingDeg(run.inward) as Furniture['rotationDeg'],
  };
};

/**
 * Lượt trước của toPascal: giữ mọi món (kể cả món gốc, để lượt về không thấy xoá) và chèn
 * ngay sau mỗi hộp `isKitchenRunHost` các dãy tủ sinh ra thay nó. Bên dựng ẩn node món gốc.
 */
export const expandKitchenRuns = (furniture: readonly Furniture[], walls: readonly Wall[]): Furniture[] =>
  furniture.flatMap((f) => {
    if (!isKitchenRunHost(f)) return [f];
    const runs = runsOf(f, touchingSides(f, walls))
      .map((run) => runFurnitureOf(f, run))
      .filter((r) => r.boundingBox.max.x - r.boundingBox.min.x >= MIN_RUN_LENGTH_MM);
    return [f, ...runs];
  });
