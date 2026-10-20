/**
 * Architectural furniture symbols for the ground plan, from `plan.furniture`.
 *
 * Each variant is drawn in a local frame — `u` across the piece's width, `v`
 * from its back (−d/2) to its front (+d/2) — then turned to its `facing` and
 * placed at its centre, so the symbols sit exactly where the 3D pieces later
 * stand and scene 03's brackets frame real drawings, not empty floor.
 */

import type { PlanFurniture, PresentationPlan } from '@/lib/three/present';

import { arc, circle, compass, dashes, groundLevelId, mm, p2, type P2 } from './geometry';

type Local = readonly [number, number];
type Draw = (w: number, d: number, h: number) => Local[][];

const rect = (u0: number, v0: number, u1: number, v1: number): Local[] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
  [u0, v0],
];

/** A rectangle with corners rounded by `r` (quarter arcs, 4 steps each). */
function rounded(u0: number, v0: number, u1: number, v1: number, r: number): Local[] {
  const q = Math.PI / 2;
  return [
    ...arc([u1 - r, v0 + r], r, -q, q, 4),
    ...arc([u1 - r, v1 - r], r, 0, q, 4),
    ...arc([u0 + r, v1 - r], r, q, q, 4),
    ...arc([u0 + r, v0 + r], r, 2 * q, q, 4),
    [u1 - r, v0],
  ];
}

const ellipse = (cu: number, cv: number, ru: number, rv: number, steps = 28): Local[] =>
  circle([0, 0], 1, steps).map((p): Local => [cu + p[0] * ru, cv + p[1] * rv]);

const box = (w: number, d: number): Local[] => rect(-w / 2, -d / 2, w / 2, d / 2);

const bed: Draw = (w, d) => {
  const out = [box(w, d), [[-w / 2, -d / 2 + 0.06], [w / 2, -d / 2 + 0.06]] as Local[]];
  const pillows = w >= 1.2 ? 2 : 1;
  const pw = (w - 0.12 - 0.06 * (pillows - 1)) / pillows;
  for (let i = 0; i < pillows; i++) {
    const u0 = -w / 2 + 0.06 + i * (pw + 0.06);
    out.push(rounded(u0, -d / 2 + 0.12, u0 + pw, -d / 2 + 0.44, 0.07));
  }
  // Duvet turned down at the pillows, one corner folded back.
  const fold = -d / 2 + 0.58;
  out.push([[-w / 2, fold], [w / 2, fold]], [[-w / 2, fold + 0.12], [w / 2, fold + 0.12]]);
  out.push([[w / 2, fold + 0.12 + 0.5], [w / 2 - 0.5, fold + 0.12]]);
  return out;
};

const sofa: Draw = (w, d) => {
  const arm = Math.min(0.2, w * 0.15);
  const back = Math.min(0.22, d * 0.25);
  const out: Local[][] = [rounded(-w / 2, -d / 2, w / 2, d / 2, 0.06)];
  out.push([[-w / 2 + arm, d / 2], [-w / 2 + arm, -d / 2 + back], [w / 2 - arm, -d / 2 + back], [w / 2 - arm, d / 2]]);
  const seats = w > 1.6 ? 3 : w > 1.1 ? 2 : 1;
  const sw = (w - 2 * arm) / seats;
  for (let i = 1; i < seats; i++) {
    const u = -w / 2 + arm + i * sw;
    out.push([[u, -d / 2 + back], [u, d / 2 - 0.03]]);
  }
  out.push([[-w / 2 + arm, d / 2 - 0.08], [w / 2 - arm, d / 2 - 0.08]]);
  return out;
};

const table: Draw = (w, d, h) =>
  h < 0.5 ? [rounded(-w / 2, -d / 2, w / 2, d / 2, 0.05), rect(-w / 2 + 0.07, -d / 2 + 0.07, w / 2 - 0.07, d / 2 - 0.07)] : [box(w, d)];

const chair: Draw = (w, d) => [
  rounded(-w / 2 + 0.03, -d / 2 + 0.12, w / 2 - 0.03, d / 2 - 0.08, 0.05),
  rounded(-w / 2, -d / 2 + 0.04, w / 2, -d / 2 + 0.12, 0.03),
];

