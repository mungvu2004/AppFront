/**
 * "Mặt cắt A–A": a longitudinal section of the villa generated from the house data, cut at plan y = CUT_Y
 * (through the stair) and seen towards the street (so plan x runs left → right, as in the true house).
 *
 * Cut (poché): slabs, the walls that cross the cut line (with any opening at the cut), the hip roofs' profile.
 * Beyond (hairline): openings in the walls between the cut and the street, the stair flights, roof silhouettes.
 * Section frame: x = plan mm, z = mm above the ground floor (screen up).
 */

import { LANDING_HOUSE } from '@/lib/landing/house';

import { bounds, type Rect } from '../blueprint/camera';
import type { Kit } from '../blueprint/floor';
import type { V2 } from '../blueprint/model';
import { PEN, tracePartial, tracePoly } from '../blueprint/pen';

export const CUT_Y = 12200;
const GROUND = -450;
const SLAB_T = 250;
/** Section window (x, z mm). */
export const SEC = { x0: 0, z0: -1600, w: 32000, h: 13600 } as const;

type Box = readonly [x0: number, z0: number, x1: number, z1: number];
interface Line {
  readonly pts: readonly V2[];
  readonly pen: 'medium' | 'fine' | 'hair';
  readonly dashed?: boolean;
}

const plan = LANDING_HOUSE.plan;
const levels = plan.levels.map((l) => ({ id: l.id, z: l.elevationMm, h: l.heightMm }));

/** x extent of a level's exterior walls (outer faces) and whether it has the stair void at the cut. */
function extent(levelId: string): [number, number] {
  const xs = plan.walls.filter((w) => w.levelId === levelId && w.thicknessMm >= 200).flatMap((w) => [w.start[0] ?? 0, w.end[0] ?? 0]);
  return [Math.min(...xs) - 110, Math.max(...xs) + 110];
}

const VOID: readonly [number, number] = [13200, 16000];

function slabs(): Box[] {
  const out: Box[] = [];
  levels.forEach((l, i) => {
    const [a, b] = extent(l.id);
    const lo = i === 0 ? GROUND : l.z - SLAB_T;
    if (i === 0) out.push([a, lo, b, l.z]);
    else out.push([a, lo, VOID[0], l.z], [VOID[1], lo, b, l.z]);
  });
  return out;
}

/** Underside of the slab above x on the level above `i`, or null if open to the roof there. */
function ceiling(i: number, x: number): number | null {
  const up = levels[i + 1];
  if (up === undefined) return null;
  const [a, b] = extent(up.id);
  return x >= a && x <= b ? up.z - SLAB_T : null;
}

function cutWalls(): Box[] {
  const out: Box[] = [];
  levels.forEach((l, i) => {
    for (const w of plan.walls.filter((q) => q.levelId === l.id)) {
      const [sx, sy, ex, ey] = [w.start[0] ?? 0, w.start[1] ?? 0, w.end[0] ?? 0, w.end[1] ?? 0];
      if (sx !== ex || CUT_Y < Math.min(sy, ey) || CUT_Y > Math.max(sy, ey)) continue;
      const half = w.thicknessMm / 2;
      const top = w.kind === 'railing' ? l.z + (w.heightMm ?? 1050) : (ceiling(i, sx) ?? l.z + l.h);
      const at = Math.abs(CUT_Y - sy);
      const len = Math.abs(ey - sy);
      const o = plan.openings.find((q) => q.wallId === w.id && Math.abs(q.relativePosition * len - at) < q.widthMm / 2);
      if (o === undefined) {
        out.push([sx - half, l.z, sx + half, top]);
        continue;
      }
      if (o.kind === 'window' && o.sillHeightMm > 0) out.push([sx - half, l.z, sx + half, l.z + o.sillHeightMm]);
      out.push([sx - half, l.z + o.sillHeightMm + o.heightMm, sx + half, top]);
    }
  });
  return out;
}

/** Openings between the cut and the street, in walls running along x: thin frames + a sill line. */
function beyondOpenings(): Line[] {
  const out: Line[] = [];
  for (const l of levels) {
    for (const w of plan.walls.filter((q) => q.levelId === l.id)) {
      const [sx, sy, ex, ey] = [w.start[0] ?? 0, w.start[1] ?? 0, w.end[0] ?? 0, w.end[1] ?? 0];
      if (sy !== ey || sy >= CUT_Y) continue;
      for (const o of plan.openings.filter((q) => q.wallId === w.id)) {
        const c = sx + (ex - sx) * o.relativePosition;
        const a = c - o.widthMm / 2;
        const b = c + o.widthMm / 2;
        const z0 = l.z + o.sillHeightMm;
        const z1 = z0 + o.heightMm;
        out.push({ pts: [[a, z0], [b, z0], [b, z1], [a, z1], [a, z0]], pen: 'hair' });
        if (o.kind === 'window') out.push({ pts: [[(a + b) / 2, z0], [(a + b) / 2, z1]], pen: 'hair' });
      }
    }
  }
  return out;
}

