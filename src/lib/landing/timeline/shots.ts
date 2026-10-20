/**
 * The shot list for the villa: what each camera waypoint frames, not where the camera is.
 *
 * Exterior shots `fit` a world box into the free part of the frame (framing.ts), so they
 * recompose for any aspect; `eye` shots stand at a point and look towards a focus (level
 * or a set pitch). Scene units: x = plan x, z = plan y (street at z 0, plot 40 x 34 m),
 * ground floor x 4-28 z 9-21, koi pond x 13-27 z 25-32 behind the living wing G2
 * (x 16-28 z 15-21, glazed north wall SL1), main door D1 on the front wall at x 13.
 *
 * Two turning directions, changed once inside a hold: up to the hero settle the camera
 * swings left round the south-east (steep views, so the yaw is cheap); from the street
 * three-quarter on it only turns right - a descending arc to the gate, in through D1, one
 * interior hold looking through O3 and SL1 to the pond, up and out over the veranda to the
 * stepped section from the north-west, both failing checks in one view from the north, and
 * the garden-side hero over the koi pond. Consecutive shots keep similar look distances (the
 * budget prices zoom as |Δd|/d), so the far/near jumps that used to cost 5-9 screens each are
 * gone. Screens are minimums: `autoTime` gives each move what the motion budget needs, holds
 * are intervals with a slow push-in.
 */

import type { Vec3 } from '../types';

import type { Shot } from './framing';

export interface ShotKey {
  readonly name: string;
  readonly shot: Shot;
  readonly rollDeg: number;
  /** Screens to hold this composition (>= 0.4) with a slow push-in; absent = pass through. */
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
/** The whole site plan: plot, boundary walls and the drawing's margin. */
const SITE: Box = [
  [-1, -0.45, -1.5],
  [41, -0.45, 35],
];
/** The ground-floor footprint (the AI layers, the review). */
const GROUND: Box = [
  [3.5, 0, 8.5],
  [28.5, 0.5, 21.5],
];
/** The gap in W10 (x 16, z 11.4-12.6) with the foyer west and the family room east. */
const GAP_WIDE: Box = [
  [8, 0, 7.5],
  [24, 0.3, 16.5],
];
const GAP_ROOMS: Box = [
  [10, 0, 9],
  [22, 0.3, 15],
];
/** The villa while the ground floor rises, then all three storeys under their eaves. */
const VILLA_LOW: Box = [
  [2, 0, 6],
  [30, 3.4, 25],
];
const VILLA: Box = [
  [2.2, 0, 7.2],
  [29.8, 11, 24.8],
];
/** The estate from the west: house, pond and the garden round it. */
const ESTATE: Box = [
  [0, -0.45, 3],
  [36, 11, 34],
];
/** The stepped section: three cut storeys lifted apart, roofs away. */
const SECTION: Box = [
  [3.5, 0, 8.5],
  [28.5, 14, 23.5],
];
/** The garden side for the finale: house, pergola, pond, lawn. */
const GARDEN: Box = [
  [2, -0.45, 7],
  [30, 11, 33],
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

/** Times are in SCREENS (minimums); names are what choreo.ts anchors to. */
export const SHOTS: readonly ShotKey[] = [
  // S01 - the whole site plan, near-orthographic long lens, right of the headline; leans oblique.
  k('sheet', fit(SITE, 0, 88, 13), 0, { hold: 0.5, push: 0.01 }),
  k('sheet-lean', fit(SITE, 4, 78, 14), 0.2, { min: 1.2 }),
  // S02 - ~10 degrees of yaw, the lens opens.
  k('aligned', fit(SITE, 11, 64, 17), 0.4, { scene: 's02', min: 1.6, hold: 0.4 }),
  // S03 - closer on the ground floor while the layers appear; hold while the labels are up.
  k('recognise', fit(GROUND, 18, 54, 21, 1.05), 0.6, { scene: 's03', min: 1.2, hold: 1.2, push: 0.02 }),
  // S04 - decelerate onto the gap in W10 between foyer and family room; hold while it closes.
  k('gap-approach', fit(GAP_WIDE, 22, 50, 24), 0.4, { scene: 's04', min: 0.8 }),
  k('gap-hold', fit(GAP_ROOMS, 24, 52, 26, 1.25), 0.3, { hold: 1.4, push: 0.04 }),
  // S05 - the hero build, one orbit from the south-east: ground walls rise, then the upper storeys
  // and roofs; the roofs land, the planting grows and the pond fills in the settle hold.
  k('hero-rise', fit(VILLA_LOW, 30, 44, 30, 1.35), 0.4, { scene: 's05', min: 1.2 }),
  k('hero-orbit', fit(VILLA, 45, 34, 34), 0.6, { orbit: true, min: 1.8 }),
  k('hero-settle', fit(ESTATE, 58, 30, 36, 1.05), 0.2, { orbit: true, min: 1.4, hold: 1.2 }),
  // S06 - down to the street three-quarter at the gate (ref 0.jpg), then in along the stone path
  // and through D1; from here on the camera only turns right.
  k('street', eye([29, 2.2, -8], [14.5, 3.6, 14], 46, 2), 0, { scene: 's06', hold: 0.4, orbit: true }),
  k('entry', eye([13, 1.7, 2.2], [13.1, 1.5, 12], 46, -1)),
  k('door', eye([12.75, 1.5, 8], [14.6, 1.35, 14], 46)),
  // One interior hold, standing in the dining room: through O3 into the living room and through
  // SL1 to the pond. The upper storeys and roofs lift away above the closed ceiling, then the walls
  // cut and the ceiling opens, all inside this hold.
  k('living', eye([12.6, 1.45, 16.4], [24.5, 1.1, 25.5], 48), 0, { hold: 2 }),
  // S07 - up through the open ceiling and out over the cut glass wall SL2 to the veranda, turning
  // right to look back at the stepped section from the north-west (the garden side), under the
  // lifted storeys.
  k('rise-out', eye([14.6, 3.5, 21.9], [30, 0.8, 25.5], 44, -22), 0.2),
  k('section', fit(SECTION, -134, 30, 36, 1.7), -0.3, { scene: 's07', hold: 1.2 }),
  // S08 - one composition from the north for both failing checks: the WC door D-G10 (east) and
  // STAIR-1 (west), seen under the lifted storeys across the cut ground floor.
  k('checks', eye([10.2, 9.4, 33], [19, 1.3, 12.1], 40, -20), 0, { scene: 's08', hold: 1.4 }),
  // S09 - the garden-side hero over the koi pond (ref 4.jpg, raised): the pond, the island, the
  // pergola and the glazed living wing; storeys and roofs come home in the hold, exports align.
  k('hero', fit(GARDEN, -172, 26, 34, 1), 0.5, { scene: 's09', hold: 1.6, push: 0.015 }),
];
