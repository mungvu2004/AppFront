/**
 * Plants: the potted kind, bamboo, a flowering shrub, and a planter of hedge.
 *
 * A plant in a cutaway has to read as foliage from three metres up, which is a
 * question of silhouette rather than leaves: a few flattened, overlapping
 * heads at different heights, leaning out from a stem, do it; one sphere does
 * not. Bamboo is the opposite — thin stems with small heads near the top — and
 * the two together are most of what makes a balcony look planted. A canopy
 * is two tiers — a ring of heads round the crown and a smaller ring above
 * it — so it has an inside and an outside rather than one silhouette. Every
 * canopy is clamped so a squat, wide plant never dips below its own pot.
 */

import { noise } from '../textures';

import { box, cone, cylinder, sphere, type PieceBuilder } from './primitives';

/** How much smaller, and how much higher, the upper tier of a canopy is. */
const UPPER_TIER_SCALE = 0.55;
const UPPER_TIER_LIFT = 0.45;

/** Heads of foliage around a stem in two tiers, leaning outwards, each a squashed sphere. */
function canopy(
  group: Parameters<PieceBuilder>[0],
  m: Parameters<PieceBuilder>[2],
  x: number,
  crown: number,
  z: number,
  radius: number,
  heads: number,
  seed: number,
): void {
  group.add(sphere(radius, m.foliage, x, crown, z, 0.75));
  for (let head = 0; head < heads; head += 1) {
    const angle = (head / heads) * Math.PI * 2 + noise(seed + head) * 0.8;
    const reach = radius * (0.55 + noise(seed + head * 3) * 0.25);
    group.add(
      sphere(
        radius * 0.62,
        m.foliage,
        x + Math.cos(angle) * reach,
        crown - radius * 0.15 - noise(seed + head * 7) * radius * 0.35,
        z + Math.sin(angle) * reach,
        0.7,
      ),
    );
  }
  const upper = Math.max(2, Math.ceil(heads / 2));
  for (let head = 0; head < upper; head += 1) {
    const angle = (head / upper) * Math.PI * 2 + noise(seed + 11 + head) * 1.2;
    const reach = radius * (0.3 + noise(seed + head * 5) * 0.2);
    group.add(
      sphere(
        radius * UPPER_TIER_SCALE,
        m.foliage,
        x + Math.cos(angle) * reach,
        crown + radius * UPPER_TIER_LIFT - noise(seed + head * 9) * radius * 0.2,
        z + Math.sin(angle) * reach,
        0.7,
      ),
    );
  }
}

/** How far the soil stands proud of a pot's rim: enough that the two faces never share a pixel. */
const SOIL_PROUD = 0.006;

/** A tapered pot, standing on the floor, with its soil just proud of the rim. */
function pot(
  group: Parameters<PieceBuilder>[0],
  m: Parameters<PieceBuilder>[2],
  radius: number,
  height: number,
): void {
  group.add(cylinder(radius * 0.78, height, m.clay, 0, 0, 0, radius));
  group.add(cylinder(radius * 0.9, SOIL_PROUD * 2, m.cut, 0, height - SOIL_PROUD, 0, radius * 0.9));
}

/** A rectangular trough, standing on the floor, with its soil just proud of the rim. */
function trough(
  group: Parameters<PieceBuilder>[0],
  m: Parameters<PieceBuilder>[2],
  w: number,
  d: number,
  height: number,
): void {
  group.add(box(w, height, d, m.clay));
  group.add(box(w - 0.05, SOIL_PROUD * 2, d - 0.05, m.cut, 0, height - SOIL_PROUD));
}

