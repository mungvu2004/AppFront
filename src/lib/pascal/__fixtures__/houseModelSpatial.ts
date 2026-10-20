/**
 * F1 — căn hộ màn đăng nhập (`houseModel.json`) đổi sang thân N15 trên dây.
 *
 * Cổng TS của `qa-results/fe3d-inv2/A2/convert.mjs`, sửa một chỗ: hướng đồ đạc
 * lấy từ `FACING_TURN` của lớp trình diễn chứ không tra bảng tay (bảng cũ lệch
 * 180° cho đông/tây). Pascal quay `yaw = −rotationDeg`, nên
 * `rotationDeg = mod360(round(−FACING_TURN·180/π))`: đông 270, tây 90.
 *
 * `ext: false` chỉ phát những khoá schema hôm nay nhận; `ext: true` thêm
 * `finish`/`variant`/`heightMm`/`liftMm` (I1) cho lúc schema đọc được chúng.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { FACING_TURN } from '@/lib/three/present/placement';

import type { WireDocument, WireEntity } from './index';

/**
 * Bản vẽ màn đăng nhập, đọc bằng `fs` chứ không `import`: tầng lib không được
 * import screens (luật tầng ESLint), mà bản vẽ chỉ có một nguồn.
 */
export const house = JSON.parse(
  readFileSync(new URL('../../../screens/auth/AuthScreen/houseModel.json', import.meta.url), 'utf8'),
) as {
  levels: readonly { heightMm: number }[];
  walls: unknown;
  openings: unknown;
  rooms: readonly { id: string }[];
  furniture: readonly { id: string; facing: string }[];
};

/** Mã ổn định dạng W4 `<P>-[0-9A-Z]{25}` từ sha1 của một khoá nguồn. */
export const stableId = (prefix: string, key: string): string =>
  `${prefix}-${BigInt(`0x${createHash('sha1').update(key).digest('hex')}`)
    .toString(36)
    .toUpperCase()
    .padStart(25, '0')
    .slice(0, 25)}`;

export const META = { confidence: 1, reviewed: false, source: 'human' } as const;

type Pt = readonly [number, number];

