/**
 * `stateAt(p)`: everything except the camera, from ONE paused GSAP timeline.
 *
 * The timeline (total duration 1, so time = p) tweens a plain mutable object;
 * each call seeks it with `tl.progress(p)` and copies the object into a fresh
 * frozen `LandingState`. Every tween is a `fromTo` with explicit values and
 * `immediateRender: false`, and two tweens on the same property may never
 * overlap (the builder throws) — that is what makes seeking order-independent:
 * any p reached from any previous p gives the same values.
 *
 * Eases are chosen per concern: geometry 'power3.inOut' / 'expo.out', materials
 * 'sine.inOut', ink 'power2.out', labels short 'power1'. The camera lives in
 * camera.ts (its own splines); only its value at the wall-rise moment is used
 * here, to order the walls nearest-first.
 */

import { gsap } from 'gsap';

import { LANDING_HOUSE } from '../house';
import type { LandingState } from '../types';

import { cameraAt } from './camera';
import { DEFAULT_ASPECT } from './framing';
import { clamp01, sceneAt } from './scenes';

type Bag = Record<string, number>;

const zeros = (ids: readonly string[]): Bag => Object.fromEntries(ids.map((id) => [id, 0]));

const plan = LANDING_HOUSE.plan;
const GROUND_WALLS = plan.walls.filter((x) => x.levelId === 'T1');
const UPPER_WALL_IDS = plan.walls.filter((x) => x.levelId !== 'T1').map((x) => x.id);
const GROUND_FURNITURE = plan.furniture.filter((x) => x.levelId === 'T1').map((x) => x.id);
const UPPER_FURNITURE = plan.furniture.filter((x) => x.levelId !== 'T1').map((x) => x.id);
const LABELLED = LANDING_HOUSE.detections.filter((d) => d.labelled).map((d) => `det:${d.furnitureId}`);

/** The group value for furniture ids the timeline does not know. */
export const FURNITURE_GROUP = '*';

export function furnitureRise(state: LandingState, id: string): number {
  return state.build.furniture[id] ?? state.build.furniture[FURNITURE_GROUP] ?? 0;
}

/** Ground walls in rise order: exterior long walls first, then partitions; nearest the camera first. */
export function wallRiseOrder(): string[] {
  const [cx, , cz] = cameraAt(0.45).position;
  const info = GROUND_WALLS.map((x) => {
    const [ax = 0, az = 0] = x.start;
    const [bx = 0, bz = 0] = x.end;
    const dist = Math.hypot((ax + bx) / 2000 - cx, (az + bz) / 2000 - cz);
    return { id: x.id, ext: x.kind === 'loadBearing', len: Math.hypot(bx - ax, bz - az), dist };
  });
  info.sort((a, b) => Number(b.ext) - Number(a.ext) || (a.ext ? b.len - a.len : 0) || a.dist - b.dist);
  return info.map((x) => x.id);
}

/** Ink at p 0: the openings (0–0.42 of the layer) are already drawn, so the first frame reads as a
 * plan; S01 then draws the stair, furniture symbols and axes (stage/ink/strokes.ts windows). */
const OPENING_INK = 0.42;

const LABEL_IDS = [
  ...LABELLED,
  'gap',
  'room:R1',
  'room:R2',
  'room:R3',
  'room:R6',
  'room:R7',
  'room:R8',
  'stair',
  'check:C4',
  'check:C7',
];

function blank() {
  return {
    paper: { opacity: 1, ink: OPENING_INK, junkInk: 0, axes: 0, dims: 0, liftM: 0 },
    detect: { walls: 0, rooms: 0, openings: 0, furniture: 0, labels: 0, explodeM: 0 },
    review: { highlight: 0, close: 0 },
    build: { floors: 0, joinery: 0, material: 0, stair: 0, upper: 0, upperLiftM: 0, cutaway: 0 },
    wallRise: zeros([...GROUND_WALLS.map((x) => x.id), ...UPPER_WALL_IDS]),
    furniture: zeros([...GROUND_FURNITURE, ...UPPER_FURNITURE, FURNITURE_GROUP]),
    compliance: { bathDoor: 0, stair: 0, passMarks: 0 },
    misc: { exports: 0, semantic: 0 },
    labels: zeros(LABEL_IDS),
  };
}

type Live = ReturnType<typeof blank>;

