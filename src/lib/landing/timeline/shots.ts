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
/** The drawing with its axis bubbles (2.3 m out, front and west) and the side annotations. */
const PLAN_SHEET: Box = [
  [-2.7, 0, -2.7],
  [14.6, 0, 10.6],
];
/** The gap in W7 (x 9.4–10.2) with the two rooms it separates, kitchen south and bedroom 2 north. */
const GAP_ROOMS: Box = [
  [7.4, 0, 1.4],
  [12.4, 0.3, 8.8],
];
const GAP_WIDE: Box = [
  [5.2, 0, 0],
  [12.6, 0.3, 9.4],
];
/** The flight on the west wall and the upper stairwell above it (upper lifted 1.2 m). */
const STAIR_LINK: Box = [
  [-0.3, 0, 0],
  [3.2, 5.6, 5],
];
/** Aimed a little left of D5 (x 6.5 z 6.5): the steep look-down projects the eye-shot pan short,
 * so this lands the door and its dimension mid free region. */
const D5_LOOK: Vec3 = [6.9, 0.9, 6.72];
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
  k('sheet', 0, fit(PLAN_SHEET, 0, 88, 13), 0, true),
  k('sheet-lean', 0.075, fit(PLAN_SHEET, 4, 79, 14), 0.2),
  // S02 — ~10° of yaw, the lens opens.
  k('aligned', 0.16, fit(PLAN_SHEET, 11, 66, 17), 0.4),
  // S03 — a small orbit while the layers appear (box leaves room for the explode).
  k('recognise', 0.24, fit(ground(0.5), 18, 54, 21, 1.05), 0.6),
  // S04 — decelerate onto the gap in W7 between the two rooms; hold (a slow push) while it closes.
  k('gap-approach', 0.318, fit(GAP_WIDE, 24, 50, 26), 0.4),
  k('gap-hold', 0.342, fit(GAP_ROOMS, 22, 52, 26, 1.25), 0.3, true),
  k('gap-closed', 0.376, fit(GAP_ROOMS, 21, 53, 26, 1.3), 0.3, true),
  // S05 — pull back over the footprint, lateral orbit, settle on both storeys (upper lifted).
  k('hero-approach', 0.43, fit(ground(1), 26, 44, 34), 0.4),
  k('hero-orbit', 0.49, fit(ground(3), 6, 34, 34), 0.6),
  k('hero-settle', 0.536, fit(ground(8.4), -26, 28, 44, 0.95), -0.3, true),
  // S06 — walk in through D1; living from the stair head towards the front (W1 left, sofa and O1
  // right), the O1 threshold, kitchen, D2, the hall.
  k('entry', 0.58, eye([2.5, 1.8, -4.4], [2.5, 1.3, 2], 38, -3)),
  k('door', 0.591, eye([2.5, 1.45, -0.2], [2.1, 1.3, 4], 40)),
  k('living', 0.603, eye([1.45, 1.35, 4.6], [3.9, 1.2, 0.6], 46), 0, true),
  k('o1', 0.62, eye([4.75, 1.4, 1.55], [10.6, 1.1, 2.8], 42), 0, true),
  k('kitchen', 0.637, eye([6.5, 1.35, 4.3], [10.6, 0.9, 0.6], 44), 0, true),
  k('d2', 0.652, eye([6.5, 1.4, 5.05], [6.6, 1.2, 8], 44)),
  k('hall-in', 0.659, eye([6.6, 1.4, 5.45], [4, 1.1, 6.2], 44)),
  // Up out of the open-topped hall (upper lifted 4 m): bedroom 1 over W9, then bedroom 2 from
  // over its east wall, looking west (outside the house on the left).
  k('bed1', 0.672, eye([7.2, 5.2, 5.75], [1.8, 0, 7], 44, -36), 0, true),
  k('bed2', 0.69, eye([12.4, 6.6, 7.6], [9.6, 1.2, 7], 46, -58), 0, true),
  k('exit', 0.706, eye([8.6, 5.8, -2.4], [3, 2, 4.5], 40, -24), -0.3),
  // S07 — axonometric from the west-front over the cut walls: the flight under the lifted upper
  // storey and the stairwell it reaches; then a slow push in on that connection.
  k('axo', 0.737, fit(ground(7.4), -52, 30, 44, 1.12), -0.5, true),
  k('stair-axo', 0.757, fit(STAIR_LINK, -56, 25, 44), -0.4),
  // S08 (upper lifted 5.2 m, walls cut at 1.2 m) — an elevated three-quarter look down from over the
  // kitchen at the hall/WC corner, D5 and its clear width centred, the hall and WC read as rooms;
  // the stair in three-quarter from the front-east, risers facing the camera; then a long-lens
  // pull-back from the west-front corner with both failures in view (the upper out of frame).
  k('wc-in', 0.79, eye([10.2, 5.6, 0.6], D5_LOOK, 42, -37), 0.2),
  k('wc-look', 0.806, eye([8.2, 4.6, 3.3], D5_LOOK, 42, -44), 0, true),
  k('wc-hold', 0.818, eye([8.1, 4.5, 3.5], D5_LOOK, 42, -45), 0, true),
  k('stair-look', 0.836, eye([4.7, 2.5, -0.9], [0.6, 1.4, 2.4], 44, -12), 0, true),
  k('stair-hold', 0.846, eye([4.55, 2.45, -0.75], [0.6, 1.4, 2.4], 44, -12), 0, true),
  k('both', 0.874, eye([-9.5, 4.4, -11], [5.2, 0.6, 4.6], 34, -12), -0.3, true),
  // S09 — up and out to the settled hero: the whole house in the right ~60 %.
  k('lift-out', 0.905, eye([6, 8.5, -11], [6, 1.5, 4.5], 36, -24), 0.2),
  k('hero', 0.955, fit(ground(6), 34, 27, 28), 0.5, true),
  k('rest', 1, fit(ground(6), 34, 27, 28, 1.0005), 0.5, true),
];
