/**
 * The choreography: every non-camera value as tweens in SCREENS, anchored to
 * the camera's waypoints (`arrive`/`leave`) and scene starts, so a retimed shot
 * list drags its build along. Big model motions (storey and roof lifts) happen
 * only inside camera holds — one big motion at a time (budget test asserts it).
 *
 * Placeholder beats for the villa fields (CAM-V refines): site and planting grow
 * round the hero build, the roof lands after the walls, roof + storey lift away
 * in the settle hold, ceilings close during the walk, water fills late in S05.
 */

import { gsap } from 'gsap';

import { LANDING_HOUSE } from '../house';

import { arrive, cameraAt, leave, TRACK_SCREENS } from './camera';
import {
  furnitureOrder,
  LABEL_IN,
  LABEL_MIN_VISIBLE,
  LABEL_OUT,
  slotsEnd,
  WALL_EASE,
  wallSchedule,
  type PieceFact,
  type WallFact,
} from './recipes';
import { sceneStart } from './scenes';

type Bag = Record<string, number>;
const zeros = (ids: readonly string[]): Bag => Object.fromEntries(ids.map((id) => [id, 0]));

const plan = LANDING_HOUSE.plan;
/** The lowest level is the ground floor; everything above rides the upper-storey lift. */
const GROUND_LEVEL = [...plan.levels].sort((a, b) => a.elevationMm - b.elevationMm)[0]?.id;
const onGround = (levelId: string | undefined): boolean => (levelId ?? GROUND_LEVEL) === GROUND_LEVEL;
const GROUND_WALLS = plan.walls.filter((x) => onGround(x.levelId));
const UPPER_WALLS = plan.walls.filter((x) => !onGround(x.levelId));
const GROUND_FURNITURE = plan.furniture.filter((x) => onGround(x.levelId)).map((x) => x.id);
const UPPER_FURNITURE = plan.furniture.filter((x) => !onGround(x.levelId)).map((x) => x.id);
const LABELLED = LANDING_HOUSE.detections.filter((d) => d.labelled).map((d) => `det:${d.furnitureId}`);

/** The group value for furniture ids the timeline does not know. */
export const FURNITURE_GROUP = '*';

/** Ink at p 0: the openings (0–0.42 of the layer) are already drawn, so the first frame reads as a
 * plan; S01 then draws the stair, furniture symbols and axes (stage/ink/strokes.ts windows). */
const OPENING_INK = 0.42;

/** Label ids (stage/anchors.ts); R3/R6 stay 0 until CAM-V's walk visits the bedrooms again. */
const LABEL_IDS = [...LABELLED, 'gap', 'room:R1', 'room:R2', 'room:R3', 'room:R6', 'room:R7', 'room:R8', 'stair', 'check:C4', 'check:C7'];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- the shape IS the definition
export function blank() {
  return {
    paper: { opacity: 1, ink: OPENING_INK, junkInk: 0, axes: 0, dims: 0, liftM: 0 },
    detect: { walls: 0, rooms: 0, openings: 0, furniture: 0, labels: 0, explodeM: 0 },
    review: { highlight: 0, close: 0 },
    build: {
      floors: 0,
      joinery: 0,
      material: 0,
      stair: 0,
      upper: 0,
      upperLiftM: 0,
      cutaway: 0,
      roof: 0,
      roofLiftM: 0,
      ceiling: 0,
      site: 0,
      planting: 0,
      water: 0,
    },
    wallRise: zeros(plan.walls.map((x) => x.id)),
    furniture: zeros([...GROUND_FURNITURE, ...UPPER_FURNITURE, FURNITURE_GROUP]),
    compliance: { bathDoor: 0, stair: 0, passMarks: 0 },
    misc: { exports: 0, semantic: 0 },
    labels: zeros(LABEL_IDS),
  };
}

type Live = ReturnType<typeof blank>;

const camXZ = (t: number): readonly [number, number] => {
  const [x, , z] = cameraAt(t / TRACK_SCREENS).position;
  return [x, z];
};

