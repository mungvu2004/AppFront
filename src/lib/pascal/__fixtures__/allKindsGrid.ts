/**
 * F2 — lưới 2 × 4 phòng 4000 × 4000 mm phủ mọi nhánh ánh xạ của toPascal.
 *
 * Mỗi phòng một `RoomUsage`; tường bắc/nam ngoài `loadBearing`, đông/tây ngoài
 * `envelope`, tường trong `partition`; năm kiểu `swing` cho cửa đi (tường trong)
 * và cho cửa sổ (tường ngoài); 8 `FurnitureKind` × 0/90/180/270°, w = 1,5·d.
 * Không có khoá `model` — FurnitureSchema strict từ chối nó (R2 3c).
 */

import { META, stableId } from './houseModelSpatial';
import type { WireDocument } from './index';

const CELL = 4000;
const COLS = 4;
const ROWS = 2;
const USAGES = ['livingRoom', 'bedroom', 'kitchen', 'bathroom', 'corridor', 'stairwell', 'utility', 'other'] as const;
const KINDS = ['table', 'chair', 'bed', 'wardrobe', 'kitchenCabinet', 'sanitaryFixture', 'stair', 'other'] as const;
const SWINGS = ['left', 'right', 'double', 'sliding', 'fixed'] as const;
const FURNITURE_D = 600;
const FURNITURE_W = FURNITURE_D * 1.5;

interface GridWall { key: string; x0: number; y0: number; x1: number; y1: number; kind: string }

export function allKindsGrid(): WireDocument {
  const id = (p: string, key: string) => stableId(p, `F2:${key}`);
  const level = id('L', 'level');

  const lines: GridWall[] = [];
  // Ngang: y = 0, 4000, 8000; mỗi đường cắt thành 4 đoạn một ô.
  for (let r = 0; r <= ROWS; r++)
    for (let c = 0; c < COLS; c++)
      lines.push({ key: `H${r}${c}`, x0: c * CELL, y0: r * CELL, x1: (c + 1) * CELL, y1: r * CELL, kind: r % ROWS === 0 ? 'loadBearing' : 'partition' });
  // Dọc: x = 0 … 16000; mỗi đường 2 đoạn.
  for (let c = 0; c <= COLS; c++)
    for (let r = 0; r < ROWS; r++)
      lines.push({ key: `V${c}${r}`, x0: c * CELL, y0: r * CELL, x1: c * CELL, y1: (r + 1) * CELL, kind: c % COLS === 0 ? 'envelope' : 'partition' });

  const walls = lines.map((l) => ({
    ...META,
    centreline: { end: { x: l.x1, y: l.y1 }, start: { x: l.x0, y: l.y0 } },
    heightMm: 3000,
    id: id('W', l.key),
    kind: l.kind,
    levelId: level,
    openingIds: [] as string[],
    thicknessMm: l.kind === 'partition' ? 120 : 250,
  }));
  const wallByKey = new Map(lines.map((l, i) => [l.key, walls[i]!]));

  const opening = (key: string, wallKey: string, kind: 'door' | 'window', swing: string) => {
    const wall = wallByKey.get(wallKey)!;
    const openingId = id('D', key);
    wall.openingIds.push(openingId);
    const width = kind === 'window' ? 1200 : swing === 'double' ? 1600 : 900;
    return {
      ...META,
      heightMm: kind === 'window' ? 1400 : 2100,
      id: openingId,
      kind,
      offsetMm: (CELL - width) / 2,
      sillHeightMm: kind === 'window' ? 900 : 0,
      swing,
      wallId: wall.id,
      widthMm: width,
    };
  };
  // Cửa đi trên 4 đoạn ngang giữa + 1 đoạn dọc trong; cửa sổ trên 5 đoạn ngoài bắc/nam.
  const doorWalls = ['H10', 'H11', 'H12', 'H13', 'V10'];
  const windowWalls = ['H00', 'H01', 'H02', 'H03', 'H20'];
  const openings = [
    ...SWINGS.map((s, i) => opening(`door-${s}`, doorWalls[i]!, 'door', s)),
    ...SWINGS.map((s, i) => opening(`window-${s}`, windowWalls[i]!, 'window', s)),
  ];

  const rooms = USAGES.map((usage, i) => {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = c * CELL;
    const y = r * CELL;
    return {
      ...META,
      areaM2: 16,
      id: id('R', usage),
      levelId: level,
      name: `Phòng ${usage}`,
      outline: [{ x, y }, { x: x + CELL, y }, { x: x + CELL, y: y + CELL }, { x, y: y + CELL }],
      usage,
      wallIds: [`H${r}${c}`, `V${c + 1}${r}`, `H${r + 1}${c}`, `V${c}${r}`].map((k) => wallByKey.get(k)!.id),
    };
  });

  // Phòng i giữ loại đồ i, bốn góc phần tư mỗi góc một hướng quay.
  const furniture = KINDS.flatMap((kind, i) => {
    const room = rooms[i]!;
    const cx0 = (i % COLS) * CELL + CELL / 2;
    const cy0 = Math.floor(i / COLS) * CELL + CELL / 2;
    return [0, 90, 180, 270].map((rotationDeg, q) => {
      const cx = cx0 + (q % 2 === 0 ? -1000 : 1000);
      const cy = cy0 + (q < 2 ? -1000 : 1000);
      return {
        ...META,
        boundingBox: {
          max: { x: cx + FURNITURE_W / 2, y: cy + FURNITURE_D / 2 },
          min: { x: cx - FURNITURE_W / 2, y: cy - FURNITURE_D / 2 },
        },
        centre: { x: cx, y: cy },
        id: id('F', `${kind}-${rotationDeg}`),
        kind,
        levelId: level,
        roomId: room.id,
        rotationDeg,
      };
    });
  });

  return {
    floorRevisions: [{ floorId: level, revision: 1 }],
    graph: {
      axes: [],
      building: { ...META, datumElevationMm: 0, name: 'F2 - moi nhanh anh xa' },
      dimensions: [],
      furniture,
      levels: [{ ...META, elevationMm: 0, heightMm: 3000, id: level, name: 'Tầng 1', order: 0 }],
      notes: [],
      openings,
      rooms,
      walls,
    },
  };
}
