/**
 * The demo house the landing page builds: two storeys, one authoritative dataset.
 *
 * Source: docs/trang-chu/proto/plan-data.js (metres, centred, z down the sheet).
 * Converted to the present layer's convention: mm, origin at the back-left
 * corner, x_mm = (x + 6) * 1000, y_mm = (z + 4.5) * 1000. Openings were written as
 * an offset from the wall's start; here they are a fraction of its length.
 *
 * Brief conflict kept explicit: the stated room areas (25 / 35 / 20 / 4,5 / 7,5 /
 * 16 and 40 / 32 m2) come from the brief and are shown as such. The ground
 * polygons happen to match them, but R7's polygon is notched to leave the
 * stairwell open, so its polygon area (about 35,2 m2) is no longer the stated 40.
 */

import type { PlanOpening, PlanRoom, PlanWall, PresentationPlan } from '@/lib/three/present';

import type { ComplianceCheck, LandingHouse, RoomInfo, StairSpec } from '../types';

import { LANDING_FURNITURE } from './furniture';

const EXTERIOR = 220;
const INTERIOR = 110;
const STOREY = 3000;

const wall = (id: string, levelId: string, a: [number, number], b: [number, number], t: number): PlanWall => ({
  id,
  levelId,
  kind: t === EXTERIOR ? 'loadBearing' : 'partition',
  thicknessMm: t,
  start: a,
  end: b,
});

const WALLS: readonly PlanWall[] = [
  // Ground, exterior.
  wall('W1', 'T1', [0, 0], [12000, 0], EXTERIOR),
  wall('W2', 'T1', [12000, 0], [12000, 9000], EXTERIOR),
  wall('W3', 'T1', [12000, 9000], [0, 9000], EXTERIOR),
  wall('W4', 'T1', [0, 9000], [0, 0], EXTERIOR),
  // Ground, interior.
  wall('W5', 'T1', [0, 5000], [5000, 5000], INTERIOR),
  wall('W6', 'T1', [5000, 5000], [8000, 5000], INTERIOR),
  wall('W7', 'T1', [8000, 5000], [12000, 5000], INTERIOR),
  wall('W8', 'T1', [5000, 0], [5000, 5000], INTERIOR),
  wall('W9', 'T1', [5000, 5000], [5000, 9000], INTERIOR),
  wall('W10', 'T1', [8000, 5000], [8000, 9000], INTERIOR),
  wall('W11', 'T1', [5000, 6500], [8000, 6500], INTERIOR),
  // Upper (8 x 9 m).
  wall('U1', 'T2', [0, 0], [8000, 0], EXTERIOR),
  wall('U2', 'T2', [8000, 0], [8000, 9000], EXTERIOR),
  wall('U3', 'T2', [8000, 9000], [0, 9000], EXTERIOR),
  wall('U4', 'T2', [0, 9000], [0, 0], EXTERIOR),
  wall('U5', 'T2', [0, 5000], [8000, 5000], INTERIOR),
  // Guard rail along the open edge of the stairwell.
  { id: 'U6', levelId: 'T2', kind: 'railing', thicknessMm: 80, heightMm: 1050, start: [1200, 0], end: [1200, 4300] },
];

const lengthOf = (id: string): number => {
  const w = WALLS.find((x) => x.id === id);
  if (w === undefined) {
    throw new RangeError(`unknown wall ${id}`);
  }
  return Math.hypot((w.end[0] ?? 0) - (w.start[0] ?? 0), (w.end[1] ?? 0) - (w.start[1] ?? 0));
};

const door = (
  id: string,
  wallId: string,
  offsetMm: number,
  widthMm: number,
  opensTowards: string,
  swing = 'left',
): PlanOpening => ({
  id,
  wallId,
  kind: 'door',
  relativePosition: offsetMm / lengthOf(wallId),
  widthMm,
  heightMm: id === 'D1' ? 2200 : 2100,
  sillHeightMm: 0,
  swing,
  opensTowards,
});

const win = (id: string, wallId: string, offsetMm: number, widthMm: number, sill: number, head: number): PlanOpening => ({
  id,
  wallId,
  kind: 'window',
  relativePosition: offsetMm / lengthOf(wallId),
  widthMm,
  heightMm: head - sill,
  sillHeightMm: sill,
  swing: 'fixed',
});

