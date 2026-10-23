/**
 * Walls and openings of the villa (archviz.md §3.3–3.5), plan mm, street at y = 0.
 *
 * Walls are centrelines: exterior 220 mm (loadBearing), interior 110 mm
 * (partition), stair and balcony guards 80 mm railings. An opening is placed by
 * the plan coordinate of its centre along the wall (x on an east-west wall, y on
 * a north-south one) and converted to the present layer's `relativePosition`.
 * Sliding glass walls are `window` + swing `sliding` with sill 0: present glazes
 * them, adds a mullion and a threshold, and leaves the door-swing rules alone.
 */

import type { PlanOpening, PlanWall } from '@/lib/three/present';

export const EXTERIOR = 220;
export const INTERIOR = 110;
export const STOREY = 3375;
/** Door head height (brief: 2.4 m); the main pivot door is 2.7 m. */
const HEAD = 2400;

type P = [number, number];

const wall = (id: string, levelId: string, a: P, b: P, t: number, heightMm?: number, kind?: string): PlanWall => ({
  id,
  levelId,
  kind: kind ?? (t === EXTERIOR ? 'loadBearing' : 'partition'),
  thicknessMm: t,
  start: a,
  end: b,
  ...(heightMm === undefined ? {} : { heightMm }),
});

const rail = (id: string, level: string, a: P, b: P): PlanWall => wall(id, level, a, b, 80, 1050, 'railing');

export const WALLS: readonly PlanWall[] = [
  // Ground floor T1, exterior (x 4–28, y 9–21).
  wall('W1', 'T1', [4000, 9000], [28000, 9000], EXTERIOR),
  wall('W2', 'T1', [28000, 9000], [28000, 21000], EXTERIOR),
  wall('W3', 'T1', [28000, 21000], [4000, 21000], EXTERIOR),
  wall('W4', 'T1', [4000, 21000], [4000, 9000], EXTERIOR),
  // Ground floor, interior.
  wall('W5', 'T1', [10000, 9000], [10000, 15000], INTERIOR),
  wall('W6', 'T1', [4000, 15000], [10000, 15000], INTERIOR),
  wall('W7', 'T1', [10000, 15000], [16000, 15000], INTERIOR),
  wall('W8', 'T1', [16000, 15000], [22000, 15000], INTERIOR),
  wall('W9', 'T1', [22000, 15000], [28000, 15000], INTERIOR),
  wall('W10', 'T1', [16000, 9000], [16000, 15000], INTERIOR),
  wall('W11', 'T1', [16000, 15000], [16000, 21000], INTERIOR),
  wall('W12', 'T1', [22000, 9000], [22000, 15000], INTERIOR),
  wall('W13', 'T1', [9000, 18000], [9000, 21000], INTERIOR),
  wall('W14', 'T1', [4000, 12500], [10000, 12500], INTERIOR),
  wall('W15', 'T1', [7000, 12500], [7000, 15000], INTERIOR),
  wall('W16', 'T1', [22000, 11500], [28000, 11500], INTERIOR),
  wall('W17', 'T1', [25000, 9000], [25000, 11500], INTERIOR),
  // Upper floor T2, exterior (x 4–22, y 9–23: 2 m cantilever over the rear veranda).
  wall('U1', 'T2', [4000, 9000], [22000, 9000], EXTERIOR),
  wall('U2', 'T2', [22000, 9000], [22000, 23000], EXTERIOR),
  wall('U3', 'T2', [22000, 23000], [4000, 23000], EXTERIOR),
  wall('U4', 'T2', [4000, 23000], [4000, 9000], EXTERIOR),
  // Upper floor, interior.
  wall('U5', 'T2', [4000, 16000], [12000, 16000], INTERIOR),
  wall('U6', 'T2', [12000, 16000], [17000, 16000], INTERIOR),
  wall('U7', 'T2', [17000, 16000], [22000, 16000], INTERIOR),
  wall('U8', 'T2', [12000, 9000], [12000, 16000], INTERIOR),
  wall('U9', 'T2', [12000, 16000], [12000, 23000], INTERIOR),
  wall('U10', 'T2', [4000, 12000], [12000, 12000], INTERIOR),
  wall('U11', 'T2', [8000, 12000], [8000, 16000], INTERIOR),
  wall('U12', 'T2', [16000, 9000], [16000, 16000], INTERIOR),
  wall('U13', 'T2', [17000, 16000], [17000, 23000], INTERIOR),
  wall('U14', 'T2', [16000, 12500], [22000, 12500], INTERIOR),
  wall('U15', 'T2', [19000, 12500], [19000, 16000], INTERIOR),
  // Guards round the stairwell void (x 13.2–16, y 11–14.36). Each flight 2 arrives at x 13.2–14.4,
  // y 11; on T2 the next flight (STAIR-2) starts at x 14.6–15.8, y 11, so that edge stays open.
  rail('R1', 'T2', [13200, 11000], [13200, 14360]),
  rail('R2', 'T2', [13200, 14360], [16000, 14360]),
  // Top floor T3 (x 12–20, y 9–16): the small third mass with its own roof.
  wall('V1', 'T3', [12000, 9000], [20000, 9000], EXTERIOR),
  wall('V2', 'T3', [20000, 9000], [20000, 16000], EXTERIOR),
  wall('V3', 'T3', [20000, 16000], [12000, 16000], EXTERIOR),
  wall('V4', 'T3', [12000, 16000], [12000, 9000], EXTERIOR),
  wall('V5', 'T3', [16000, 9000], [16000, 16000], INTERIOR),
  rail('R7', 'T3', [13200, 11000], [13200, 14360]),
  rail('R8', 'T3', [13200, 14360], [16000, 14360]),
  rail('R9', 'T3', [14400, 11000], [16000, 11000]),
];

