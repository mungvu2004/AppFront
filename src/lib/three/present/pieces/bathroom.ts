/**
 * Sanitaryware: the WC, the basin and its mirror, the shower enclosure.
 *
 * The shower is the piece that sells a bathroom in a cutaway: a tray, glass on
 * the front and both sides with a slim metal frame on every edge, a riser and a
 * rain head. The two sides that happen to meet walls are glass against plaster
 * and cost nothing to draw, which is why the builder does not need to know
 * which corner it stands in.
 */

import { box, cylinder, type PieceBuilder } from './primitives';

export const wc: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h * 0.5, d * 0.6, m.porcelain, 0, 0, d * 0.15));
  group.add(box(w * 0.9, 0.03, d * 0.55, m.paint, 0, h * 0.5, d * 0.17));
  group.add(box(w, h, d * 0.3, m.porcelain, 0, 0, -d / 2 + d * 0.15));
  group.add(box(w * 0.3, 0.02, 0.02, m.metal, 0, h - 0.04, -d / 2 + d * 0.3));
};

/** A vanity: a timber cupboard, a porcelain top with a bowl, and a tap. */
export const basin: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h - 0.05, d, m.wood));
  group.add(box(w + 0.02, 0.05, d + 0.02, m.porcelain, 0, h - 0.05));
  group.add(box(w * 0.45, 0.08, d * 0.6, m.porcelain, 0, h));
  group.add(cylinder(0.012, 0.2, m.metal, 0, h, -d / 2 + 0.06));
  group.add(box(0.02, 0.02, 0.1, m.metal, 0, h + 0.18, -d / 2 + 0.1));
};

/** A wall mirror with a lit border. Lifted by the plan; hangs against `-z`. */
export const mirror: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.lampShade));
  group.add(box(w - 0.06, h - 0.06, d, m.mirror, 0, 0.03, 0.003));
};

/** Tray, glass on three sides in a metal frame, a riser and a rain head. */
export const shower: PieceBuilder = (group, { w, d, h }, m) => {
  const pane = 0.01;
  const frame = 0.02;
  const paneHeight = h - 0.06;

  group.add(box(w, 0.03, d, m.porcelain));
  group.add(box(w, paneHeight, pane, m.glass, 0, 0.03, d / 2 - pane / 2));
  group.add(box(pane, paneHeight, d, m.glass, -w / 2 + pane / 2, 0.03, 0));
  group.add(box(pane, paneHeight, d, m.glass, w / 2 - pane / 2, 0.03, 0));

  // The frame: a post on each front corner, a rail along the top of every pane.
  for (const sx of [-1, 1]) {
    group.add(box(frame, paneHeight, frame, m.metal, sx * (w / 2 - frame / 2), 0.03, d / 2 - frame / 2));
    group.add(box(frame, frame, d, m.metal, sx * (w / 2 - frame / 2), paneHeight + 0.03 - frame, 0));
  }
  group.add(box(w, frame, frame, m.metal, 0, paneHeight + 0.03 - frame, d / 2 - frame / 2));

  group.add(cylinder(0.015, h - 0.1, m.metal, w / 2 - 0.1, 0.03, -d / 2 + 0.08));
  group.add(box(0.2, 0.02, 0.2, m.metal, w / 2 - 0.18, h - 0.1, -d / 2 + 0.18));
};