const OPENINGS: readonly PlanOpening[] = [
  door('D1', 'W1', 2500, 1000, 'north'),
  win('S1', 'W1', 9500, 1600, 900, 2200),
  win('S2', 'W2', 2500, 1400, 900, 2200),
  win('S3', 'W2', 7000, 1200, 900, 2200),
  win('S4', 'W3', 2000, 1200, 900, 2200),
  win('S5', 'W3', 5500, 600, 1500, 2200),
  win('S6', 'W3', 9500, 1400, 900, 2200),
  win('S7', 'W4', 6500, 1600, 900, 2200),
  {
    id: 'O1',
    wallId: 'W8',
    kind: 'void',
    relativePosition: 1500 / lengthOf('W8'),
    widthMm: 2000,
    heightMm: 2100,
    sillHeightMm: 0,
    swing: 'fixed',
  },
  door('D2', 'W6', 1500, 900, 'north', 'right'),
  door('D3', 'W9', 750, 800, 'west'),
  door('D4', 'W10', 750, 800, 'east', 'right'),
  door('D5', 'W11', 1500, 700, 'north'),
  door('UD1', 'U5', 4000, 800, 'north'),
  win('US1', 'U1', 4000, 2400, 300, 2400),
  win('US2', 'U3', 4000, 1400, 900, 2200),
  win('US3', 'U2', 6500, 1200, 900, 2200),
];

