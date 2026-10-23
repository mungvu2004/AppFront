/**
 * The site's hardscape as one geometry per material: lawns (plus the top of
 * the model base), beds and mulch discs, paving (driveway, carport, podium,
 * steps), stone (path slabs, stepping stones, gate piers), granite (wall and
 * island copings, plinths, the rings round the tree discs), white render
 * (boundary walls, the island planter, the base block's sides) and the gates.
 *
 * The estate sits on a 0.6 m model base, the plot plus 1.5 m, on the paper
 * sheet: no ground runs off into the distance, so no lit-vs-paper ring shows.
 * The base top has the ponds cut out (outline + coping), so water lies over
 * the dark basin, never over grass.
 *
 * Small elevation steps (1–3 cm) keep coplanar layers apart without polygon
 * offset: base < lawn < paving < bed. Path slabs on the lawn get the lawn
 * under them too, so the joints read as grass.
 */

import type { BufferGeometry } from 'three';

import type { LandingSite, PlanPt, Polygon, SiteSteps, SiteWall } from '../../types';

import { M, beam, block, flat, merge, offset, prism } from './geo';

export interface Hardscape {
  readonly lawn: BufferGeometry;
  readonly bed: BufferGeometry;
  readonly paving: BufferGeometry;
  readonly stone: BufferGeometry;
  readonly granite: BufferGeometry;
  readonly render: BufferGeometry;
  readonly gate: BufferGeometry;
  /** Record ids each part draws (every surface, step, wall and gate lands in one). */
  readonly records: Readonly<Record<'lawn' | 'bed' | 'paving' | 'stone' | 'render' | 'gate', string[]>>;
}

/** The model base: the plot plus this margin (mm), this deep below natural ground (m). */
const BASE_MARGIN_MM = 1500;
const BASE_DEPTH_M = 0.6;
const BASE_WALL_MM = 60;
/** Tree discs: mulch radius from the canopy, clamped (mm), and the stone ring's width. */
const DISC_MIN_MM = 600;
const DISC_MAX_MM = 1200;
const RING_MM = 120;
const ISLAND_CAP_MM = 150;
const COPING_MM = 60;
const COPING_PROUD_MM = 40;
const PLINTH_PROUD_MM = 20;
const SLAT_MM = 90;
const SLAT_GAP_MM = 40;
const SLAT_DEPTH_MM = 40;

function stepBoxes(st: SiteSteps): BufferGeometry[] {
  const xs = st.outline.map((p) => p[0]);
  const ys = st.outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const base = M(st.baseMm);
  const out: BufferGeometry[] = [];
  for (let k = 0; k < st.risers; k += 1) {
    const top = base + M((k + 1) * st.riserMm);
    const t = k * st.treadMm;
    // Each step runs from its nosing to the top of the flight (a solid flight, no undercut).
    const r =
      st.climbs === 'north' ? [x0, y0 + t, x1, y1] : st.climbs === 'south' ? [x0, y0, x1, y1 - t] : st.climbs === 'east' ? [x0 + t, y0, x1, y1] : [x0, y0, x1 - t, y1];
    const [a, b, c, d] = r as [number, number, number, number];
    out.push(block([(a + c) / 2, (b + d) / 2], c - a, d - b, base - 0.05, top - base + 0.05));
  }
  return out;
}

/** The parts of a wall left between its gates, as [s0, s1] mm along it. */
function runs(wall: SiteWall, site: LandingSite): [number, number][] {
  const len = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  const gaps = site.gates
    .filter((g) => g.wallId === wall.id)
    .map((g) => [g.relativePosition * len - g.widthMm / 2, g.relativePosition * len + g.widthMm / 2] as const)
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > at) {
      out.push([at, g0]);
    }
    at = Math.max(at, g1);
  }
  if (at < len) {
    out.push([at, len]);
  }
  return out;
}