/** Builds the timeline; `tw` schedules target[key]: (last value) → value over [start, end]. */
function build(o: Live): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const last = new Map<Bag, Bag>();
  const busy = new Map<Bag, Bag>();
  const tw = (target: Bag, to: Bag, start: number, end: number, ease: string): void => {
    const was = last.get(target) ?? { ...target };
    const until = busy.get(target) ?? {};
    const from: Bag = {};
    for (const k of Object.keys(to)) {
      if (!(k in target)) throw new RangeError(`unknown key ${k}`);
      if ((until[k] ?? -1) > start + 1e-9) throw new RangeError(`overlapping tweens on ${k} at ${start}`);
      from[k] = was[k] as number;
      was[k] = to[k] as number;
      until[k] = end;
    }
    last.set(target, was);
    busy.set(target, until);
    const duration = end - start;
    tl.fromTo(target, from, { ...to, duration, ease, immediateRender: false }, start);
  };
  const label = (id: string, a: number, b: number, c: number, d: number): void => {
    tw(o.labels, { [id]: 1 }, a, b, 'power1.out');
    tw(o.labels, { [id]: 0 }, c, d, 'power1.in');
  };
  const { paper, detect, review, build: b, compliance: c, misc } = o;

  // S01 — walls are drawn from the start (stage); `ink` draws the fine layers stroke by stroke.
  // S02 — junk recedes, axes extend, dims reveal, plane lifts.
  tw(paper, { ink: 1 }, 0, 0.068, 'power2.out');
  tw(paper, { junkInk: 1 }, 0.012, 0.07, 'power2.out');
  tw(paper, { axes: 0.55 }, 0.03, 0.075, 'power2.out');
  tw(paper, { dims: 0.4 }, 0.04, 0.078, 'power2.out');
  tw(paper, { junkInk: 0 }, 0.095, 0.15, 'sine.inOut');
  tw(paper, { axes: 1 }, 0.09, 0.14, 'power2.out');
  tw(paper, { dims: 1 }, 0.1, 0.16, 'power1.inOut');
  tw(paper, { liftM: 0.06 }, 0.085, 0.15, 'power3.inOut');
  // S03 — layers staggered walls → rooms → openings → furniture → labels; explode then settle.
  tw(detect, { walls: 1 }, 0.186, 0.204, 'power2.out');
  tw(detect, { rooms: 1 }, 0.192, 0.212, 'power2.out');
  tw(detect, { openings: 1 }, 0.198, 0.216, 'power2.out');
  tw(detect, { furniture: 1 }, 0.205, 0.222, 'power2.out');
  tw(detect, { labels: 1 }, 0.211, 0.222, 'power1.out');
  tw(detect, { labels: 0 }, 0.285, 0.298, 'power1.in');
  tw(detect, { explodeM: 0.4 }, 0.19, 0.236, 'power3.inOut');
  tw(detect, { explodeM: 0.15 }, 0.236, 0.275, 'expo.out');
  tw(detect, { explodeM: 0 }, 0.3, 0.33, 'power3.inOut');
  tw(misc, { semantic: 1 }, 0.186, 0.21, 'sine.inOut');
  tw(paper, { dims: 0.2 }, 0.2, 0.25, 'sine.inOut');
  tw(paper, { axes: 0.3 }, 0.27, 0.32, 'sine.inOut');
  LABELLED.forEach((id, k) => label(id, 0.212 + k * 0.005, 0.22 + k * 0.005, 0.284, 0.294));
  // S04 — amber gap, endpoint slides, gap closes, highlight releases.
  tw(review, { highlight: 1 }, 0.318, 0.334, 'power2.out');
  tw(review, { close: 1 }, 0.342, 0.372, 'power3.inOut');
  tw(review, { highlight: 0 }, 0.378, 0.4, 'sine.inOut');
  label('gap', 0.324, 0.333, 0.376, 0.388);
  // S05 A — plane settles back, drawing references recede.
  tw(paper, { liftM: 0 }, 0.4, 0.44, 'power3.inOut');
  tw(paper, { axes: 0, dims: 0 }, 0.44, 0.5, 'sine.inOut');
  // S05 B — walls rise: exterior long walls lead, partitions follow, nearest first.
  const order = wallRiseOrder();
  const exterior = GROUND_WALLS.filter((x) => x.kind === 'loadBearing').length;
  order.forEach((id, k) => {
    const [start, dur] = k < exterior ? [0.43 + k * 0.0035, 0.022] : [0.4425 + (k - exterior) * 0.003, 0.0095];
    tw(o.wallRise, { [id]: 1 }, start, Math.min(0.47, start + dur), 'power3.inOut');
  });
  tw(detect, { walls: 0.3 }, 0.43, 0.47, 'sine.inOut');
  tw(detect, { rooms: 0, openings: 0 }, 0.455, 0.5, 'sine.inOut');
  tw(detect, { walls: 0 }, 0.5, 0.55, 'sine.inOut');
  // S05 C — floors, joinery; material starts before the geometry settles; ink fades.
  tw(b, { material: 1 }, 0.452, 0.53, 'sine.inOut');
  tw(b, { floors: 1 }, 0.46, 0.495, 'expo.out');
  tw(b, { joinery: 1 }, 0.468, 0.5, 'power2.out');
  tw(paper, { ink: 0.35 }, 0.46, 0.53, 'sine.inOut');
  // S05 D — ground furniture grows in place, staggered 49–53 %.
  const step = 0.028 / Math.max(1, GROUND_FURNITURE.length - 1);
  GROUND_FURNITURE.forEach((id, k) => tw(o.furniture, { [id]: 1 }, 0.49 + k * step, 0.502 + k * step, 'expo.out'));
  tw(o.furniture, { [FURNITURE_GROUP]: 1 }, 0.49, 0.53, 'sine.inOut');
  tw(detect, { furniture: 0 }, 0.49, 0.53, 'sine.inOut');
  // S05 E — upper storey built on its floor, then lifted to show the stair and both floors.
  tw(b, { stair: 1 }, 0.515, 0.545, 'power3.inOut');
  tw(b, { upper: 1 }, 0.52, 0.54, 'power3.inOut');
  UPPER_WALL_IDS.forEach((id, k) => tw(o.wallRise, { [id]: 1 }, 0.524 + k * 0.002, 0.538 + k * 0.002, 'power3.inOut'));
  const upStep = 0.012 / Math.max(1, UPPER_FURNITURE.length - 1);
  UPPER_FURNITURE.forEach((id, k) => tw(o.furniture, { [id]: 1 }, 0.53 + k * upStep, 0.54 + k * upStep, 'expo.out'));
  tw(b, { upperLiftM: 2.6 }, 0.535, 0.552, 'power3.inOut');
  // S06 — lifted well clear so the interior is open above and the camera can rise out.
  tw(b, { upperLiftM: 4 }, 0.556, 0.585, 'power2.inOut');
  label('room:R1', 0.594, 0.6, 0.608, 0.614);
  label('room:R2', 0.628, 0.634, 0.644, 0.65);
  label('room:R3', 0.664, 0.669, 0.674, 0.679);
  label('room:R6', 0.684, 0.689, 0.694, 0.699);
  // S07 — out and up; cutaway; the upper storey comes down to a slight lift that keeps the
  // stair and the floor it reaches readable (S07) and leaves headroom over the cut walls (S08).
  tw(b, { upperLiftM: 1.2 }, 0.7, 0.728, 'power3.inOut');
  tw(b, { cutaway: 1 }, 0.704, 0.728, 'power2.inOut');
  label('stair', 0.726, 0.734, 0.772, 0.782);
  label('room:R7', 0.73, 0.738, 0.766, 0.776);
  label('room:R8', 0.734, 0.742, 0.766, 0.776);
  // S08 — lifted well clear (above S06's 4 m, as 4:3 widens the lens) so the elevated looks into
  // the cut ground floor and the pull-back see no slab at the top edge; S09 lowers it onto the walls.
  tw(b, { upperLiftM: 5.2 }, 0.764, 0.79, 'power2.inOut');
  // S08 — bathroom door, then the stair, then the passes.
  tw(c, { bathDoor: 1 }, 0.798, 0.814, 'power2.out');
  tw(c, { stair: 1 }, 0.826, 0.84, 'power2.out');
  tw(c, { passMarks: 1 }, 0.848, 0.866, 'power2.out');
  label('check:C4', 0.806, 0.814, 0.876, 0.888);
  label('check:C7', 0.834, 0.842, 0.876, 0.888);
  // S09 — diagnostics recede to small indicators, walls close, exports align.
  tw(c, { bathDoor: 0, stair: 0, passMarks: 0 }, 0.886, 0.93, 'sine.inOut');
  tw(misc, { semantic: 0.15 }, 0.888, 0.94, 'sine.inOut');
  tw(b, { cutaway: 0 }, 0.888, 0.93, 'sine.inOut');
  tw(b, { upperLiftM: 0 }, 0.888, 0.935, 'power3.inOut');
  tw(misc, { exports: 1 }, 0.9, 0.95, 'power2.out');
  tl.set({}, {}, 1); // total duration exactly 1
  return tl;
}

const live = blank();
const TL = build(live);

/** GSAP parks its cache (`_gsap`) on every target, so copy the numbers only. */
const freeze = <T extends object>(x: T): Readonly<T> =>
  Object.freeze(Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v === 'number')) as T);

/** Everything at scroll `p`; `aspect` (width / height) only changes the camera's framing. */
export function stateAt(p: number, aspect: number = DEFAULT_ASPECT): LandingState {
  const q = clamp01(p);
  TL.progress(q);
  const { scene, sceneLocal } = sceneAt(q);
  const cam = cameraAt(q, aspect);
  return Object.freeze({
    p: q,
    scene,
    sceneLocal,
    camera: Object.freeze({ ...cam, position: Object.freeze(cam.position), target: Object.freeze(cam.target) }),
    paper: freeze(live.paper),
    detect: freeze(live.detect),
    review: freeze(live.review),
    build: Object.freeze({ ...freeze(live.build), wallRise: freeze(live.wallRise), furniture: freeze(live.furniture) }),
    compliance: freeze(live.compliance),
    exports: live.misc.exports,
    semantic: live.misc.semantic,
    labels: freeze(live.labels),
  });
}
