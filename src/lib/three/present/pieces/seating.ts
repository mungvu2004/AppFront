/**
 * Things to sit and lie on: sofas, chairs, benches, stools, loungers, beds.
 *
 * Each is a builder in the catalogue's frame — `x` across, `y` up, `+z` the
 * front, standing on `y = 0` — sized from the plan's width × depth × height.
 * Upholstery is where a cutaway reads as *lived in*, so the soft pieces carry
 * more parts than the rest: a sofa has separate seat and back cushions and a
 * throw pillow or two in the accent colour; a bed has a padded headboard, a
 * turned-down duvet, a folded throw and stacked pillows.
 */

import { Mesh, BoxGeometry } from 'three';

import { box, cylinder, legs, type PieceBuilder } from './primitives';

/** A throw pillow is a slightly turned box; alternate ones take the accent colour. */
const PILLOW_TURN_RAD = 0.3;

export const sofa: PieceBuilder = (group, { w, d, h }, m) => {
  const seatHeight = h * 0.5;
  const armWidth = Math.min(0.18, w * 0.12);
  const backDepth = d * 0.22;
  const inner = w - armWidth * 2;
  const cushions = Math.max(1, Math.round(inner / 0.75));
  const cushionWidth = inner / cushions;

  group.add(box(w, seatHeight - 0.08, d, m.fabric));
  group.add(box(w, h, backDepth, m.fabric, 0, 0, -d / 2 + backDepth / 2));
  group.add(box(armWidth, h * 0.72, d, m.fabric, -w / 2 + armWidth / 2));
  group.add(box(armWidth, h * 0.72, d, m.fabric, w / 2 - armWidth / 2));

  for (let index = 0; index < cushions; index += 1) {
    const x = -w / 2 + armWidth + cushionWidth * (index + 0.5);

    // Seat cushion, then a back cushion standing on it against the backrest.
    group.add(box(cushionWidth - 0.03, 0.12, d - backDepth - 0.05, m.linen, x, seatHeight - 0.08, backDepth / 2));
    group.add(
      box(cushionWidth - 0.05, h - seatHeight - 0.04, 0.13, m.fabric, x, seatHeight + 0.04, -d / 2 + backDepth + 0.07),
    );

    // A throw pillow at each end, the accent colour on every other one.
    if (index === 0 || index === cushions - 1) {
      const side = Math.min(0.45, cushionWidth * 0.55);
      const pillow = box(side, side, 0.1, index % 2 === 0 ? m.accent : m.textile, x, seatHeight + 0.04, -d / 2 + backDepth + 0.2);
      pillow.rotation.y = index === 0 ? PILLOW_TURN_RAD : -PILLOW_TURN_RAD;
      group.add(pillow);
    }
  }
};

/** A dining chair with a padded seat and back on a timber frame. */
export const chair: PieceBuilder = (group, size, m) => {
  const seatHeight = size.h * 0.5;

  group.add(box(size.w, 0.04, size.d, m.wood, 0, seatHeight - 0.04));
  group.add(box(size.w - 0.04, 0.05, size.d - 0.04, m.textile, 0, seatHeight));
  group.add(box(size.w - 0.08, size.h - seatHeight - 0.05, 0.04, m.wood, 0, seatHeight, -size.d / 2 + 0.03));
  group.add(box(size.w - 0.1, (size.h - seatHeight) * 0.55, 0.05, m.textile, 0, size.h * 0.72, -size.d / 2 + 0.06));
  legs(group, size, seatHeight - 0.04, m.woodDark, 0.03);
};

/** A bench: a long padded seat on a timber base. */
export const bench: PieceBuilder = (group, size, m) => {
  group.add(box(size.w, 0.05, size.d, m.wood, 0, size.h - 0.1));
  group.add(box(size.w - 0.02, 0.05, size.d - 0.02, m.textile, 0, size.h - 0.05));
  legs(group, size, size.h - 0.1, m.woodDark, 0.05);
};

/** A bar stool: a round padded seat on a single metal column and a foot ring. */
export const stool: PieceBuilder = (group, { w, h }, m) => {
  const radius = w / 2;

  group.add(cylinder(radius * 0.8, 0.02, m.metal));
  group.add(cylinder(0.02, h - 0.08, m.metal, 0, 0.02));
  group.add(cylinder(radius * 0.6, 0.015, m.metal, 0, h * 0.35, 0, radius * 0.6));
  group.add(cylinder(radius, 0.06, m.textile, 0, h - 0.06, 0, radius * 0.95));
};

/** A sun lounger: a slatted timber base, a long cushion and a reclined back. */
export const lounger: PieceBuilder = (group, { w, d, h }, m) => {
  const seatHeight = h * 0.4;
  const backLength = d * 0.4;
  const recline = -0.95;

  group.add(box(w - 0.06, seatHeight - 0.08, d - 0.1, m.woodDark));
  group.add(box(w, 0.08, d * 0.6, m.textile, 0, seatHeight - 0.08, d * 0.2));

  // The back is a second cushion, hinged at the seat's far end and leant well back.
  const back = new Mesh(new BoxGeometry(w, backLength, 0.08), m.textile);
  back.position.set(0, seatHeight - 0.04, -d * 0.1);
  back.rotation.x = recline;
  back.translateY(backLength / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);
};

/** A bed, made: padded headboard, low frame, mattress, duvet, throw and pillows. */
export const bed: PieceBuilder = (group, { w, d, h }, m) => {
  const frameHeight = h * 0.4;
  const mattressTop = h;
  const headboardHeight = h + 0.55;

  group.add(box(w + 0.1, frameHeight, d + 0.1, m.woodDark, 0, 0, 0.05));
  group.add(box(w, h - frameHeight, d, m.linen, 0, frameHeight));
  group.add(box(w + 0.16, headboardHeight, 0.1, m.fabric, 0, 0, -d / 2 - 0.05));

  // The duvet covers the foot two thirds, turned down short of the pillows.
  group.add(box(w + 0.03, 0.08, d * 0.62, m.linen, 0, mattressTop - 0.02, d * 0.17));
  // A folded throw across the foot in the accent colour.
  group.add(box(w + 0.05, 0.05, d * 0.22, m.accent, 0, mattressTop + 0.06, d * 0.3));

  // Two sleeping pillows at the head, two small cushions stood in front of them.
  for (const sx of [-1, 1]) {
    group.add(box(w * 0.4, 0.12, d * 0.18, m.linen, sx * w * 0.24, mattressTop, -d / 2 + d * 0.13));
    group.add(box(w * 0.24, 0.2, 0.08, m.textile, sx * w * 0.24, mattressTop + 0.02, -d / 2 + d * 0.26));
  }
};
