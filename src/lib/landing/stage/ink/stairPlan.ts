/**
 * The stair on the plan, from one `StairSpec`: every riser's nosing line in
 * climbing order, the flight sides and the half-landing outline, and the climb
 * line. Both the graphite plan (strokes.ts) and scene 08's coral riser edges
 * (compliance.ts) read it, so they sit on the treads `buildStair` makes.
 *
 * Same layout as `buildStair`: riser k of the first flight fronts at k × tread
 * from the foot; a U-stair's riser `afterRisers − 1` tops the landing, and the
 * return flight, offset `width + gap` towards `returnsOn`, climbs back with its
 * riser i fronting at (afterRisers − 1 − i) × tread.
 */

import type { StairSpec } from '@/lib/landing/types';

import { add, compass, dot, mm, p2, type P2 } from './geometry';

export interface RiserLine {
  readonly a: P2;
  readonly b: P2;
  /** Unit vector down the flight on the plan: the nosing overhangs this way. */
  readonly down: P2;
}

export interface StairPlan {
  /** One per riser, bottom to top: the front edge of the tread on top of it. */
  readonly risers: readonly RiserLine[];
  /** Flight sides and the landing outline. */
  readonly edges: readonly P2[][];
  /** Climb line from the foot to the top, then the arrow head. */
  readonly climb: readonly P2[][];
  /** Unit vector from the first flight towards the side the riser dimension may use, and room there (m). */
  readonly openSide: P2;
  readonly openRoom: number;
}

const scale = (v: P2, k: number): P2 => [v[0] * k, v[1] * k];

export function stairPlan(spec: StairSpec): StairPlan {
  const dir = compass(spec.climbs) ?? [0, 1];
  const across: P2 = [-dir[1], dir[0]];
  const start = p2(spec.startMm);
  const tread = mm(spec.treadMm);
  const half = mm(spec.widthMm) / 2;
  const landing = spec.landing;
  const first = landing ? Math.min(landing.afterRisers, spec.risers) : spec.risers;
  const offset = landing ? scale(compass(landing.returnsOn) ?? across, mm(spec.widthMm + landing.gapMm)) : null;
  const at = (base: P2, s: number, o: number): P2 => add(add(base, dir, s), across, o);
  const line = (base: P2, s: number, down: P2): RiserLine => ({ a: at(base, s, -half), b: at(base, s, half), down });

  const risers: RiserLine[] = [];
  const back = scale(dir, -1);
  for (let k = 0; k < first; k++) {
    risers.push(line(start, k * tread, back));
  }
  const top = (first - 1) * tread;
  const edges: P2[][] = [];
  const climb: P2[] = [at(start, tread * 0.5, 0)];
  let tip: P2;
  let tipDir: P2;

  if (landing && offset) {
    const second = spec.risers - first;
    const foot = add(start, offset);
    for (let i = 0; i < second; i++) {
      risers.push(line(foot, top - i * tread, dir));
    }
    const low = top - Math.max(0, second - 1) * tread;
    const side = Math.sign(dot(offset, across)) || 1;
    const reach = Math.hypot(offset[0], offset[1]);
    const depth = mm(landing.depthMm);
    for (const o of [-half, half]) {
      edges.push([at(start, 0, o), at(start, top, o)], [at(foot, low, o), at(foot, top, o)]);
    }
    const o0 = -side * half;
    const o1 = side * (reach + half);
    edges.push([at(start, top, o0), at(start, top + depth, o0), at(start, top + depth, o1), at(start, top, o1)]);
    climb.push(at(start, top + depth / 2, 0), at(foot, top + depth / 2, 0));
    tip = at(foot, low + tread * 0.3, 0);
    tipDir = back;
    climb.push(tip);
    return finish(risers, edges, climb, tip, tipDir, across, scale(across, side), mm(landing.gapMm));
  }
  for (const o of [-half, half]) {
    edges.push([at(start, 0, o), at(start, top, o)]);
  }
  tip = at(start, top - tread * 0.3, 0);
  tipDir = dir;
  climb.push(tip);
  // `buildStair` puts a straight flight's open (stringer) side at its local +x: −across on the plan.
  return finish(risers, edges, climb, tip, tipDir, across, scale(across, -1), 0.3);
}

function finish(
  risers: RiserLine[],
  edges: P2[][],
  climb: P2[],
  tip: P2,
  tipDir: P2,
  across: P2,
  openSide: P2,
  openRoom: number,
): StairPlan {
  const barb = 0.18;
  const head: P2[] = [add(add(tip, tipDir, -barb), across, -barb * 0.55), tip, add(add(tip, tipDir, -barb), across, barb * 0.55)];
  return { risers, edges, climb: [climb, head], openSide, openRoom };
}
