/**
 * Đồ trang trí sinh ra (J10, bộ "an toàn"): đèn bàn trên tủ đầu giường, thảm dưới nhóm sofa,
 * thảm dưới giường, thảm chân trước bồn tắm/vòi sen. Chỉ là bản ghi `Furniture` trong bộ
 * nhớ, id `DRESS-<vai>-<id neo>`, không bao giờ lưu (toSpatial bỏ qua).
 *
 * Hàm thuần của (đồ thị, phong cách): phòng theo id, quy tắc theo thứ tự cố định, đồ theo
 * id. Mỗi món phải nằm trong phòng (lùi 100 mm), không chồng đồ khác (cách 50 mm — trừ món
 * "chủ" nó nằm trên/dưới) và không chồng vùng mở cửa; không đạt thì bỏ, không dời đồ thật.
 */

import type { Furniture, FurnitureId, FurnitureVariant, Point, Room, SpatialGraph } from '@/domain/spatial/types';

import { CATALOG_MODELS, VARIANT_MODEL } from './furnitureCatalog';
import { doorSwingRects, rectInsidePolygon, rectOfFurniture, rectsOverlap, type Rect } from './placement';
import { roleOf, type FurnitureRole } from './sceneVariety';
import type { SceneStyle } from './sceneStyles';

const ROOM_INSET_MM = 100;
const FURNITURE_GAP_MM = 50;
/** Thảm thử cỡ đầy đủ rồi 80% (phòng hẹp). */
const RUG_SCALES = [1, 0.8] as const;
/** Thảm phòng khách 2000 × 1400, mép sau luồn 300 mm dưới mặt trước sofa. */
const LIVING_RUG = { long: 2000, deep: 1400, underSofa: 300 } as const;
/** Thảm giường: rộng hơn giường 600, sâu 1400, phủ 2/3 phía chân giường. */
const BED_RUG = { extraWidth: 600, deep: 1400 } as const;
const BATH_MAT = { long: 700, deep: 450 } as const;
const NIGHTSTAND_HEIGHT_MM = 480;
/** Mặt bằng đèn bàn khi catalog thiếu mô hình (mm). */
const LAMP_FALLBACK_MM = 300;

const RUG_ROLES: ReadonlySet<FurnitureRole> = new Set(['rug', 'roundRug']);
const SOFA_GROUP_ROLES: ReadonlySet<FurnitureRole> = new Set(['sofa', 'armchair', 'coffeeTable']);
const BED_ROLES: ReadonlySet<FurnitureRole> = new Set(['doubleBed', 'singleBed']);
const WET_ROLES: ReadonlySet<FurnitureRole> = new Set(['shower', 'bathtub']);

const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const wrapDeg = (deg: number): number => {
  const wrapped = Math.round((((deg % 360) + 360) % 360) * 100) / 100;
  return wrapped === 360 ? 0 : wrapped;
};

/** Trục riêng của món: x (theo `w`) và y (theo `d`, mặt trước). */
const axesOf = (rotationDeg: number): readonly [Point, Point] => {
  const t = (rotationDeg * Math.PI) / 180;
  return [
    { x: Math.cos(t), y: Math.sin(t) },
    { x: -Math.sin(t), y: Math.cos(t) },
  ];
};

/**
 * Hình đặt theo khung của món chủ: tâm = tâm chủ + u·x + v·y, cỡ `sizeX × sizeY` theo trục
 * của chủ. Cạnh dài luôn là `w` (xoay thêm 90° nếu cần) — mô hình thảm dài theo x và
 * toPascal co đều, đặt ngược sẽ ra thảm bé.
 */
const rectAt = (host: Rect, u: number, v: number, sizeX: number, sizeY: number): Rect => {
  const [ex, ey] = axesOf(host.rotationDeg);
  const cx = Math.round(host.cx + ex.x * u + ey.x * v);
  const cy = Math.round(host.cy + ex.y * u + ey.y * v);
  const w = Math.round(sizeX);
  const d = Math.round(sizeY);
  return w >= d
    ? { cx, cy, w, d, rotationDeg: wrapDeg(host.rotationDeg) }
    : { cx, cy, w: d, d: w, rotationDeg: wrapDeg(host.rotationDeg + 90) };
};