/** A leafy pot plant: a stem with a few broad leaves and a canopy of heads. */
export const plant: PieceBuilder = (group, { w, h }, m) => {
  const potHeight = Math.min(0.4, h * 0.3);
  const potRadius = w * 0.4;
  const radius = Math.min(w * 0.5, (h - potHeight) * 0.4);
  const crown = h - radius * 0.55;

  pot(group, m, potRadius, potHeight);
  group.add(cylinder(0.02, crown - potHeight, m.woodDark, 0, potHeight));

  // Long leaves leaning out from the stem like a palm's fronds: a low ring
  // of five and a shorter, steeper ring of four between them.
  for (const [count, lengthScale, heightScale, tilt, turn] of [
    [5, 1.1, 0.55, -1.1, 0.4],
    [4, 0.8, 0.75, -0.8, 1.2],
  ] as const) {
    for (let leaf = 0; leaf < count; leaf += 1) {
      const angle = (leaf / count) * Math.PI * 2 + turn;
      const length = radius * lengthScale;
      group.add(
        cone(
          radius * 0.16,
          length,
          m.foliage,
          Math.cos(angle) * length * 0.35,
          potHeight + (crown - potHeight) * heightScale,
          Math.sin(angle) * length * 0.35,
          tilt,
          angle + Math.PI / 2,
        ),
      );
    }
  }

  canopy(group, m, 0, crown, 0, radius, 4, 3);
};

/** A clump of bamboo in a trough: thin tall canes with small heads near the top. */
export const bamboo: PieceBuilder = (group, { w, d, h }, m) => {
  const troughHeight = Math.min(0.35, h * 0.18);
  const canes = Math.max(4, Math.round(w / 0.12));

  trough(group, m, w, d, troughHeight);

  for (let cane = 0; cane < canes; cane += 1) {
    const x = (noise(cane * 5 + 1) - 0.5) * (w - 0.1);
    const z = (noise(cane * 11 + 2) - 0.5) * (d - 0.1);
    const height = h * (0.7 + noise(cane * 3) * 0.3);
    const lean = (noise(cane * 17) - 0.5) * 0.1;

    const stem = cylinder(0.012, height - troughHeight, m.foliage, x, troughHeight, z);
    stem.rotation.z = lean;
    group.add(stem);

    // Leaves: three small flat heads spread along the upper third of the cane.
    for (let tuft = 0; tuft < 3; tuft += 1) {
      const y = troughHeight + (height - troughHeight) * (0.62 + tuft * 0.15);
      const reach = 0.05 + tuft * 0.03;
      group.add(sphere(0.07, m.foliage, x + reach * Math.cos(cane + tuft), y, z + reach * Math.sin(cane + tuft), 0.35, 1.6));
    }
  }
};

/** A low flowering shrub in a pot: a mound of heads with accent blooms on top. */
export const shrub: PieceBuilder = (group, { w, h }, m) => {
  const potHeight = Math.min(0.25, h * 0.35);
  const radius = Math.min(w * 0.5, (h - potHeight) * 0.6);
  const crown = potHeight + radius * 0.6;

  pot(group, m, w * 0.38, potHeight);
  canopy(group, m, 0, crown, 0, radius, 5, 9);

  for (let bloom = 0; bloom < 6; bloom += 1) {
    const angle = (bloom / 6) * Math.PI * 2 + noise(bloom + 20);
    const reach = radius * (0.3 + noise(bloom + 30) * 0.5);
    group.add(sphere(radius * 0.14, m.accent, Math.cos(angle) * reach, crown + radius * 0.45, Math.sin(angle) * reach));
  }
};

/** A long trough along a railing, hedged: a row of heads the length of it. */
export const planter: PieceBuilder = (group, { w, d, h }, m) => {
  const troughHeight = Math.min(0.45, h * 0.5);
  const radius = Math.min(d * 0.6, (h - troughHeight) * 0.7);
  const heads = Math.max(2, Math.round(w / (radius * 1.2)));

  trough(group, m, w, d, troughHeight);

  for (let head = 0; head < heads; head += 1) {
    const x = -w / 2 + (w / heads) * (head + 0.5);
    const bump = noise(head * 13 + 40) * radius * 0.25;
    group.add(sphere(radius, m.foliage, x, troughHeight + radius * 0.6 + bump, (noise(head) - 0.5) * d * 0.3, 0.85));
  }
};
