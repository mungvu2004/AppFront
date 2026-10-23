/**
 * The site plan on the same sheet as the ground floor, from `house.site` and
 * `house.roofs`: every record inked the way a site plan reads, fine lines under
 * the heavy cut walls.
 *
 * - boundary walls are cut like the house walls: poché + face lines, gates left
 *   open (the joint solver and the opening cut are the house's own, via a small
 *   plan of the site walls), gate leaves as a slide line or swing arcs;
 * - ground: path and stepping slabs, steps with nosings, paving outlines with
 *   their joints, beds and the island edged, lawn as a fine stipple (lawns meet
 *   edge to edge, so their outlines would draw lines that are not there);
 * - pond: water edge + coping edge (double line), a broken water hatch, lotus;
 * - planting: trees as scalloped canopies with a centre cross and leaf hints,
 *   palms as fronds, hedges as scalloped bands; boulders, stone tables, stools,
 *   path lights, the car and its bay;
 * - overhead: roof eaves and canopies dashed (the "mái đua" convention), with
 *   the columns that carry them.
 *
 * All polylines in scene metres on the floor plane; `P2 = [x, z]`.
 */

import type { LandingHouse, Polygon, SiteItem, SitePlant } from '@/lib/landing/types';
import type { PresentationPlan } from '@/lib/three/present';

import { add, arc, circle, compass, cross, dashes, lerp2, mm, p2, sub, wallFaces, type P2 } from './geometry';
import { pocheShapes } from './poche';

export interface SiteInk {
  /** Fine ground and planting work. */
  readonly fine: P2[][];
  /** Boundary wall faces and gate leaves. */
  readonly walls: P2[][];
  /** Eaves and canopies, already dashed; column marks. */
  readonly overhead: P2[][];
  /** Cut boundary walls for the poché. */
  readonly poche: P2[][];
}

const ROOF_DASH = [0.5, 0.25];
const CANOPY_DASH = [0.25, 0.18];
const WATER_PITCH = 0.7;
const WATER_DASH = [0.7, 0.45, 0.3, 1.1];
/** Lawn stipple: one dot per this many square metres. */
const STIPPLE_M2 = 0.55;
/** Hedge depth as a share of its length (the Pascal bush is about 3 : 1). */
const HEDGE_DEPTH = 0.34;

const poly = (outline: Polygon): P2[] => outline.map(p2);
const closed = (pts: readonly P2[]): P2[] => [...pts, pts[0] as P2];

function inside(p: P2, pts: readonly P2[]): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i] as P2;
    const b = pts[j] as P2;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      hit = !hit;
    }
  }
  return hit;
}

const signedArea = (pts: readonly P2[]): number =>
  pts.reduce((sum, a, i) => sum + cross(a, pts[(i + 1) % pts.length] as P2), 0) / 2;

/** The polygon grown outwards by `d` with mitred corners. */
export function offsetPolygon(pts: readonly P2[], d: number): P2[] {
  const k = signedArea(pts) > 0 ? -1 : 1;
  const normal = (a: P2, b: P2): P2 => {
    const e = sub(b, a);
    const l = Math.hypot(e[0], e[1]) || 1;
    return [(k * -e[1]) / l, (k * e[0]) / l];
  };
  return pts.map((v, i) => {
    const n0 = normal(pts[(i + pts.length - 1) % pts.length] as P2, v);
    const n1 = normal(v, pts[(i + 1) % pts.length] as P2);
    const s = d / Math.max(0.2, 1 + n0[0] * n1[0] + n0[1] * n1[1]);
    return [v[0] + (n0[0] + n1[0]) * s, v[1] + (n0[1] + n1[1]) * s];
  });
}

/** Deterministic 0..1 sequence. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A closed outline round `c` whose radius bulges in `n` scallops. */
function scalloped(c: P2, ru: number, rv: number, turn: number, n: number): P2[] {
  const steps = n * 6;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    const bulge = 0.84 + 0.16 * Math.abs(Math.sin((t * n) / 2));
    const u = Math.cos(t) * ru * bulge;
    const v = Math.sin(t) * rv * bulge;
    return [c[0] + u * cos - v * sin, c[1] + u * sin + v * cos];
  });
}