/** Diện tích đa giác (mm) ra m², hai chữ số lẻ. */
export const areaM2 = (outline: readonly Pt[]): number =>
  Math.round(
    (Math.abs(
      outline.reduce((sum, a, i) => {
        const b = outline[(i + 1) % outline.length] ?? a;
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) /
      2e6) *
      100,
  ) / 100;

const mod360 = (deg: number): number => ((deg % 360) + 360) % 360;

const NAMES: Readonly<Record<string, string>> = {
  'R-BATH-1': 'Phòng tắm 1',
  'R-BATH-2': 'Phòng tắm 2',
  'R-BALCONY': 'Ban công',
  'R-BED-1': 'Phòng ngủ chính',
  'R-BED-2': 'Phòng ngủ 2',
  'R-HALL': 'Hành lang',
  'R-KITCHEN': 'Bếp',
  'R-LIVING': 'Phòng khách',
  'R-STUDY': 'Phòng làm việc',
};

interface HouseWall { id: string; kind: string; thicknessMm: number; start: Pt; end: Pt; heightMm?: number }
interface HouseOpening { id: string; wallId: string; kind: string; relativePosition: number; widthMm: number; heightMm: number; sillHeightMm: number; swing: string }
interface HouseRoom { id: string; usage: string; finish?: string; outline: Pt[] }
interface HouseFurniture { id: string; roomId?: string; kind: string; variant?: string; centreMm: Pt; sizeMm: readonly [number, number, number]; facing: keyof typeof FACING_TURN; liftMm?: number }

/** Tường `w` nằm (một phần dương) trên một cạnh của đường bao. */
const onEdge = (w: HouseWall, outline: readonly Pt[]): boolean =>
  outline.some((a, i) => {
    const b = outline[(i + 1) % outline.length] ?? a;
    const cross = (q: Pt) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    if (cross(w.start) !== 0 || cross(w.end) !== 0) return false;
    const t = (q: Pt) =>
      ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    return Math.min(Math.max(t(w.start), t(w.end)), 1) - Math.max(Math.min(t(w.start), t(w.end)), 0) > 1e-6;
  });

export function houseModelSpatial({ ext }: { readonly ext: boolean }): WireDocument {
  const id = (p: string, old: string) => stableId(p, `D1:${old}`);
  const level = 'L-01M57GTWHZVDVRAXCH2AXTRSEQ';
  const height = house.levels[0]?.heightMm ?? 2400;
  const srcWalls = house.walls as unknown as readonly HouseWall[];

  // Lan can chưa có `WallKind` riêng (Phase B) → vách ngăn, giữ chiều cao thấp.
  const walls = srcWalls.map((w) => ({
    ...META,
    centreline: { end: { x: w.end[0], y: w.end[1] }, start: { x: w.start[0], y: w.start[1] } },
    heightMm: w.heightMm ?? height,
    id: id('W', w.id),
    kind: w.kind === 'railing' ? 'partition' : w.kind,
    levelId: level,
    openingIds: [] as string[],
    thicknessMm: w.thicknessMm,
  }));
  const wallOf = new Map(srcWalls.map((w, i) => [w.id, { src: w, wire: walls[i]! }]));

  // Ô trống (`void`) chưa có `OpeningKind` riêng → cửa đi `fixed`.
  const openings = (house.openings as unknown as readonly HouseOpening[]).map((o) => {
    const { src, wire } = wallOf.get(o.wallId)!;
    const len = Math.hypot(src.end[0] - src.start[0], src.end[1] - src.start[1]);
    const openingId = id('D', o.id);
    wire.openingIds.push(openingId);
    return {
      ...META,
      heightMm: o.heightMm,
      id: openingId,
      kind: o.kind === 'void' ? 'door' : o.kind,
      offsetMm: Math.max(0, Math.round(o.relativePosition * len - o.widthMm / 2)),
      sillHeightMm: o.sillHeightMm,
      swing: o.kind === 'void' ? 'fixed' : o.swing,
      wallId: wire.id,
      widthMm: o.widthMm,
    };
  });

  const rooms = (house.rooms as unknown as readonly HouseRoom[]).map((r) => ({
    ...META,
    areaM2: areaM2(r.outline),
    id: id('R', r.id),
    levelId: level,
    name: NAMES[r.id] ?? r.id,
    outline: r.outline.map(([x, y]) => ({ x, y })),
    usage: r.usage,
    wallIds: srcWalls.filter((w) => onEdge(w, r.outline)).map((w) => id('W', w.id)),
    ...(ext && r.finish !== undefined ? { finish: r.finish } : {}),
  }));
  const roomIds = new Set(house.rooms.map((r) => r.id));

  // K1: hộp bao là dấu chân cục bộ (chưa quay) w × d quanh tâm.
  const furniture = (house.furniture as unknown as readonly HouseFurniture[]).map((f) => {
    const [cx, cy] = f.centreMm;
    const [w, d, h] = f.sizeMm;
    return {
      ...META,
      boundingBox: {
        max: { x: Math.round(cx + w / 2), y: Math.round(cy + d / 2) },
        min: { x: Math.round(cx - w / 2), y: Math.round(cy - d / 2) },
      },
      centre: { x: cx, y: cy },
      id: id('F', f.id),
      kind: f.kind,
      levelId: level,
      ...(f.roomId !== undefined && roomIds.has(f.roomId) ? { roomId: id('R', f.roomId) } : {}),
      rotationDeg: mod360(Math.round((-FACING_TURN[f.facing] * 180) / Math.PI)),
      ...(ext
        ? {
            heightMm: h,
            ...(f.variant !== undefined ? { variant: f.variant } : {}),
            ...(f.liftMm !== undefined ? { liftMm: f.liftMm } : {}),
          }
        : {}),
    };
  });

  return {
    floorRevisions: [{ floorId: level, revision: 10 }],
    graph: {
      axes: [],
      building: { ...META, datumElevationMm: 0, name: 'D1 - can ho dang nhap' },
      dimensions: [],
      furniture: furniture as WireEntity[],
      levels: [{ ...META, elevationMm: 0, heightMm: height, id: level, name: 'Tầng 1', order: 0 }],
      notes: [],
      openings,
      rooms,
      walls,
    },
  };
}
