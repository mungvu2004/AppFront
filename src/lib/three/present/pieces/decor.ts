/**
 * Decoration and light: rugs, pictures, vases, and every lamp on the plan.
 *
 * The lamps are the reason the scene reads as evening. Each carries its own
 * warm point source, and the warm pools they throw on floors and walls are what
 * the reference look is made of; the ceiling downlights in `lighting.ts` only
 * keep the rest from going black. Wall-hung pieces — a picture, a sconce — are
 * built standing on `y = 0` like everything else and lifted by the plan.
 */

import { box, cylinder, lampOn, pointLight, CEILING_HEIGHT, LAMP_INTENSITY, type PieceBuilder } from './primitives';

/**
 * What each lamp is worth when the light budget in `lighting.ts` is short, in
 * the units a downlight is measured in — square metres of floor lit. A pendant
 * over a table is a room's main light; a sconce is an accent.
 */
export const LAMP_PRIORITY = {
  pendant: 12,
  floorLamp: 4,
  tableLamp: 2,
  sconce: 1,
} as const;

/** Pale on purpose: a rug the colour of the boards under it is not there. */
export const rug: PieceBuilder = (group, { w, d }, m) => {
  const mat = box(w, 0.012, d, m.fabric);
  mat.castShadow = false;
  group.add(mat);
  group.add(box(w - 0.16, 0.004, d - 0.16, m.textile, 0, 0.012));
};

/** A framed picture: a dark frame, a pale mount and a panel of the accent colour. Lifted by the plan; hangs against `-z`. */
export const artwork: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.woodDark));
  group.add(box(w - 0.06, h - 0.06, d, m.linen, 0, 0.03, 0.004));
  group.add(box(w * 0.55, h * 0.55, d, m.accent, 0, h * 0.225, 0.008));
};

/** A vase with a few stems. Lifted by the plan onto whatever it stands on. */
export const vase: PieceBuilder = (group, { w, h }, m) => {
  const bodyHeight = h * 0.45;

  group.add(cylinder(w * 0.3, bodyHeight, m.clay, 0, 0, 0, w * 0.22));
  for (let stem = 0; stem < 3; stem += 1) {
    const lean = (stem - 1) * 0.12 * w;
    group.add(cylinder(0.004, h - bodyHeight, m.foliage, lean, bodyHeight, (stem % 2) * 0.02));
    group.add(cylinder(w * 0.12, w * 0.12, m.accent, lean, h - w * 0.12, (stem % 2) * 0.02, w * 0.06));
  }
};

export const floorLamp: PieceBuilder = (group, { w, h }, m) => {
  group.add(cylinder(w * 0.5, 0.02, m.metal));
  lampOn(group, m, 0, h - 0.28, w * 0.45, 0.28, LAMP_PRIORITY.floorLamp);
};

/**
 * Sits on whatever is under it — a nightstand, a balcony table — so the plan
 * gives it the *total* height and the lamp itself starts a little over half way up.
 */
export const tableLamp: PieceBuilder = (group, { w, h }, m) => {
  lampOn(group, m, h * 0.55, h * 0.2, w * 0.6, h * 0.25, LAMP_PRIORITY.tableLamp);
};

/** Hung from where the ceiling would be, over a table. */
export const pendant: PieceBuilder = (group, { w, h }, m) => {
  const shadeHeight = 0.22;

  group.add(cylinder(0.005, CEILING_HEIGHT - h, m.metal, 0, h));
  group.add(cylinder(w * 0.6, shadeHeight, m.lampShade, 0, h - shadeHeight, 0, w * 0.2));
  group.add(
    pointLight(m, 0, h - shadeHeight - 0.05, 0, LAMP_INTENSITY * 1.5, {
      surface: 'floor',
      radius: h * 0.9,
      height: 0,
      priority: LAMP_PRIORITY.pendant,
    }),
  );
};

/** A wall light: a bracket, a half-drum shade, and its glow. Lifted by the plan; hangs against `-z`. */
export const sconce: PieceBuilder = (group, { w, d, h }, m) => {
  group.add(box(w * 0.3, h * 0.3, d * 0.4, m.metal, 0, h * 0.35, -d * 0.3));
  group.add(cylinder(w / 2, h, m.lampShade, 0, 0, 0, w * 0.4));
  group.add(
    pointLight(m, 0, h / 2, d / 2 + 0.05, LAMP_INTENSITY * 0.7, {
      surface: 'wall',
      radius: h * 1.6,
      height: h / 2,
      priority: LAMP_PRIORITY.sconce,
    }),
  );
};