function plantInk(plant: SitePlant, out: P2[][]): void {
  const c = p2(plant.at);
  const r = mm(plant.canopyMm);
  if (plant.slug === 'bush') {
    const turn = (plant.rotationDeg * Math.PI) / 180;
    out.push(scalloped(c, r, r * HEDGE_DEPTH, turn, Math.max(6, Math.round((r * 2) / 0.45))));
    return;
  }
  if (plant.slug === 'palm') {
    out.push(circle(c, Math.min(0.2, r * 0.1), 12));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.2;
      const tip: P2 = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
      const bend: P2 = add(lerp2(c, tip, 0.6), [-Math.sin(a), Math.cos(a)], r * 0.08);
      out.push([c, bend, tip]);
    }
    return;
  }
  out.push(scalloped(c, r, r, 0, Math.max(7, Math.round((Math.PI * 2 * r) / 1.1))));
  const x = Math.min(0.35, r * 0.18);
  out.push([add(c, [-x, 0]), add(c, [x, 0])], [add(c, [0, -x]), add(c, [0, x])]);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    out.push(arc(add(c, [Math.cos(a), Math.sin(a)], r * 0.55), r * 0.2, a + 1.2, 1.6, 6));
  }
}

function itemInk(item: SiteItem, out: P2[][]): void {
  const f = compass(item.facing) ?? [0, 1];
  const across: P2 = [-f[1], f[0]];
  const c = p2(item.at);
  const w = mm(item.sizeMm[0]);
  const d = mm(item.sizeMm[1]);
  const local = (u: number, v: number): P2 => [c[0] + across[0] * u + f[0] * v, c[1] + across[1] * u + f[1] * v];
  const box = (u0: number, v0: number, u1: number, v1: number): P2[] => closed([local(u0, v0), local(u1, v0), local(u1, v1), local(u0, v1)]);
  switch (item.kind) {
    case 'boulder': {
      const rnd = random(Math.round(c[0] * 131 + c[1] * 17) + 3);
      const pts = Array.from({ length: 9 }, (_, i): P2 => {
        const a = (i / 9) * Math.PI * 2;
        const k = 0.78 + 0.22 * rnd();
        return [c[0] + Math.cos(a) * (w / 2) * k, c[1] + Math.sin(a) * (d / 2) * k];
      });
      out.push(closed(pts), [lerp2(c, pts[2] as P2, 0.25), lerp2(c, pts[4] as P2, 0.35)]);
      return;
    }
    case 'stone-table':
      out.push(circle(c, w / 2, 24), circle(c, w * 0.38, 20));
      return;
    case 'stone-stool':
      out.push(circle(c, w / 2, 14));
      return;
    case 'path-light':
      out.push(circle(c, Math.max(0.06, w / 2), 8), [add(c, [-0.1, -0.1]), add(c, [0.1, 0.1])], [add(c, [-0.1, 0.1]), add(c, [0.1, -0.1])]);
      return;
    default:
      if (item.slug === 'tesla') {
        const r = Math.min(w, d) * 0.18;
        out.push(closed(roundedBox(local, w, d, r)));
        out.push([local(-w * 0.42, d * 0.2), local(0, d * 0.26), local(w * 0.42, d * 0.2)]);
        out.push([local(-w * 0.4, -d * 0.3), local(0, -d * 0.34), local(w * 0.4, -d * 0.3)]);
        return;
      }
      out.push(box(-w / 2, -d / 2, w / 2, d / 2));
  }
}

function roundedBox(local: (u: number, v: number) => P2, w: number, d: number, r: number): P2[] {
  const q = Math.PI / 2;
  const corner = (cu: number, cv: number, from: number): P2[] => arc([cu, cv], r, from, q, 4).map((p) => local(p[0], p[1]));
  return [
    ...corner(w / 2 - r, -d / 2 + r, -q),
    ...corner(w / 2 - r, d / 2 - r, 0),
    ...corner(-w / 2 + r, d / 2 - r, q),
    ...corner(-w / 2 + r, -d / 2 + r, 2 * q),
  ];
}