const distanceToOutline = (p: Point, outline: readonly Point[]): number =>
  Math.min(
    ...outline.map((a, i) => {
      const b = outline[(i + 1) % outline.length] as Point;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }),
  );

/**
 * Phía "ra phòng" của món dọc trục riêng `axis` (0 = x, 1 = y): đầu cách mép phòng xa hơn
 * (lưng sofa, đầu giường tựa tường). Bằng nhau thì phía +, như mặt trước +y của K1.
 */
const openSideOf = (host: Rect, axis: 0 | 1, outline: readonly Point[]): 1 | -1 => {
  const e = axesOf(host.rotationDeg)[axis];
  const half = (axis === 0 ? host.w : host.d) / 2;
  const end = (sign: number): Point => ({ x: host.cx + e.x * half * sign, y: host.cy + e.y * half * sign });
  return distanceToOutline(end(-1), outline) > distanceToOutline(end(1), outline) ? -1 : 1;
};

const generatedOf = (
  id: string,
  room: Room,
  rect: Rect,
  variant: FurnitureVariant,
  extra: Pick<Furniture, 'liftMm'>,
): Furniture => ({
  id: id as FurnitureId,
  levelId: room.levelId,
  roomId: room.id,
  kind: 'other',
  centre: { x: rect.cx, y: rect.cy },
  boundingBox: {
    min: { x: rect.cx - rect.w / 2, y: rect.cy - rect.d / 2 },
    max: { x: rect.cx + rect.w / 2, y: rect.cy + rect.d / 2 },
  },
  rotationDeg: rect.rotationDeg,
  variant,
  ...extra,
  source: 'ai',
  reviewed: false,
  confidence: 1,
});

