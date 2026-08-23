/**
 * Tables and cupboards: the timber and painted carcasses of a home.
 *
 * Fitted storage in the reference look is white and flush — a wardrobe is a
 * painted wall with fine grooves and bar handles, not a timber box — so the
 * wardrobe and cabinet take the paint material and get their doors from
 * `doorFronts`. Shelving is open and carries a few books in the accent colour,
 * which is the cheapest detail that makes a study read as a study.
 */

import { box, cylinder, doorFronts, legs, type PieceBuilder } from './primitives';

export const table: PieceBuilder = (group, size, m) => {
  group.add(box(size.w, 0.04, size.d, m.wood, 0, size.h - 0.04));
  legs(group, size, size.h - 0.04, m.woodDark, 0.06);
};

/** A small round table: a disc on a column on a disc. */
export const sideTable: PieceBuilder = (group, { w, h }, m) => {
  const radius = w / 2;

  group.add(cylinder(radius * 0.7, 0.02, m.metal));
  group.add(cylinder(0.02, h - 0.05, m.metal, 0, 0.02));
  group.add(cylinder(radius, 0.03, m.wood, 0, h - 0.03));
};

export const nightstand: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.wood));
  group.add(box(w * 0.8, 0.015, 0.015, m.metal, 0, h * 0.55, d / 2));
};

/** A low painted cupboard — a shoe cabinet by the door, a sideboard. */
export const cabinet: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h - 0.03, d, m.paint, 0, 0.03));
  group.add(box(w + 0.02, 0.03, d + 0.02, m.wood, 0, h - 0.03));
  doorFronts(group, m, w, h - 0.06, d / 2, 0.03, 0.45, h * 0.6);
};

/** A fitted wardrobe: a painted carcass, floor to its full height, doors across. */
export const wardrobe: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.paint));
  doorFronts(group, m, w, h - 0.04, d / 2, 0.02, 0.5, h * 0.45);
};

/** Open shelving with a back, a few shelves, and books leaning on them. */
export const shelves: PieceBuilder = (group, { w, d, h }, m) => {
  const shelfCount = Math.max(2, Math.round(h / 0.38));
  const bay = h / shelfCount;
  const side = 0.025;

  group.add(box(w, h, 0.02, m.paint, 0, 0, -d / 2 + 0.01));
  group.add(box(side, h, d, m.paint, -w / 2 + side / 2));
  group.add(box(side, h, d, m.paint, w / 2 - side / 2));

  for (let index = 0; index <= shelfCount; index += 1) {
    const y = Math.min(index * bay, h - 0.02);
    group.add(box(w, 0.02, d, m.paint, 0, y));
  }

  // A run of books on every other shelf, spines out, one in the accent colour.
  for (let index = 0; index < shelfCount; index += 2) {
    const y = index * bay + 0.02;
    const count = Math.max(2, Math.floor((w - side * 2) / 0.09));
    for (let book = 0; book < count; book += 1) {
      const x = -w / 2 + side + 0.06 + book * 0.075;
      const material = book % 3 === 1 ? m.accent : book % 3 === 2 ? m.woodDark : m.screen;
      group.add(box(0.03 + (book % 2) * 0.015, bay * (0.55 + (book % 3) * 0.1), d * 0.6, material, x, y, 0));
    }
  }
};

/** A long low media unit against a wall, with the screen hung on the wall above it. */
export const tv: PieceBuilder = (group, { w, d, h }, m) => {
  const unitHeight = Math.min(0.45, h * 0.35);
  const screenWidth = Math.min(w * 0.75, 1.6);
  const screenHeight = screenWidth * 0.56;
  const screenBase = unitHeight + (h - unitHeight - screenHeight) * 0.55;

  group.add(box(w, unitHeight, d, m.wood, 0, 0.06));
  group.add(box(w * 0.9, 0.06, d * 0.8, m.woodDark, 0, 0, -0.02));
  doorFronts(group, m, w, unitHeight - 0.02, d / 2, 0.07, 0.6, unitHeight * 0.55);
  group.add(box(screenWidth, screenHeight, 0.03, m.screen, 0, screenBase, -d / 2 + 0.05));
};