/** Horizontal scanlines through `outer` minus `holes`, broken into dashes. */
function hatch(outer: readonly P2[], holes: readonly (readonly P2[])[], pitch: number, pattern: readonly number[]): P2[][] {
  const out: P2[][] = [];
  const zs = outer.map((p) => p[1]);
  const all = [outer, ...holes];
  let row = 0;
  for (let z = Math.min(...zs) + pitch / 2; z < Math.max(...zs); z += pitch, row++) {
    const xs: number[] = [];
    for (const pts of all) {
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length] as P2;
        if (a[1] > z !== b[1] > z) {
          xs.push(a[0] + ((z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      });
    }
    xs.sort((x, y) => x - y);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = (xs[i] as number) + 0.25 + (row % 3) * 0.3;
      const x1 = (xs[i + 1] as number) - 0.25;
      if (x1 > x0) {
        dashes([x0, z], [x1, z], pattern).forEach((s) => out.push([s[0], s[1]]));
      }
    }
  }
  return out;
}

function stipple(pts: readonly P2[], seed: number, out: P2[][]): void {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const rnd = random(seed);
  const n = Math.round(((x1 - x0) * (z1 - z0)) / STIPPLE_M2);
  for (let i = 0; i < n; i++) {
    const p: P2 = [x0 + (x1 - x0) * rnd(), z0 + (z1 - z0) * rnd()];
    if (inside(p, pts)) {
      out.push([p, add(p, [0.05, 0.025])]);
    }
  }
}

/** The site walls as a one-level plan, gates as door openings, so the house's wall tools apply. */
function sitePlan(house: LandingHouse): PresentationPlan {
  const { walls, gates } = house.site;
  return {
    levels: [{ id: 'site', elevationMm: 0, heightMm: 1600 }],
    walls: walls.map((w) => ({ id: w.id, levelId: 'site', kind: 'loadBearing', thicknessMm: w.thicknessMm, heightMm: w.heightMm, start: w.start, end: w.end })),
    openings: gates.map((g) => ({ id: g.id, wallId: g.wallId, kind: 'door', relativePosition: g.relativePosition, widthMm: g.widthMm, heightMm: g.heightMm, sillHeightMm: 0, swing: 'double' })),
    rooms: [],
    furniture: [],
    ceilingLights: { heightMm: 0, roomIds: [], positionsMm: [] },
  };
}

function gateInk(house: LandingHouse, out: P2[][]): void {
  for (const g of house.site.gates) {
    const wall = house.site.walls.find((w) => w.id === g.wallId);
    if (!wall) {
      continue;
    }
    const a = p2(wall.start);
    const b = p2(wall.end);
    const c = lerp2(a, b, g.relativePosition);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dir: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const nrm: P2 = [-dir[1], dir[0]];
    const half = mm(g.widthMm) / 2;
    const s0 = add(c, dir, -half);
    const s1 = add(c, dir, half);
    for (const pier of g.piers) {
      const pc = p2(pier.at);
      const h = mm(pier.sizeMm) / 2;
      out.push(closed([add(pc, [-h, -h]), add(pc, [h, -h]), add(pc, [h, h]), add(pc, [-h, h])]));
    }
    if (g.operation === 'sliding') {
      // The leaf parked beside the gap on the inside face, its travel shown by a thin line across the gap.
      const off = mm(wall.thicknessMm) / 2 + 0.08;
      out.push([add(s0, nrm, off), add(add(s1, dir, mm(g.widthMm)), nrm, off)]);
      continue;
    }
    // Two leaves swinging into the plot (+nrm points into it for the street wall).
    const leaf = half;
    const into = nrm[1] >= 0 ? 1 : -1;
    for (const [hinge, free] of [
      [s0, 1],
      [s1, -1],
    ] as const) {
      const closedA = Math.atan2(dir[1] * free, dir[0] * free);
      const openA = Math.atan2(nrm[1] * into, nrm[0] * into);
      let sweep = openA - closedA;
      sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
      out.push([hinge, add(hinge, nrm, into * leaf)], arc(hinge, leaf, closedA, sweep, 10));
    }
  }
}

