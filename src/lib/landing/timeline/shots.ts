/**
 * The shot list: what each camera waypoint frames, not where the camera is.
 *
 * Exterior shots `fit` a world box into the free part of the frame (framing.ts),
 * so they recompose for any aspect; interior shots stand at an `eye` point (eye
 * level 1.35–1.45 m, level, so verticals stay vertical) and look at a `focus`.
 * Positions come from house.ts / furniture.ts (metres, x = plan x, z = plan y,
 * street at z < 0). `hold` = arrive and leave with zero speed (a read or a reveal).
 *
 * Key rooms: living R1 x 0–5 z 0–5 (stair on the west wall, sofa x 2.3 z 3.8,
 * TV on W8), kitchen R2 x 5–12 z 0–5 (run on W1, table x 7.2 z 2.5), hall R4
 * x 5–8 z 5–6.5, WC R5 behind D5 (x 6.5 z 6.5), bedroom 2 R6 x 8–12 z 5–9 (never
 * under the upper storey, which covers x 0–8).
 */

import type { Vec3 } from '../types';

import type { Shot } from './framing';

export interface ShotKey {
  readonly name: string;
  readonly p: number;
  readonly shot: Shot;
  readonly rollDeg: number;
  readonly hold?: boolean;
}

type Box = readonly [Vec3, Vec3];
const PLAN_SHEET: Box = [
  [-1.6, 0, -1.6],
  [13.6, 0, 10.6],
];
const GAP: Box = [
  [8.6, 0, 4.1],
  [11.2, 0.2, 5.9],
];
const GAP_WIDE: Box = [
  [7.4, 0, 3],
  [12.4, 0.3, 7],
];
/** The flight on the west wall and the upper stairwell above it (upper lifted 1.2 m). */
const STAIR_LINK: Box = [
  [-0.3, 0, 0],
  [3.2, 5.6, 5],
];
const ground = (h: number): Box => [
  [0, 0, 0],
  [12, h, 9],
];

const fit = (box: Box, azDeg: number, elDeg: number, fovDeg: number, fill?: number): Shot => ({
  kind: 'fit',
  box,
  azDeg,
  elDeg,
  fovDeg,
  ...(fill === undefined ? {} : { fill }),
});
const eye = (at: Vec3, focus: Vec3, fovDeg: number, pitchDeg = 0): Shot => ({ kind: 'eye', eye: at, focus, fovDeg, pitchDeg });
const k = (name: string, p: number, shot: Shot, rollDeg = 0, hold = false): ShotKey => ({ name, p, shot, rollDeg, hold });

export const SHOTS: readonly ShotKey[] = [
  // S01 — near-orthographic long lens, the whole sheet right of the headline; leans oblique.
  k('sheet', 0, fit(PLAN_SHEET, 0, 88, 11), 0, true),
  k('sheet-lean', 0.075, fit(PLAN_SHEET, 4, 79, 12.5), 0.2),
  // S02 — ~10° of yaw, the lens opens.
  k('aligned', 0.16, fit(PLAN_SHEET, 11, 66, 17), 0.4),
  // S03 — a small orbit while the layers appear (box leaves room for the explode).
  k('recognise', 0.24, fit(ground(0.5), 18, 54, 21, 1.05), 0.6),
  // S04 — decelerate onto the gap in W7, hold while it closes.
  k('gap-approach', 0.322, fit(GAP_WIDE, 24, 50, 26), 0.4),
  k('gap-hold', 0.37, fit(GAP, 22, 52, 26), 0.3, true),
  // S05 — pull back over the footprint, lateral orbit, settle on both storeys (upper lifted).
  k('hero-approach', 0.43, fit(ground(1), 26, 44, 34), 0.4),
  k('hero-orbit', 0.49, fit(ground(3), 6, 34, 34), 0.6),
  k('hero-settle', 0.536, fit(ground(8.4), -26, 28, 44, 0.95), -0.3, true),
  // S06 — walk in through D1; living (kitchen revealed through O1), the O1 threshold, kitchen,
  // D2, the hall.
  k('entry', 0.58, eye([2.5, 1.8, -4.4], [2.5, 1.3, 2], 38, -3)),
  k('door', 0.591, eye([2.5, 1.45, -0.2], [2.1, 1.3, 4], 40)),
  k('living', 0.603, eye([1.45, 1.35, 4.6], [4.9, 1.2, 2.7], 42), 0, true),
  k('o1', 0.62, eye([4.75, 1.4, 1.55], [10.6, 1.1, 2.8], 42), 0, true),
  k('kitchen', 0.637, eye([6.5, 1.35, 4.3], [10.6, 0.9, 0.6], 44), 0, true),
  k('d2', 0.652, eye([6.5, 1.4, 5.05], [6.6, 1.2, 8], 44)),
  k('hall-in', 0.659, eye([6.6, 1.4, 5.45], [4, 1.1, 6.2], 44)),
  // Up out of the open-topped hall (upper lifted 4 m): bedroom 1 over W9, then bedroom 2.
  k('bed1', 0.672, eye([7.2, 5.2, 5.75], [1.8, 0, 7], 44, -36), 0, true),
  k('bed2', 0.69, eye([7.25, 5, 5.8], [10.4, 0.2, 7.3], 46, -45), 0, true),
  k('exit', 0.705, eye([5.8, 5.6, -1.8], [3, 2, 4.5], 40, -24), -0.3),
  // S07 — axonometric from the west-front over the cut walls: the flight under the lifted upper
  // storey and the stairwell it reaches; then a slow push in on that connection.
  k('axo', 0.737, fit(ground(7.4), -52, 30, 44, 0.88), -0.5, true),
  k('stair-axo', 0.757, fit(STAIR_LINK, -56, 25, 44), -0.4),
  // S08 — round the front, over the cut walls into the WC: D5 from above on its WC side, the stair risers from the living room, then (upper lifted higher) both in context.
  k('front-in', 0.79, eye([10, 4.6, -3.2], [6.5, 0.5, 6.5], 40, -30), 0.2),
  k('wc-look', 0.814, eye([7.3, 3.2, 8.6], [6.5, 0.3, 6.5], 40, -50), 0, true),
  k('stair-look', 0.842, eye([3.4, 2.1, 1], [0.6, 1.2, 2.4], 40, -14), 0, true),
  k('both', 0.872, eye([-4.2, 4.6, -4.2], [4, 0.6, 5], 38, -27), -0.3, true),
  // S09 — up and out to the settled hero: the whole house in the right ~60 %.
  k('lift-out', 0.905, eye([6, 8.5, -11], [6, 1.5, 4.5], 36, -24), 0.2),
  k('hero', 0.955, fit(ground(6), 34, 27, 28), 0.5, true),
  k('rest', 1, fit(ground(6), 34, 27, 28, 1.0005), 0.5, true),
];