/** Các món trang trí của cả đồ thị; `graph.furniture` đã gồm đồ tự bày (sceneFurnish). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `style` giữ theo J10; màu đồ do itemSlotsOf lo
export const dressingOf = (graph: SpatialGraph, _style: SceneStyle): readonly Furniture[] => {
  const out: Furniture[] = [];
  const placed = graph.furniture.map((f) => ({ id: f.id as string, levelId: f.levelId, rect: rectOfFurniture(f) }));

  for (const room of [...graph.rooms].sort(byId)) {
    const swings = doorSwingRects(graph, room.levelId);
    const inRoom = graph.furniture
      .filter((f) => f.roomId === room.id)
      .sort(byId)
      .map((f) => ({ f, rect: rectOfFurniture(f), role: roleOf(f, room.usage) }));
    const withRole = (roles: ReadonlySet<FurnitureRole>) => inRoom.filter((item) => roles.has(item.role));
    const hasRug = withRole(RUG_ROLES).length > 0;

    /** Lấy hình hợp lệ đầu tiên trong `candidates`; `hosts` = món được phép nằm chồng. */
    const tryPlace = (
      id: string,
      candidates: readonly Rect[],
      hosts: ReadonlySet<string>,
      variant: FurnitureVariant,
      extra: Pick<Furniture, 'liftMm'> = {},
    ): boolean => {
      const rect = candidates.find(
        (r) =>
          rectInsidePolygon(r, room.outline, ROOM_INSET_MM) &&
          !swings.some((s) => rectsOverlap(r, s)) &&
          !placed.some(
            (p) => p.levelId === room.levelId && !hosts.has(p.id) && rectsOverlap(r, p.rect, FURNITURE_GAP_MM),
          ),
      );
      if (rect === undefined) return false;
      out.push(generatedOf(id, room, rect, variant, extra));
      placed.push({ id, levelId: room.levelId, rect });
      return true;
    };

    // (1) Đèn bàn giữa mặt tủ đầu giường phòng ngủ, cao bằng tủ; cỡ mô hình, không vượt mặt tủ.
    if (room.usage === 'bedroom') {
      const lamp = CATALOG_MODELS[VARIANT_MODEL.tableLamp?.folder ?? '']?.dimensions;
      const lampW = lamp === undefined ? LAMP_FALLBACK_MM : lamp[0] * 1000;
      const lampD = lamp === undefined ? LAMP_FALLBACK_MM : lamp[2] * 1000;
      for (const { f, rect } of inRoom.filter((item) => item.role === 'nightstand')) {
        tryPlace(
          `DRESS-tableLamp-${f.id}`,
          [rectAt(rect, 0, 0, Math.min(lampW, rect.w), Math.min(lampD, rect.d))],
          new Set([f.id]),
          'tableLamp',
          { liftMm: f.heightMm ?? NIGHTSTAND_HEIGHT_MM },
        );
      }
    }

    // (2) Một thảm dưới nhóm sofa: dài theo sofa, mép sau luồn dưới mặt trước, phủ bàn trà.
    if (room.usage === 'livingRoom' && !hasRug) {
      const group = withRole(SOFA_GROUP_ROLES);
      const hosts = new Set<string>(group.map((item) => item.f.id));
      for (const { rect } of group.filter((item) => item.role === 'sofa')) {
        const depthAxis = rect.w >= rect.d ? 1 : 0;
        const depth = depthAxis === 1 ? rect.d : rect.w;
        const front = openSideOf(rect, depthAxis, room.outline);
        const candidates = RUG_SCALES.map((k) => {
          const long = LIVING_RUG.long * k;
          const deep = LIVING_RUG.deep * k;
          const offset = front * (depth / 2 - LIVING_RUG.underSofa + deep / 2);
          return depthAxis === 1 ? rectAt(rect, 0, offset, long, deep) : rectAt(rect, offset, 0, deep, long);
        });
        if (tryPlace(`DRESS-rug-${room.id}`, candidates, hosts, 'rug')) break;
      }
    }

    // (3) Thảm dưới 2/3 phía chân mỗi giường (đầu giường = đầu gần mép phòng hơn).
    if (room.usage === 'bedroom' && !hasRug) {
      for (const { f, rect } of withRole(BED_ROLES)) {
        const lengthAxis = rect.d >= rect.w ? 1 : 0;
        const length = lengthAxis === 1 ? rect.d : rect.w;
        const width = lengthAxis === 1 ? rect.w : rect.d;
        const foot = openSideOf(rect, lengthAxis, room.outline);
        const candidates = RUG_SCALES.map((k) => {
          const across = (width + BED_RUG.extraWidth) * k;
          const deep = BED_RUG.deep * k;
          const offset = foot * (-length / 2 + length / 3 + deep / 2);
          return lengthAxis === 1 ? rectAt(rect, 0, offset, across, deep) : rectAt(rect, offset, 0, deep, across);
        });
        tryPlace(`DRESS-rug-${f.id}`, candidates, new Set([f.id]), 'rug');
      }
    }

    // (4) Thảm chân sát mặt thoáng nhất của vòi sen/bồn tắm (phía ra phòng).
    for (const { f, rect } of withRole(WET_ROLES)) {
      const faces = (
        [
          [1, 1],
          [1, -1],
          [0, 1],
          [0, -1],
        ] as const
      ).map(([axis, sign], order) => {
        const reach = sign * ((axis === 1 ? rect.d : rect.w) / 2 + BATH_MAT.deep / 2);
        const mat =
          axis === 1
            ? rectAt(rect, 0, reach, BATH_MAT.long, BATH_MAT.deep)
            : rectAt(rect, reach, 0, BATH_MAT.deep, BATH_MAT.long);
        return { mat, order, room: distanceToOutline({ x: mat.cx, y: mat.cy }, room.outline) };
      });
      // Xa mép phòng trước; bằng nhau giữ thứ tự +y, −y, +x, −x.
      faces.sort((a, b) => b.room - a.room || a.order - b.order);
      tryPlace(
        `DRESS-bathMat-${f.id}`,
        faces.map((face) => face.mat),
        new Set([f.id]),
        'rug',
      );
    }
  }

  return out;
};