export function buildHardscape(site: LandingSite): Hardscape {
  const G = M(site.groundMm);
  const lawn: BufferGeometry[] = [];
  const bed: BufferGeometry[] = [];
  const paving: BufferGeometry[] = [];
  const stone: BufferGeometry[] = [];
  const render: BufferGeometry[] = [];
  const gate: BufferGeometry[] = [];
  const records = { lawn: [] as string[], bed: [] as string[], paving: [] as string[], stone: [] as string[], render: [] as string[], gate: [] as string[] };

  const granite: BufferGeometry[] = [];
  const holes = site.water.map((w) => offset(w.outline, w.copingMm));
  const base = offset(site.plot, BASE_MARGIN_MM);
  lawn.push(flat(base, G - 0.03, holes));
  // The base's sides only (a hollow box under the lawn sheet): no cap that could show inside a pond.
  base.forEach((p, i) => {
    const q = base[(i + 1) % base.length] ?? p;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    render.push(beam(p, q, -BASE_WALL_MM / 2, len + BASE_WALL_MM / 2, BASE_WALL_MM, G - BASE_DEPTH_M, G - 0.035));
  });

  for (const s of site.surfaces) {
    const y = M(s.elevationMm);
    const onGround = s.elevationMm <= site.groundMm;
    switch (s.kind) {
      case 'lawn':
        lawn.push(flat(s.outline, y, s.holes));
        records.lawn.push(s.id);
        break;
      case 'bed':
        bed.push(flat(s.outline, y + 0.02, s.holes));
        records.bed.push(s.id);
        break;
      case 'island':
        // A white planter box with a grey stone cap, planted on top.
        render.push(prism(s.outline, G - 1, y));
        granite.push(prism(s.outline, y, y + 0.04, [offset(s.outline, -ISLAND_CAP_MM)]));
        lawn.push(flat(offset(s.outline, -ISLAND_CAP_MM), y + 0.02));
        records.render.push(s.id);
        break;
      case 'path':
        if (s.slabs !== undefined) {
          for (const slab of s.slabs) {
            stone.push(prism(slab, onGround ? y - 0.08 : G - 1, y + (onGround ? 0.03 : 0)));
          }
          if (onGround) {
            lawn.push(flat(s.outline, y));
          }
          records.stone.push(s.id);
        } else {
          paving.push(flat(s.outline, y + 0.01, s.holes));
          records.paving.push(s.id);
        }
        break;
      case 'podium':
      case 'deck':
        paving.push(prism(s.outline, G - 0.02, y, s.holes));
        records.paving.push(s.id);
        break;
      default:
        paving.push(flat(s.outline, y + 0.01, s.holes));
        records.paving.push(s.id);
    }
  }
  for (const st of site.steps) {
    paving.push(...stepBoxes(st));
    records.paving.push(st.id);
  }

  for (const w of site.walls) {
    const base = M(w.baseMm);
    const top = base + M(w.heightMm);
    for (const [s0, s1] of runs(w, site)) {
      render.push(beam(w.start, w.end, s0, s1, w.thicknessMm, base - 0.05, top - M(COPING_MM)));
      granite.push(beam(w.start, w.end, s0 - COPING_PROUD_MM, s1 + COPING_PROUD_MM, w.thicknessMm + 2 * COPING_PROUD_MM, top - M(COPING_MM), top));
      if (w.plinthMm !== undefined) {
        granite.push(beam(w.start, w.end, s0, s1, w.thicknessMm + 2 * PLINTH_PROUD_MM, base - 0.05, base + M(w.plinthMm)));
      }
    }
    records.render.push(w.id);
  }

  for (const g of site.gates) {
    const w = site.walls.find((x) => x.id === g.wallId);
    if (w === undefined) {
      continue;
    }
    const base = M(w.baseMm);
    for (const pier of g.piers) {
      stone.push(block(pier.at, pier.sizeMm, pier.sizeMm, base - 0.05, M(pier.heightMm) + 0.05));
    }
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    const c = g.relativePosition * len;
    const half = g.widthMm / 2;
    const top = base + M(g.heightMm);
    // Leaves: vertical slats on two rails; a swing gate is two leaves with a 20 mm split.
    const leaves: [number, number][] = g.operation === 'swing' ? [[c - half, c - 10], [c + 10, c + half]] : [[c - half, c + half]];
    for (const [a, b] of leaves) {
      gate.push(beam(w.start, w.end, a, b, SLAT_DEPTH_MM, base + 0.12, base + 0.18), beam(w.start, w.end, a, b, SLAT_DEPTH_MM, top - 0.12, top - 0.06));
      for (let s = a + SLAT_GAP_MM; s + SLAT_MM <= b; s += SLAT_MM + SLAT_GAP_MM) {
        gate.push(beam(w.start, w.end, s, s + SLAT_MM, SLAT_DEPTH_MM / 2, base + 0.06, top));
      }
    }
    records.gate.push(g.id);
  }

  // A mulch disc with a stone ring under every tree standing in the lawn.
  for (const p of site.plants) {
    if (p.slug === 'tree' && p.baseMm === site.groundMm) {
      const r = Math.min(DISC_MAX_MM, Math.max(DISC_MIN_MM, p.canopyMm * 0.4));
      bed.push(flat(disc(p.at, r), G + 0.025));
      granite.push(prism(disc(p.at, r + RING_MM), G - 0.02, G + 0.04, [disc(p.at, r)]));
    }
  }

  return {
    lawn: merge(lawn),
    bed: merge(bed),
    paving: merge(paving),
    stone: merge(stone),
    granite: merge(granite),
    render: merge(render),
    gate: merge(gate),
    records,
  };
}

function disc(at: PlanPt, rMm: number, n = 20): Polygon {
  return Array.from({ length: n }, (_, k) => [at[0] + rMm * Math.cos((k / n) * Math.PI * 2), at[1] + rMm * Math.sin((k / n) * Math.PI * 2)] as const);
}

/** Plan centre of a polygon's bounding box (for fades and the camera's late shots). */
export function centreOf(poly: readonly PlanPt[]): PlanPt {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