/** Wall facts for the rise recipe: exterior = load-bearing or ≥ 200 mm; distance from the camera at `t`. */
function wallFacts(walls: typeof GROUND_WALLS, t: number): WallFact[] {
  const [cx, cz] = camXZ(t);
  return walls.map((x) => {
    const [ax = 0, az = 0] = x.start;
    const [bx = 0, bz = 0] = x.end;
    const dist = Math.hypot((ax + bx) / 2000 - cx, (az + bz) / 2000 - cz);
    return { id: x.id, ext: x.kind === 'loadBearing' || x.thicknessMm >= 200, len: Math.hypot(bx - ax, bz - az) / 1000, dist };
  });
}

const inPoly = (pt: readonly number[], poly: readonly (readonly number[])[]): boolean => {
  const [px = 0, py = 0] = pt;
  let odd = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi = 0, yi = 0] = poly[i] ?? [];
    const [xj = 0, yj = 0] = poly[j] ?? [];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
};

/** Furniture facts: the room whose outline holds the piece's centre (else the piece is its own group). */
function pieceFacts(ids: readonly string[], t: number): PieceFact[] {
  const [cx, cz] = camXZ(t);
  return ids.map((id) => {
    const f = plan.furniture.find((x) => x.id === id);
    const c = f?.centreMm ?? [0, 0];
    const room = plan.rooms.find((r) => r.levelId === (f?.levelId ?? GROUND_LEVEL) && inPoly(c, r.outline));
    const pts = room?.outline ?? [c];
    const [rx = 0, rz = 0] = [0, 1].map((k) => pts.reduce((a, q) => a + (q[k] ?? 0), 0) / pts.length / 1000);
    const [fx = 0, fz = 0] = c.map((v) => v / 1000);
    return { id, room: room?.id ?? id, fromCentre: Math.hypot(fx - rx, fz - rz), roomDist: Math.hypot(rx - cx, rz - cz) };
  });
}

