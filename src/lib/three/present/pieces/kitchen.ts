/**
 * The kitchen: runs of cupboards, the hood, the hob, the sink, the fridge.
 *
 * A run is sized by the plan and reads as fitted because of two details the
 * builders add for free: a stone worktop that overhangs the doors by a
 * centimetre, and `doorFronts` grooves every 600 mm. Upper cupboards stand on
 * nothing — they hang at worktop-plus-splashback height and, given the height
 * the plan declares, reach the ceiling. The hood is placed with `liftMm` like
 * any other lifted piece and runs a chimney up through its declared height.
 */

import { box, cylinder, doorFronts, type PieceBuilder } from './primitives';

/** Where the underside of an upper run hangs: worktop plus splashback. */
export const UPPER_RUN_BASE = 1.5;

/** The worktop of a base run, and the height a hob or sink sits at. */
const WORKTOP_HEIGHT = 0.9;

export const baseRun: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h - 0.04, d - 0.02, m.paint, 0, 0, -0.01));
  group.add(box(w, 0.04, d + 0.02, m.stone, 0, h - 0.04, 0.01));
  group.add(box(w, 0.08, d - 0.06, m.cut, 0, 0, -0.03));
  doorFronts(group, m, w, h - 0.14, d / 2 - 0.02, 0.08, 0.6, h * 0.82);
};

/** Hung at splashback height; the plan's height says how far up it reaches. */
export const upperRun: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.paint, 0, UPPER_RUN_BASE));
  doorFronts(group, m, w, h - 0.04, d / 2, UPPER_RUN_BASE + 0.02, 0.6, UPPER_RUN_BASE + 0.12);
};

/**
 * A canopy over the hob with a chimney above it. Lifted by the plan, and the
 * plan's height is the whole thing, canopy and chimney, so a hood lifted to
 * `CEILING_HEIGHT - h` meets the ceiling exactly.
 */
export const hood: PieceBuilder = (group, { w, d, h }, m) => {
  const canopy = Math.min(0.16, h * 0.5);

  group.add(box(w, canopy * 0.4, d, m.metal));
  group.add(box(w * 0.9, canopy * 0.6, d * 0.85, m.metal, 0, canopy * 0.4, -d * 0.05));
  group.add(box(w * 0.35, h - canopy, d * 0.5, m.metal, 0, canopy, -d * 0.2));
};

export const hob: PieceBuilder = (group, { w, d }, m) => {
  group.add(box(w, 0.015, d, m.screen, 0, WORKTOP_HEIGHT));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(cylinder(Math.min(w, d) * 0.14, 0.006, m.metal, sx * w * 0.25, WORKTOP_HEIGHT + 0.015, sz * d * 0.25));
    }
  }
};

export const sink: PieceBuilder = (group, { w, d }, m) => {
  group.add(box(w, 0.02, d, m.metal, 0, WORKTOP_HEIGHT));
  group.add(box(w * 0.8, 0.01, d * 0.7, m.screen, 0, WORKTOP_HEIGHT + 0.02, 0.02));
  group.add(cylinder(0.012, 0.3, m.metal, 0, WORKTOP_HEIGHT, -d / 2 + 0.05));
  group.add(box(0.02, 0.02, 0.16, m.metal, 0, WORKTOP_HEIGHT + 0.28, -d / 2 + 0.12));
};

export const fridge: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.metal));
  group.add(box(w - 0.02, 0.006, 0.02, m.cut, 0, h * 0.62, d / 2));
  group.add(box(0.02, h * 0.3, 0.03, m.screen, w * 0.35, h * 0.66, d / 2));
  group.add(box(0.02, h * 0.2, 0.03, m.screen, w * 0.35, h * 0.38, d / 2));
};