const counter: Draw = (w, d) => [box(w, d), [[-w / 2, d / 2 - 0.04], [w / 2, d / 2 - 0.04]]];

const sink: Draw = (w, d) => [
  rounded(-w / 2 + 0.06, -d / 2 + 0.08, w / 2 - 0.06, d / 2 - 0.05, 0.06),
  ellipse(0, 0.02, 0.025, 0.025, 12),
  [[0, -d / 2 + 0.02], [0, -d / 2 + 0.12]],
];

const hob: Draw = (w, d) => [
  rect(-w / 2 + 0.02, -d / 2 + 0.03, w / 2 - 0.02, d / 2 - 0.03),
  ellipse(-w / 4, -d / 4 + 0.02, 0.1, 0.1),
  ellipse(w / 4, -d / 4 + 0.02, 0.075, 0.075),
  ellipse(-w / 4, d / 4 - 0.02, 0.075, 0.075),
  ellipse(w / 4, d / 4 - 0.02, 0.1, 0.1),
];

const fridge: Draw = (w, d) => [box(w, d), [[-w / 2, d / 2 - 0.07], [w / 2, d / 2 - 0.07]], [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, d / 2 - 0.11]]];

const wc: Draw = (w, d) => {
  const tank = 0.18;
  const bowl = (d - tank - 0.02) / 2;
  return [
    rounded(-w / 2, -d / 2, w / 2, -d / 2 + tank, 0.03),
    ellipse(0, -d / 2 + tank + bowl, w * 0.45, bowl),
    ellipse(0, -d / 2 + tank + bowl + 0.02, w * 0.3, bowl * 0.7),
  ];
};

const basin: Draw = (w, d) => [box(w, d), ellipse(0, 0.03, w * 0.34, d * 0.3), ellipse(0, -d / 2 + 0.06, 0.02, 0.02, 10)];

const wardrobe: Draw = (w, d) => {
  const out: Local[][] = [box(w, d), [[-w / 2 + 0.05, 0], [w / 2 - 0.05, 0]]];
  for (let u = -w / 2 + 0.18; u < w / 2 - 0.1; u += 0.22) {
    out.push([[u - 0.04, -d * 0.3], [u + 0.04, d * 0.3]]);
  }
  out.push([[-w / 2, d / 2 - 0.04], [0.05, d / 2 - 0.04]], [[-0.05, d / 2 - 0.08], [w / 2, d / 2 - 0.08]]);
  return out;
};

const nightstand: Draw = (w, d) => [box(w, d), ellipse(0, 0, 0.09, 0.09, 16)];

const tv: Draw = (w, d) => [box(w, d), rect(-w * 0.42, -d / 2 + 0.05, w * 0.42, -d / 2 + 0.1)];

const rug: Draw = (w, d) => {
  const c: Local[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return c.flatMap((a, i) => dashes(a, c[(i + 1) % 4] as Local, [0.12, 0.07]).map((s): Local[] => [s[0], s[1]]));
};

const plant: Draw = (w, d) => {
  const r = Math.min(w, d) / 2;
  const out: Local[][] = [circle([0, 0], r * 0.42, 20)];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3;
    const len = r * (0.85 + 0.15 * ((k * 3) % 2));
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const leaf: Local[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const s = Math.sin(t * Math.PI) * len * 0.16 * (i < 8 ? 1 : 0);
      leaf.push([ca * t * len - sa * s, sa * t * len + ca * s]);
    }
    for (let i = 7; i >= 1; i--) {
      const t = i / 8;
      const s = -Math.sin(t * Math.PI) * len * 0.16;
      leaf.push([ca * t * len - sa * s, sa * t * len + ca * s]);
    }
    leaf.push([0, 0]);
    out.push(leaf);
  }
  return out;
};

/** Plain carcass: box and a front line (dresser, sideboard, tv-stand, washer). */
const cabinet: Draw = (w, d) => [box(w, d), [[-w / 2, d / 2 - 0.05], [w / 2, d / 2 - 0.05]]];