const rect = (x0: number, y0: number, x1: number, y1: number): number[][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const room = (id: string, levelId: string, finish: string, outline: number[][]): PlanRoom => ({
  id,
  levelId,
  finish,
  outline,
});

const ROOMS: readonly PlanRoom[] = [
  room('R1', 'T1', 'wood', rect(0, 0, 5000, 5000)),
  room('R2', 'T1', 'tile', rect(5000, 0, 12000, 5000)),
  room('R3', 'T1', 'wood', rect(0, 5000, 5000, 9000)),
  room('R4', 'T1', 'wood', rect(5000, 5000, 8000, 6500)),
  room('R5', 'T1', 'mosaic', rect(5000, 6500, 8000, 9000)),
  room('R6', 'T1', 'wood', rect(8000, 5000, 12000, 9000)),
  // R7 is notched: the stairwell (x 0-1200, y 0-4300) stays open above the flight.
  room('R7', 'T2', 'wood', [
    [1200, 0],
    [8000, 0],
    [8000, 5000],
    [0, 5000],
    [0, 4300],
    [1200, 4300],
  ]),
  room('R8', 'T2', 'wood', rect(0, 5000, 8000, 9000)),
];

const PLAN: PresentationPlan = {
  levels: [
    { id: 'T1', elevationMm: 0, heightMm: STOREY },
    { id: 'T2', elevationMm: STOREY, heightMm: STOREY },
  ],
  walls: WALLS,
  openings: OPENINGS,
  rooms: ROOMS,
  furniture: LANDING_FURNITURE,
  ceilingLights: {
    heightMm: 2700,
    roomIds: ['R1', 'R2', 'R3', 'R6', 'R7', 'R8'],
    positionsMm: [[9500, 2500]],
  },
};

const NAMES: readonly (readonly [string, string, number])[] = [
  ['R1', 'Phòng khách', 25],
  ['R2', 'Bếp + ăn', 35],
  ['R3', 'Phòng ngủ 1', 20],
  ['R4', 'Hành lang', 4.5],
  ['R5', 'WC', 7.5],
  ['R6', 'Phòng ngủ 2', 16],
  ['R7', 'Phòng làm việc', 40],
  ['R8', 'Phòng ngủ 3', 32],
];
const ROOM_INFO: readonly RoomInfo[] = NAMES.map(([roomId, name, statedAreaM2]) => ({ roomId, name, statedAreaM2 }));

/** 16 risers x 187,5 = 3000 mm; 15 treads x 260 = 3900 mm of run, so the upper slab starts at y = 4300. */
const STAIR: StairSpec = {
  id: 'STAIR-1',
  levelId: 'T1',
  startMm: [610, 400],
  climbs: 'north',
  widthMm: 1000,
  risers: 16,
  riserMm: 187.5,
  treadMm: 260,
};

const chk = (
  id: string,
  label: string,
  value: string,
  pass: boolean,
  targetId: string,
  suggestion?: string,
): ComplianceCheck => ({ id, label, value, pass, targetId, ...(suggestion === undefined ? {} : { suggestion }) });

const CHECKS: readonly ComplianceCheck[] = [
  chk('C1', 'Cửa đi chính ≥ 0,9 m', '1,0 m', true, 'D1'),
  chk('C2', 'Cửa phòng ngủ ≥ 0,8 m', '0,8 m', true, 'D3'),
  chk('C3', 'Cửa phòng ngủ ≥ 0,8 m', '0,8 m', true, 'D4'),
  chk('C4', 'Cửa WC ≥ 0,75 m', '0,7 m', false, 'D5', 'Mở rộng lên 0,75 m'),
  chk('C5', 'Hành lang ≥ 1,2 m', '1,5 m', true, 'R4'),
  chk('C6', 'Chiều cao tầng ≥ 2,7 m', '3,0 m', true, 'T1'),
  chk('C7', 'Bậc thang ≤ 18 cm', '18,75 cm', false, STAIR.id, 'Thêm 1 bậc (17 bậc × 17,6 cm)'),
  chk('C8', 'Cửa sổ phòng ngủ ≥ 1/8 diện tích sàn', 'đạt', true, 'R3'),
  chk('C9', 'Cửa sổ phòng ngủ ≥ 1/8 diện tích sàn', 'đạt', true, 'R6'),
  chk('C10', 'WC có thông gió', 'đạt', true, 'R5'),
  chk('C11', 'Phòng ngủ ≥ 9 m²', '16–32 m²', true, 'R6'),
  chk('C12', 'Tường ngoài ≥ 200 mm', '220 mm', true, 'W1'),
];

export const LANDING_HOUSE: LandingHouse = {
  plan: PLAN,
  // plan-data axes A..D = x -6, -1, 2, 6 -> 0, 5000, 8000, 12000; 1..3 = z -4.5, 0.5, 4.5 -> 0, 5000, 9000.
  axes: [
    { id: 'A', along: 'x', atMm: 0 },
    { id: 'B', along: 'x', atMm: 5000 },
    { id: 'C', along: 'x', atMm: 8000 },
    { id: 'D', along: 'x', atMm: 12000 },
    { id: '1', along: 'y', atMm: 0 },
    { id: '2', along: 'y', atMm: 5000 },
    { id: '3', along: 'y', atMm: 9000 },
  ],
  rooms: ROOM_INFO,
  stair: STAIR,
  // F9 (the stair) is not furniture here: it is LANDING_HOUSE.stair, checked as C7.
  detections: [
    { furnitureId: 'F1', label: 'Giường', confidence: 0.94, labelled: true },
    { furnitureId: 'F2', label: 'Giường', confidence: 0.92, labelled: false },
    { furnitureId: 'F3', label: 'Sofa', confidence: 0.89, labelled: true },
    { furnitureId: 'F4', label: 'Bàn ăn', confidence: 0.9, labelled: true },
    { furnitureId: 'F5', label: 'Bếp', confidence: 0.87, labelled: false },
    { furnitureId: 'F6', label: 'Bồn rửa', confidence: 0.88, labelled: false },
    { furnitureId: 'F7', label: 'Bồn cầu', confidence: 0.93, labelled: false },
    { furnitureId: 'F8', label: 'Lavabo', confidence: 0.91, labelled: false },
    { furnitureId: 'F10', label: 'Giường', confidence: 0.95, labelled: false },
    { furnitureId: 'F11', label: 'Bàn làm việc', confidence: 0.86, labelled: false },
  ],
  reviewGap: { wallId: 'W7', from: 0.35, to: 0.55 },
  checks: CHECKS,
  exports: [
    { format: 'GLB', label: 'Xem 3D' },
    { format: 'IFC', label: 'BIM' },
    { format: 'PDF', label: 'Bản in' },
    { format: 'JSON', label: 'Dữ liệu' },
    { format: 'PNG', label: 'Chia sẻ' },
  ],
};