export function siteInk(house: LandingHouse): SiteInk {
  const { site, roofs } = house;
  const fine: P2[][] = [];
  const walls: P2[][] = [];
  const overhead: P2[][] = [];

  const plan = sitePlan(house);
  for (const segs of wallFaces(plan).values()) {
    segs.forEach((s) => walls.push([s[0], s[1]]));
  }
  gateInk(house, walls);

  site.surfaces.forEach((s, i) => {
    const pts = poly(s.outline);
    if (s.kind === 'lawn') {
      stipple(pts, 11 + i * 7919, fine);
      return;
    }
    if (s.slabs) {
      s.slabs.forEach((slab) => fine.push(closed(poly(slab))));
      return;
    }
    fine.push(closed(pts));
    if (s.kind === 'island') {
      fine.push(closed(offsetPolygon(pts, -0.15)));
    }
    // Joints on the small paved areas only; across the driveway they would read as a grid of noise.
    if (s.module && s.kind !== 'driveway') {
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[1]);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const mx = Math.max(mm(s.module.lengthMm), 1.2);
      const mz = Math.max(mm(s.module.widthMm), 1.2);
      for (let x = x0 + mx; x < x1 - 0.05; x += mx) fine.push([[x, z0], [x, z1]]);
      for (let z = z0 + mz; z < z1 - 0.05; z += mz) fine.push([[x0, z], [x1, z]]);
    }
  });

  for (const st of site.steps) {
    const pts = poly(st.outline);
    fine.push(closed(pts));
    const f = compass(st.climbs) ?? [0, 1];
    const proj = pts.map((p) => p[0] * f[0] + p[1] * f[1]);
    const side = pts.map((p) => -p[0] * f[1] + p[1] * f[0]);
    const [lo, a0, a1] = [Math.min(...proj), Math.min(...side), Math.max(...side)];
    const pt = (s: number, o: number): P2 => [f[0] * s - f[1] * o, f[1] * s + f[0] * o];
    for (let k = 1; k < st.risers; k++) {
      fine.push([pt(lo + k * mm(st.treadMm), a0), pt(lo + k * mm(st.treadMm), a1)]);
    }
  }

  const islands = site.surfaces.filter((s) => s.kind === 'island').map((s) => poly(s.outline));
  for (const water of site.water) {
    const edge = poly(water.outline);
    fine.push(closed(edge), closed(offsetPolygon(edge, mm(water.copingMm))));
    const holes = islands.filter((isl) => isl.every((p) => inside(p, edge)));
    fine.push(...hatch(edge, holes, WATER_PITCH, WATER_DASH));
    for (const lotus of water.lotus ?? []) {
      const c = p2(lotus.at);
      const r = mm(lotus.radiusMm);
      fine.push([...arc(c, r, 0.4, Math.PI * 2 - 0.5, 16), c, arc(c, r, 0.4, 0, 1)[0] as P2]);
    }
  }

  site.plants.forEach((plant) => plantInk(plant, fine));
  site.items.forEach((item) => itemInk(item, fine));

  const dashed = (pts: readonly P2[], pattern: readonly number[]): void => {
    closed(pts).forEach((a, i, all) => {
      const b = all[i + 1];
      if (b) dashes(a, b, pattern).forEach((s) => overhead.push([s[0], s[1]]));
    });
  };
  roofs.hips.forEach((roof) => dashed(poly(roof.eave), ROOF_DASH));
  roofs.canopies.forEach((canopy) => dashed(poly(canopy.outline), CANOPY_DASH));
  for (const row of roofs.columns) {
    const a = p2(row.start);
    const b = p2(row.end);
    const h = mm(row.sizeMm) / 2;
    for (let i = 0; i < row.count; i++) {
      const c = lerp2(a, b, row.count === 1 ? 0 : i / (row.count - 1));
      overhead.push(row.material === 'timber' ? circle(c, h, 10) : closed([add(c, [-h, -h]), add(c, [h, -h]), add(c, [h, h]), add(c, [-h, h])]));
    }
  }

  return { fine, walls, overhead, poche: pocheShapes(plan) };
}