const shelves: Draw = (w, d) => {
  const out: Local[][] = [box(w, d)];
  for (let u = -w / 2 + 0.3; u < w / 2 - 0.1; u += 0.3) {
    out.push([[u, -d / 2], [u, d / 2]]);
  }
  return out;
};

const shower: Draw = (w, d) => [
  box(w, d),
  [[-w / 2, -d / 2], [w / 2, d / 2]],
  [[w / 2, -d / 2], [-w / 2, d / 2]],
  ellipse(0, 0, 0.04, 0.04, 10),
];

const tub: Draw = (w, d) => [box(w, d), rounded(-w / 2 + 0.08, -d / 2 + 0.08, w / 2 - 0.08, d / 2 - 0.08, Math.min(w, d) * 0.3), ellipse(w / 2 - 0.2, 0, 0.03, 0.03, 10)];

const piano: Draw = (w, d) => {
  const out: Local[][] = [box(w, d), rect(-w / 2 + 0.05, d / 2 - 0.2, w / 2 - 0.05, d / 2 - 0.04)];
  for (let u = -w / 2 + 0.12; u < w / 2 - 0.08; u += 0.08) {
    out.push([[u, d / 2 - 0.2], [u, d / 2 - 0.1]]);
  }
  return out;
};

const washer: Draw = (w, d) => [box(w, d), ellipse(0, 0.02, Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 20)];

const stool: Draw = (w, d) => [ellipse(0, 0, Math.min(w, d) * 0.35, Math.min(w, d) * 0.35, 18)];

const lamp: Draw = (w, d) => {
  const r = Math.min(w, d) * 0.35;
  return [ellipse(0, 0, r, r, 20), [[-r, -r], [r, r]], [[r, -r], [-r, r]]];
};

/** Overhead or wall-hung pieces: dashed, the convention for things above the cut. */
const overhead: Draw = rug;

const artwork: Draw = (w, d) => [rect(-w / 2, -d / 2, w / 2, d / 2)];

const DRAW: Record<string, Draw> = {
  cabinet,
  shelves,
  shower,
  stool,
  floorLamp: lamp,
  pendant: overhead,
  hood: overhead,
  artwork,
  bed,
  sofa,
  armchair: sofa,
  table,
  desk: table,
  chair,
  baseRun: counter,
  sink,
  hob,
  fridge,
  wc,
  toilet: wc,
  basin,
  wardrobe,
  nightstand,
  tv,
  rug,
  plant,
};

/** Pascal models whose stand-in variant reads wrong in plan (a piano is not a cabinet). */
const BY_SLUG: Record<string, Draw> = { piano, bathtub: tub, 'washing-machine': washer };

const slugOf = (item: PlanFurniture): string => /\/items\/([^/]+)\//.exec(item.modelUrl ?? '')?.[1] ?? '';

/** One piece's symbol in plan metres: by model slug, then variant; unknown ones get their footprint. */
export function pieceSymbol(item: PlanFurniture): P2[][] {
  const f = compass(item.facing) ?? [0, 1];
  // `u` runs to the piece's left when seen from its front: across = (−f.z, f.x).
  const across: P2 = [-f[1], f[0]];
  const [cx, cz] = p2(item.centreMm);
  const w = mm(item.sizeMm[0] ?? 0);
  const d = mm(item.sizeMm[1] ?? 0);
  const h = mm(item.sizeMm[2] ?? 0);
  const draw = BY_SLUG[slugOf(item)] ?? DRAW[item.variant] ?? ((ww: number, dd: number) => [box(ww, dd)]);
  return draw(w, d, h).map((line) => line.map(([u, v]): P2 => [cx + across[0] * u + f[0] * v, cz + across[1] * u + f[1] * v]));
}

/** Ground-floor pieces, rugs first (the pen draws what lies underneath first). */
export function furnitureSymbols(plan: PresentationPlan): P2[][][] {
  const level = groundLevelId(plan);
  return plan.furniture
    .filter((item) => (item.levelId ?? level) === level)
    .sort((a, b) => Number(b.variant === 'rug') - Number(a.variant === 'rug'))
    .map(pieceSymbol);
}