/** The U-stair on T1 and T2 between the cut and the street: treads seen beyond, the half-landing cut. */
function stair(): { lines: Line[]; cut: Box[] } {
  const lines: Line[] = [];
  const cut: Box[] = [];
  for (const s of [LANDING_HOUSE.stair, LANDING_HOUSE.topStair]) {
    if (s === undefined) continue;
    const base = levels.find((l) => l.id === s.levelId)?.z ?? 0;
    const n = s.landing?.afterRisers ?? s.risers;
    const seen = Math.floor((CUT_Y - s.startMm[1]) / s.treadMm);
    const x = s.startMm[0];
    for (let i = 1; i <= Math.min(n, seen + 1); i += 1) lines.push({ pts: [[x - s.widthMm / 2, base + i * s.riserMm], [x + s.widthMm / 2, base + i * s.riserMm]], pen: 'hair' });
    lines.push({ pts: [[x - s.widthMm / 2, base], [x + s.widthMm / 2, base + n * s.riserMm]], pen: 'fine' });
    // Return flight, cut where it crosses the cut line on its way down from the landing.
    const back = x - s.widthMm - (s.landing?.gapMm ?? 0);
    const landingY = s.startMm[1] + (n - 1) * s.treadMm;
    const k = Math.max(0, (landingY - CUT_Y) / s.treadMm);
    const zc = base + (n + k) * s.riserMm;
    cut.push([back - s.widthMm / 2, zc - 180, back + s.widthMm / 2, zc]);
  }
  return { lines, cut };
}

/** Hip roof height at (x, y): eave + slope × distance to the nearest eave edge, capped at the ridge. */
function roofZ(r: (typeof LANDING_HOUSE.roofs.hips)[number], x: number, y: number): number {
  const b = bounds(r.eave.map((p) => [p[0] ?? 0, p[1] ?? 0] as V2));
  const d = Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y);
  return r.eaveMm + Math.max(0, d) * Math.tan((r.pitchDeg * Math.PI) / 180);
}

function roofs(): { cut: V2[][]; beyond: Line[] } {
  const cut: V2[][] = [];
  const beyond: Line[] = [];
  for (const r of LANDING_HOUSE.roofs.hips.filter((h) => h.levelId !== 'site')) {
    const b = bounds(r.eave.map((p) => [p[0] ?? 0, p[1] ?? 0] as V2));
    const i = levels.findIndex((l) => l.id === r.levelId);
    // The part of this roof hidden inside the storey above.
    const hide = levels[i + 1] === undefined ? null : extent(levels[i + 1]?.id ?? '');
    const runs: [number, number][] = hide === null ? [[b.minX, b.maxX]] : [[b.minX, hide[0]], [hide[1], b.maxX]];
    for (const [a, c] of runs) {
      if (c - a < 10) continue;
      const xs = Array.from({ length: 25 }, (_, k) => a + ((c - a) * k) / 24);
      const top = xs.map((x): V2 => [x, roofZ(r, x, CUT_Y)]);
      const bot = xs.map((x): V2 => [x, roofZ(r, x, CUT_Y) - r.thicknessMm]).reverse();
      cut.push([...top, ...bot]);
      // Beyond, towards the street, the roof drops to its front eave: one long eave line.
      beyond.push({ pts: [[a, r.eaveMm], [c, r.eaveMm]], pen: 'fine' });
    }
  }
  return { cut, beyond };
}

const ST = stair();
const RF = roofs();
const SECTION = {
  slabs: slabs(),
  walls: [...cutWalls(), ...ST.cut],
  roofCut: RF.cut,
  beyond: [...beyondOpenings(), ...ST.lines, ...RF.beyond],
  levels: levels.map((l) => l.z),
};

/** Screen mapping of the section window into `r` (letterboxed). */
export function secMap(r: Rect): (x: number, z: number) => V2 {
  const s = Math.min(r.w / SEC.w, r.h / SEC.h);
  const ox = r.x + (r.w - SEC.w * s) / 2 - SEC.x0 * s;
  const oy = r.y + (r.h + SEC.h * s) / 2 + SEC.z0 * s;
  return (x, z) => [ox + x * s, oy - z * s];
}

/** Screen position of each level mark (the triangle at the right end), for guides and red pencil. */
export function levelMarks(r: Rect): V2[] {
  const m = secMap(r);
  return SECTION.levels.map((z) => m(30200, z));
}

const fmt = (z: number): string => (z === 0 ? '±0.000' : `+${(z / 1000).toFixed(3)}`);