const byId = new Map(WALLS.map((w) => [w.id, w]));

export function wallById(id: string): PlanWall {
  const w = byId.get(id);
  if (w === undefined) {
    throw new RangeError(`unknown wall ${id}`);
  }
  return w;
}

/** Fraction along `wallId` of the point whose varying coordinate is `atMm`. */
function rel(wallId: string, atMm: number): number {
  const w = wallById(wallId);
  const [sx, sy, ex, ey] = [w.start[0] ?? 0, w.start[1] ?? 0, w.end[0] ?? 0, w.end[1] ?? 0];
  return sx === ex ? (atMm - sy) / (ey - sy) : (atMm - sx) / (ex - sx);
}

const door = (id: string, wallId: string, at: number, width: number, opensTowards: string, swing = 'left'): PlanOpening => ({
  id,
  wallId,
  kind: 'door',
  relativePosition: rel(wallId, at),
  widthMm: width,
  heightMm: id === 'D1' ? 2700 : HEAD,
  sillHeightMm: 0,
  swing,
  opensTowards,
});

const win = (id: string, wallId: string, at: number, width: number, sill: number, head: number, swing = 'fixed'): PlanOpening => ({
  id,
  wallId,
  kind: 'window',
  relativePosition: rel(wallId, at),
  widthMm: width,
  heightMm: head - sill,
  sillHeightMm: sill,
  swing,
});

const glassWall = (id: string, wallId: string, at: number, width: number): PlanOpening =>
  win(id, wallId, at, width, 0, 2700, 'sliding');

const opening = (id: string, wallId: string, at: number, width: number, head = 2700): PlanOpening => ({
  id,
  wallId,
  kind: 'void',
  relativePosition: rel(wallId, at),
  widthMm: width,
  heightMm: head,
  sillHeightMm: 0,
  swing: 'fixed',
});

export const OPENINGS: readonly PlanOpening[] = [
  // T1 exterior.
  door('D1', 'W1', 13000, 1400, 'north'), // teak pivot door on the gate axis x = 13
  win('W-B4', 'W1', 7000, 4000, 600, HEAD),
  win('W-FAM', 'W1', 19000, 4000, 600, HEAD),
  win('W-G10', 'W1', 23500, 600, 1600, 2200),
  door('D-CAR', 'W2', 13000, 900, 'west', 'right'),
  glassWall('SL1', 'W3', 22000, 10000),
  glassWall('SL2', 'W3', 12500, 5000),
  win('W-KIT', 'W3', 6500, 3000, 1050, HEAD),
  win('W-WEST', 'W4', 18000, 4000, 900, HEAD),
  win('W-G7', 'W4', 13750, 600, 1600, 2200),
  // T1 interior.
  door('D-G6', 'W5', 11500, 900, 'west'),
  door('D-G8', 'W6', 8500, 800, 'south', 'right'),
  opening('O1', 'W7', 11800, 3000),
  door('D-G5', 'W8', 19000, 900, 'south'),
  opening('O2', 'W9', 24000, 1500),
  opening('O3', 'W11', 18000, 4000),
  door('D-G7', 'W14', 5500, 800, 'north'),
  door('D-G10', 'W16', 23500, 700, 'south'), // 0,70 m: fails C4
  door('D-G11', 'W16', 26500, 800, 'south', 'right'),
  // T2 exterior.
  win('W-U6', 'U1', 8000, 6000, 750, HEAD),
  win('W-U7', 'U1', 14000, 2000, 900, HEAD),
  win('W-U8', 'U1', 19000, 4000, 600, HEAD),
  // U2 (x = 22) is a blind stone wall: the ground-floor roof climbs against it.
  glassWall('SL3', 'U3', 8000, 6000),
  win('W-U4', 'U3', 14500, 3000, 600, HEAD),
  win('W-U5', 'U3', 19500, 3000, 600, HEAD),
  win('W-U3', 'U4', 14000, 2000, 1600, 2200),
  win('W-U1', 'U4', 19500, 3000, 900, HEAD),
  // T2 interior.
  door('D-U1', 'U5', 10000, 900, 'north'),
  door('D-U4', 'U6', 14500, 900, 'north'),
  door('D-U5', 'U7', 18000, 900, 'north', 'right'),
  door('D-U6', 'U8', 10500, 900, 'west'),
  door('D-U2', 'U8', 15400, 800, 'west', 'right'),
  door('D-U3', 'U11', 14000, 800, 'west'),
  opening('O-U8', 'U12', 10200, 1600, HEAD),
  opening('O-U10', 'U14', 17500, 2000, HEAD),
  door('D-U9', 'U15', 14250, 800, 'east'),
  // T3.
  glassWall('W-P2', 'V1', 14000, 2000),
  win('W-P1', 'V1', 18000, 2400, 900, HEAD),
  win('W-P1E', 'V2', 12500, 1500, 900, HEAD),
  door('D-P1', 'V5', 15200, 900, 'east'),
];