/** Builds the timeline (time in screens); `tw` schedules target[key]: (last value) → value over [start, end]. */
export function build(o: Live): gsap.core.Timeline {
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
    tl.fromTo(target, from, { ...to, duration: Math.max(1e-6, end - start), ease, immediateRender: false }, start);
  };
  /** A label fully visible over [from, to], never less than LABEL_MIN_VISIBLE screens. */
  const label = (id: string, from: number, to: number): void => {
    const end = Math.max(to, from + LABEL_MIN_VISIBLE);
    tw(o.labels, { [id]: 1 }, from - LABEL_IN, from, 'power2.out');
    tw(o.labels, { [id]: 0 }, end, end + LABEL_OUT, 'power1.in');
  };
  /** The point `f` of the way through [a, b]. */
  const at = (a: number, b: number, f: number): number => a + (b - a) * f;
  const { paper, detect, review, build: b, compliance: c, misc } = o;

  // S01 — walls are drawn from the start (stage); `ink` draws the fine layers stroke by stroke.
  const s2 = sceneStart('s02');
  tw(paper, { ink: 1 }, 0, s2 * 0.85, 'power2.out');
  tw(paper, { junkInk: 1 }, s2 * 0.15, s2 * 0.88, 'power2.out');
  tw(paper, { axes: 0.55 }, s2 * 0.38, s2 * 0.94, 'power2.out');
  tw(paper, { dims: 0.4 }, s2 * 0.5, s2 * 0.97, 'power2.out');
  // S02 — junk recedes, axes extend, dims reveal after them (varied lengths), the plane lifts.
  const s3 = sceneStart('s03');
  tw(paper, { junkInk: 0 }, at(s2, s3, 0.1), at(s2, s3, 0.55), 'power1.in');
  tw(paper, { axes: 1 }, at(s2, s3, 0.05), at(s2, s3, 0.45), 'power2.out');
  tw(paper, { dims: 1 }, at(s2, s3, 0.2), at(s2, s3, 0.8), 'power2.out');
  tw(paper, { liftM: 0.06 }, at(s2, s3, 0.02), at(s2, s3, 0.6), 'power2.inOut');
  // S03 — layers walls → rooms → openings → furniture → labels, ≈ 0.15 screen apart so the order
  // reads; explode on the way in, settle in the hold, labels staggered 0.08 across the hold.
  const [r0, r1] = [arrive('recognise'), leave('recognise')];
  tw(misc, { semantic: 1 }, s3, s3 + 0.6, 'sine.inOut');
  tw(detect, { walls: 1 }, s3 + 0.1, s3 + 0.5, 'power2.out');
  tw(detect, { rooms: 1 }, s3 + 0.3, s3 + 0.75, 'power2.out');
  tw(detect, { openings: 1 }, s3 + 0.45, s3 + 0.9, 'power2.out');
  tw(detect, { furniture: 1 }, s3 + 0.6, s3 + 1.05, 'power2.out');
  tw(detect, { labels: 1 }, r0 - 0.3, r0, 'power2.out');
  tw(detect, { explodeM: 0.4 }, s3 + 0.15, r0 - 0.2, 'power3.out');
  tw(detect, { explodeM: 0.15 }, r0 - 0.2, r1, 'power2.inOut');
  tw(paper, { dims: 0.2 }, s3 + 0.4, s3 + 1, 'sine.inOut');
  LABELLED.forEach((id, k) => label(id, r0 + k * 0.08, r1 - 0.15));
  tw(detect, { labels: 0 }, r1 - 0.05, r1 + 0.15, 'power1.in');
  // S04 — decelerate onto the gap; amber, the endpoint slides, the gap closes inside the hold, release.
  const s4 = sceneStart('s04');
  const [g0, g1] = [arrive('gap-hold'), leave('gap-hold')];
  tw(paper, { axes: 0.3 }, s4, s4 + 0.6, 'sine.inOut');
  tw(detect, { explodeM: 0 }, s4, s4 + 0.8, 'power2.inOut');
  tw(review, { highlight: 1 }, g0 - 0.5, g0, 'power2.out');
  tw(review, { close: 1 }, at(g0, g1, 0.25), at(g0, g1, 0.8), 'power3.inOut');
  tw(review, { highlight: 0 }, g1, g1 + 0.5, 'sine.inOut');
  label('gap', g0 - 0.1, at(g0, g1, 0.85));
  // S05 A — the plane settles back, drawing references recede; the site builds round the footprint.
  const s5 = sceneStart('s05');
  const settle = arrive('hero-settle');
  const h1 = leave('hero-settle');
  tw(paper, { liftM: 0 }, s5, s5 + 0.6, 'power2.inOut');
  tw(paper, { axes: 0, dims: 0 }, s5 + 0.5, s5 + 1.3, 'sine.inOut');
  tw(b, { site: 1 }, s5 + 0.3, arrive('hero-orbit'), 'power2.inOut');
  // S05 B — ground walls rise (recipe); the semantic outlines recede under them.
  const wall0 = s5 + 0.8;
  const ground = wallSchedule(wallFacts(GROUND_WALLS, wall0), wall0);
  ground.forEach((x) => tw(o.wallRise, { [x.id]: 1 }, x.start, x.end, WALL_EASE));
  const wallsUp = slotsEnd(ground);
  tw(detect, { walls: 0.3 }, wall0, wallsUp, 'sine.inOut');
  tw(detect, { rooms: 0, openings: 0 }, wall0 + 0.4, wallsUp + 0.4, 'sine.inOut');
  tw(detect, { walls: 0 }, wallsUp + 0.4, wallsUp + 1.2, 'sine.inOut');
  // S05 C — floors, joinery; the material starts before the geometry settles; ink fades.
  tw(b, { material: 1 }, wall0 + 0.5, wallsUp + 1.4, 'sine.inOut');
  tw(b, { floors: 1 }, wallsUp - 0.4, wallsUp + 0.2, 'power2.inOut');
  tw(b, { joinery: 1 }, wallsUp - 0.2, wallsUp + 0.4, 'power2.out');
  tw(paper, { ink: 0.35 }, wallsUp - 0.3, wallsUp + 1, 'sine.inOut');
  // S05 D — ground furniture settles room by room; planting grows in alongside.
  const furn0 = wallsUp + 0.2;
  const pieces = furnitureOrder(pieceFacts(GROUND_FURNITURE, furn0), furn0);
  pieces.forEach((x) => tw(o.furniture, { [x.id]: 1 }, x.start, x.end, 'power2.out'));
  const furnUp = Math.max(furn0 + 0.4, ...pieces.map((x) => x.end));
  tw(o.furniture, { [FURNITURE_GROUP]: 1 }, furn0, furnUp, 'sine.inOut');
  tw(detect, { furniture: 0 }, furn0, furnUp, 'sine.inOut');
  tw(b, { planting: 1 }, wallsUp, settle, 'power2.out');
  // S05 E — stair and upper storey on its floor (walls by the same recipe); the roof lands after the
  // walls; inside the settle hold (camera near-still) storey and roof lift away, the water fills.
  const up0 = Math.max(furn0, settle - 1.2);
  tw(b, { stair: 1 }, up0, up0 + 0.5, 'power2.inOut');
  tw(b, { upper: 1 }, up0, up0 + 0.4, 'power2.inOut');
  const upper = wallSchedule(wallFacts(UPPER_WALLS, up0), up0 + 0.1);
  upper.forEach((x) => tw(o.wallRise, { [x.id]: 1 }, x.start, x.end, WALL_EASE));
  furnitureOrder(pieceFacts(UPPER_FURNITURE, up0), up0 + 0.3).forEach((x) =>
    tw(o.furniture, { [x.id]: 1 }, x.start, x.end, 'power2.out'),
  );
  tw(b, { roof: 1 }, Math.max(upper.length > 0 ? slotsEnd(upper) : 0, wallsUp), settle, 'power2.out');
  tw(b, { upperLiftM: 4, roofLiftM: 6 }, at(settle, h1, 0.1), at(settle, h1, 0.8), 'power2.inOut');
  tw(b, { water: 1 }, at(settle, h1, 0.2), h1, 'sine.inOut');
  // S06 — the ceiling closes over the rooms once inside, opens before the rise out; room labels
  // across each room's hold.
  tw(b, { ceiling: 1 }, arrive('door'), arrive('living'), 'sine.inOut');
  tw(b, { ceiling: 0 }, leave('kitchen') - 0.3, leave('kitchen'), 'sine.inOut');
  label('room:R1', arrive('living'), leave('living'));
  label('room:R2', arrive('kitchen'), leave('kitchen'));
  // S07 — cutaway on the way out; in the axo hold the storey comes down to a slight lift that keeps
  // the stair and its floor readable; after the labels it lifts clear for S08's elevated looks.
  const [a0, a1] = [arrive('axo'), leave('axo')];
  const [x0, x1] = [arrive('stair-axo'), leave('stair-axo')];
  tw(b, { cutaway: 1 }, leave('kitchen'), leave('kitchen') + 1.2, 'power2.inOut');
  tw(b, { upperLiftM: 1.2 }, at(a0, a1, 0.05), at(a0, a1, 0.55), 'power2.inOut');
  label('stair', at(a0, a1, 0.6), at(x0, x1, 0.3));
  label('room:R7', at(a0, a1, 0.6), a1);
  label('room:R8', at(a0, a1, 0.64), a1);
  tw(b, { upperLiftM: 5.2 }, at(x0, x1, 0.45), at(x0, x1, 0.95), 'power2.inOut');
  // S08 — bathroom door, then the stair, then the passes; the storey comes down in the pull-back hold.
  const [w0, w1] = [arrive('wc-look'), leave('wc-look')];
  const [t0, t1] = [arrive('stair-look'), leave('stair-look')];
  const [b0, b1] = [arrive('both'), leave('both')];
  tw(c, { bathDoor: 1 }, w0 - 0.3, w0 + 0.1, 'power2.out');
  tw(c, { stair: 1 }, t0 - 0.3, t0 + 0.1, 'power2.out');
  tw(c, { passMarks: 1 }, b0 - 0.4, b0 + 0.2, 'power2.out');
  label('check:C4', w0, w1);
  label('check:C7', t0, t1);
  tw(b, { upperLiftM: 0 }, at(b0, b1, 0.3), at(b0, b1, 0.95), 'power2.inOut');
  // S09 — diagnostics recede to small indicators, walls close, the roof comes home in the final hold
  // while the exports align (the camera's 1.5 % push-in lands it).
  const [e0, e1] = [arrive('hero'), leave('hero')];
  tw(c, { bathDoor: 0, stair: 0, passMarks: 0 }, b1, b1 + 1, 'sine.inOut');
  tw(misc, { semantic: 0.15 }, b1, b1 + 1.2, 'sine.inOut');
  tw(b, { cutaway: 0 }, b1, b1 + 1.2, 'sine.inOut');
  tw(b, { roofLiftM: 0 }, at(e0, e1, 0.02), at(e0, e1, 0.5), 'power2.inOut');
  tw(misc, { exports: 1 }, e0 - 0.6, at(e0, e1, 0.7), 'power2.out');
  tl.set({}, {}, TRACK_SCREENS); // total duration exactly the track
  return tl;
}
