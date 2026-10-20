/**
 * The shot list: what each camera waypoint frames, not where the camera is.
 *
 * Exterior shots `fit` a world box into the free part of the frame (framing.ts),
 * so they recompose for any aspect; interior shots stand at an `eye` point (eye
 * level 1.35–1.45 m, level, so verticals stay vertical) and look at a `focus`.
 * Positions come from house.ts / furniture.ts (metres, x = plan x, z = plan y,
 * street at z < 0). `hold` = screens spent arriving at zero speed and pushing in slowly (a read or a reveal).
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
  readonly shot: Shot;
  readonly rollDeg: number;
  /** Screens to hold this composition (≥ 0.4) with a slow push-in; absent = pass through. */
  readonly hold?: number;
  /** Push-in over the hold, as a share of the look distance (default 0.03). */
  readonly push?: number;
  /** Minimum screens for the move INTO this key, for choreography that needs time (the budget may give more). */
  readonly min?: number;
  /** The move into this key swings about the midpoint of the two looks (exterior orbit). */
  readonly orbit?: boolean;
  /** This scene's copy starts when the camera leaves the previous key. */
  readonly scene?: string;
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
type Opts = Omit<ShotKey, 'name' | 'shot' | 'rollDeg'>;
const k = (name: string, shot: Shot, rollDeg = 0, opts: Opts = {}): ShotKey => ({ name, shot, rollDeg, ...opts });

/**
 * Times are in SCREENS and only as authored minimums: `autoTime` (budget.ts) gives each move what the
 * motion budget needs. CAM-V replaces this list with the villa's; names are what state.ts anchors to.
 */
export const SHOTS: readonly ShotKey[] = [
  // S01 — near-orthographic long lens, the whole sheet right of the headline; leans oblique.
  k('sheet', fit(PLAN_SHEET, 0, 88, 13), 0, { hold: 0.5, push: 0.01 }),
  k('sheet-lean', fit(PLAN_SHEET, 4, 79, 14), 0.2, { min: 1.2 }),
  // S02 — ~10° of yaw, the lens opens.
  k('aligned', fit(PLAN_SHEET, 11, 66, 17), 0.4, { scene: 's02', min: 1.6, hold: 0.4 }),
  // S03 — a small orbit while the layers appear; the read holds while the labels are up.
  k('recognise', fit(ground(0.5), 18, 54, 21, 1.05), 0.6, { scene: 's03', min: 1.2, hold: 1.4, push: 0.02 }),
  // S04 — decelerate onto the gap in W7 between the two rooms; hold (a slow push) while it closes.
  k('gap-approach', fit(GAP_WIDE, 24, 50, 26), 0.4, { scene: 's04', min: 0.8 }),
  k('gap-hold', fit(GAP_ROOMS, 22, 52, 26, 1.25), 0.3, { hold: 1.6, push: 0.04 }),
  // S05 — pull back over the footprint while the walls rise, lateral orbit, settle on both storeys;
  // the storey and roof lift only inside the settle hold (one big motion at a time).
  k('hero-approach', fit(ground(1), 26, 44, 34), 0.4, { scene: 's05', min: 1 }),
  k('hero-orbit', fit(ground(3), 6, 34, 34), 0.6, { orbit: true, min: 2.4 }),
  k('hero-settle', fit(ground(8.4), -26, 28, 44, 0.95), -0.3, { orbit: true, min: 1.6, hold: 1.6 }),
  // S06 — walk in through D1, then one steady pan to the right: the living room towards O1, through O1
  // into the kitchen; then up and out over the front wall to the axonometric. (Cut from v1 for the
  // budget: the 153° living reversal, the O1/D2/hall spins and the bedroom rise, ~60 screens.)
  k('entry', eye([2.5, 1.8, -4.4], [2.5, 1.3, 2], 38, -3), 0, { scene: 's06' }),
  k('door', eye([2.5, 1.45, -0.2], [2.9, 1.3, 4], 40)),
  k('living', eye([3.1, 1.4, 1.1], [6.6, 1.1, 2.9], 46), 0, { hold: 0.7 }),
  k('kitchen', eye([6.6, 1.35, 1.55], [10.6, 0.9, 4.3], 44), 0, { hold: 0.7 }),
  // S07 — out and up; axonometric from the west-front over the cut walls (the storey comes down to a
  // slight lift inside the hold); then a slow push in on the stair connection (lifted clear for S08 there).
  k('axo', fit(ground(7.4), -52, 30, 44, 1.12), -0.5, { scene: 's07', hold: 1.4 }),
  k('stair-axo', fit(STAIR_LINK, -56, 25, 44), -0.4, { hold: 1.2 }),
  // S08 (upper lifted 5.2 m, walls cut at 1.2 m) — an elevated three-quarter look down from over the
  // kitchen at the hall/WC corner, D5 and its clear width centred; the stair in three-quarter from
  // the front-east, risers facing the camera; then a long-lens pull-back with both failures in view
  // (the storey comes back down inside that hold).
  k('wc-in', eye([10.2, 5.6, 0.6], D5_LOOK, 42, -37), 0.2, { scene: 's08' }),
  k('wc-look', eye([8.2, 4.6, 3.3], D5_LOOK, 42, -44), 0, { hold: 1 }),
  k('stair-look', eye([4.7, 2.5, -0.9], [0.6, 1.4, 2.4], 44, -12), 0, { hold: 1 }),
  k('both', eye([-9.5, 4.4, -11], [5.2, 0.6, 4.6], 34, -12), -0.3, { hold: 1.4 }),
  // S09 — up and out to the settled hero: the whole house in the right ~60 %; the last screen is a
  // 1.5 % push-in while the exports align, then rest.
  k('lift-out', eye([6, 8.5, -11], [6, 1.5, 4.5], 36, -24), 0.2, { scene: 's09' }),
  k('hero', fit(ground(6), 34, 27, 28), 0.5, { hold: 1.2, push: 0.015 }),
];