/** Draws the section with drafting order `d` (0..1): ground → slabs → walls → roofs → beyond → levels. */
export function drawSection(kit: Kit, r: Rect, d: number, alpha: number): void {
  if (alpha <= 0 || d <= 0) return;
  const { ctx, k } = kit;
  const m = secMap(r);
  const span = (a: number, b: number): number => Math.min(1, Math.max(0, (d - a) / (b - a)));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineCap = 'round';
  // Ground line and a band of earth hatch.
  ctx.lineWidth = PEN.medium * k * 1.4;
  ctx.beginPath();
  tracePartial(ctx, [m(600, GROUND), m(31400, GROUND)], span(0, 0.15));
  ctx.stroke();
  const poche = (boxes: readonly Box[], t: number): void => {
    boxes.forEach((b, i) => {
      const r2 = Math.min(1, Math.max(0, t * 1.4 - (i / boxes.length) * 0.4));
      if (r2 <= 0) return;
      const q = [m(b[0], b[1]), m(b[2], b[1]), m(b[2], b[3]), m(b[0], b[3])];
      ctx.globalAlpha = alpha * r2;
      ctx.beginPath();
      tracePoly(ctx, q);
      ctx.fill();
    });
    ctx.globalAlpha = alpha;
  };
  poche(SECTION.slabs, span(0.1, 0.35));
  poche(SECTION.walls, span(0.25, 0.55));
  SECTION.roofCut.forEach((poly, i) => {
    const t = span(0.45 + i * 0.04, 0.7 + i * 0.04);
    if (t <= 0) return;
    ctx.globalAlpha = alpha * t;
    ctx.beginPath();
    tracePoly(ctx, poly.map((p) => m(p[0], p[1])));
    ctx.fill();
  });
  ctx.globalAlpha = alpha;
  SECTION.beyond.forEach((l, i) => {
    const t = Math.min(1, Math.max(0, span(0.55, 0.9) * 1.5 - (i / SECTION.beyond.length) * 0.5));
    if (t <= 0) return;
    ctx.lineWidth = PEN[l.pen] * k;
    ctx.beginPath();
    tracePartial(ctx, l.pts.map((p) => m(p[0], p[1])), t);
    ctx.stroke();
  });
  // Level lines (dash-dot) and marks with their elevations.
  const lv = span(0.8, 1);
  if (lv > 0) {
    ctx.font = `300 ${String(10 * k)}px 'Be Vietnam Pro', sans-serif`;
    ctx.textBaseline = 'alphabetic';
    SECTION.levels.forEach((z) => {
      const a = m(1200, z);
      const b = m(30200, z);
      ctx.lineWidth = PEN.hair * k;
      ctx.setLineDash([10 * k, 3 * k, 1.5 * k, 3 * k]);
      ctx.beginPath();
      tracePartial(ctx, [a, b], lv);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = alpha * lv;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - 5 * k, b[1] - 7 * k);
      ctx.lineTo(b[0] + 5 * k, b[1] - 7 * k);
      ctx.closePath();
      ctx.stroke();
      ctx.fillText(fmt(z), b[0] + 9 * k, b[1] - 3 * k);
      ctx.globalAlpha = alpha;
    });
  }
  ctx.restore();
}

/** The cut line A–A on the ground-floor plan: chain line across, end bars, arrows looking to the street. */
export function drawCutLine(kit: Kit, project: (x: number, y: number) => V2, alpha: number, r: number): void {
  if (alpha <= 0 || r <= 0) return;
  const { ctx, k } = kit;
  const a = project(1200, CUT_Y);
  const b = project(30800, CUT_Y);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineWidth = PEN.fine * k;
  ctx.setLineDash([16 * k, 3 * k, 2 * k, 3 * k]);
  ctx.beginPath();
  tracePartial(ctx, [a, b], r);
  ctx.stroke();
  ctx.setLineDash([]);
  const t = Math.min(1, Math.max(0, r * 2 - 1));
  if (t > 0) {
    ctx.globalAlpha = alpha * t;
    // Looking towards the street: arrows point to plan -y.
    const up = project(0, CUT_Y - 1000)[1] - project(0, CUT_Y)[1];
    const dir = Math.sign(up) || -1;
    for (const p of [a, b]) {
      ctx.lineWidth = PEN.medium * k * 2;
      ctx.beginPath();
      ctx.moveTo(p[0] - 9 * k, p[1]);
      ctx.lineTo(p[0] + 9 * k, p[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] + dir * 14 * k);
      ctx.lineTo(p[0] - 4 * k, p[1] + dir * 6 * k);
      ctx.lineTo(p[0] + 4 * k, p[1] + dir * 6 * k);
      ctx.closePath();
      ctx.fill();
      ctx.font = `italic 400 ${String(15 * k)}px Newsreader, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('A', p[0] + 14 * k, p[1] + dir * 12 * k + 5 * k);
    }
  }
  ctx.restore();
}
