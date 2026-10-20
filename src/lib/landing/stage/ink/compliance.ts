/**
 * Scene 08's marks on the built house, in world space (they do not float with
 * the drawing plane): a coral outline and clear-width dimension on the failing
 * door, coral riser edges and one riser-height dimension on the stair, and
 * small jade ticks at the targets that pass. All positions come from the plan
 * and the stair spec, so the dimension ends sit on the real edges.
 */

import type { LandingHouse } from '@/lib/landing/types';

import { add, along, compass, mm, openingSpan, p2, wallFrame, type P2 } from './geometry';
import { CORAL, JADE, lineMaterial, RevealLine, staticLine, type P3, type Stroke } from './lines';

export interface Compliance {
  readonly door: RevealLine | null;
  readonly stair: RevealLine;
  readonly passes: RevealLine;
  /** Anchor id (`check:<id>`) → world position. */
  readonly anchors: ReadonlyMap<string, P3>;
}

const TICK = 0.08;

function levelElevation(house: LandingHouse, levelId: string): number {
  return mm(house.plan.levels.find((level) => level.id === levelId)?.elevationMm ?? 0);
}

/** Where a check's target is on the plan, or null if the id names nothing drawable. */
function targetPoint(house: LandingHouse, targetId: string): P3 | null {
  const plan = house.plan;
  const opening = plan.openings.find((o) => o.id === targetId);
  const wallOf = (id: string) => plan.walls.find((wall) => wall.id === id);
  if (opening) {
    const wall = wallOf(opening.wallId);
    if (wall) {
      const p = along(wallFrame(wall), opening.relativePosition * wallFrame(wall).len);
      return [p[0], levelElevation(house, wall.levelId), p[1]];
    }
  }
  const room = plan.rooms.find((r) => r.id === targetId);
  if (room && room.outline.length > 0) {
    const pts = room.outline.map(p2);
    const c = pts.reduce((sum, p) => add(sum, p, 1 / pts.length), [0, 0] as P2);
    return [c[0], levelElevation(house, room.levelId), c[1]];
  }
  const wall = wallOf(targetId);
  if (wall) {
    const w = wallFrame(wall);
    const p = along(w, w.len / 2);
    return [p[0], levelElevation(house, wall.levelId), p[1]];
  }
  if (targetId === house.stair.id) {
    const s = p2(house.stair.startMm);
    return [s[0], levelElevation(house, house.stair.levelId), s[1]];
  }
  return null;
}

function doorStrokes(house: LandingHouse, openingId: string, anchors: Map<string, P3>, checkId: string): Stroke[] {
  const opening = house.plan.openings.find((o) => o.id === openingId);
  const wall = opening && house.plan.walls.find((x) => x.id === opening.wallId);
  if (!opening || !wall) {
    return [];
  }
  const w = wallFrame(wall);
  const [s0, s1] = openingSpan(opening, w);
  const face = w.t / 2 + 0.012;
  const y0 = levelElevation(house, wall.levelId) + mm(opening.sillHeightMm);
  const y1 = y0 + mm(opening.heightMm);
  const pt = (s: number, y: number, off = face): P3 => {
    const p = along(w, s, off);
    return [p[0], y, p[1]];
  };
  const dimY = y0 + 0.15;
  anchors.set(`check:${checkId}`, pt((s0 + s1) / 2, dimY + 0.14));
  return [
    { pts: [pt(s0, y0), pt(s0, y1), pt(s1, y1), pt(s1, y0), pt(s0, y0)], start: 0, end: 0 },
    { pts: [pt(s0, dimY), pt(s1, dimY)], start: 0, end: 0.6 },
    { pts: [pt(s0, dimY - TICK), pt(s0, dimY + TICK)], start: 0.6, end: 0.8 },
    { pts: [pt(s1, dimY - TICK), pt(s1, dimY + TICK)], start: 0.8, end: 1 },
  ];
}

function stairStrokes(house: LandingHouse, anchors: Map<string, P3>, checkId: string | null): Stroke[] {
  const spec = house.stair;
  const dir = compass(spec.climbs) ?? [0, 1];
  const across: P2 = [-dir[1], dir[0]];
  const start = p2(spec.startMm);
  const half = mm(spec.widthMm) / 2;
  const tread = mm(spec.treadMm);
  const riser = mm(spec.riserMm);
  const base = levelElevation(house, spec.levelId);
  const out: Stroke[] = [];
  for (let k = 0; k < spec.risers; k++) {
    const nose = add(start, dir, k * tread);
    const a = add(nose, across, -half);
    const b = add(nose, across, half);
    const y = base + (k + 1) * riser;
    const t = (0.7 * k) / spec.risers;
    out.push({ pts: [[a[0], y, a[1]], [b[0], y, b[1]]], start: t, end: t + 0.7 / spec.risers });
  }
  const k = 1;
  const side = add(add(start, dir, k * tread), across, half + 0.15);
  const lo = base + k * riser;
  const hi = lo + riser;
  const tickA = add(side, dir, -TICK);
  const tickB = add(side, dir, TICK);
  out.push(
    { pts: [[side[0], lo, side[1]], [side[0], hi, side[1]]], start: 0.7, end: 0.88 },
    { pts: [[tickA[0], lo, tickA[1]], [tickB[0], lo, tickB[1]]], start: 0.88, end: 0.94 },
    { pts: [[tickA[0], hi, tickA[1]], [tickB[0], hi, tickB[1]]], start: 0.94, end: 1 },
  );
  if (checkId) {
    const label = add(side, across, 0.12);
    anchors.set(`check:${checkId}`, [label[0], (lo + hi) / 2, label[1]]);
  }
  return out;
}

export function createCompliance(house: LandingHouse): Compliance {
  const anchors = new Map<string, P3>();
  const failing = house.checks.filter((check) => !check.pass);
  const doorCheck = failing.find((check) => house.plan.openings.some((o) => o.id === check.targetId));
  const stairCheck = failing.find((check) => check.targetId === house.stair.id) ?? null;

  const ticks: P3[][] = [];
  for (const check of house.checks) {
    const p = targetPoint(house, check.targetId);
    if (!p) {
      continue;
    }
    if (!anchors.has(`check:${check.id}`)) {
      anchors.set(`check:${check.id}`, [p[0], p[1] + 0.05, p[2]]);
    }
    if (check.pass) {
      const y = p[1] + 0.02;
      ticks.push([
        [p[0] - 0.06, y, p[2]],
        [p[0] - 0.02, y, p[2] + 0.05],
        [p[0] + 0.07, y, p[2] - 0.06],
      ]);
    }
  }

  const doorStrokesList = doorCheck ? doorStrokes(house, doorCheck.targetId, anchors, doorCheck.id) : [];
  return {
    door: doorStrokesList.length > 0 ? new RevealLine('check:door', doorStrokesList, lineMaterial(CORAL, 2)) : null,
    stair: new RevealLine('check:stair', stairStrokes(house, anchors, stairCheck?.id ?? null), lineMaterial(CORAL, 1.8)),
    passes: staticLine('check:passes', ticks, lineMaterial(JADE, 1.6)),
    anchors,
  };
}
