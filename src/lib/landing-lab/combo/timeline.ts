/**
 * The combo's whole scroll in one place.
 *
 * Two progress spaces:
 * - scroll s (0..1): how far the reader has scrolled through the track (after Lenis smoothing);
 * - story p (0..1): what the stage draws (the chapter map in stage.ts / spread.ts / axo.ts).
 * `SEGMENTS` gives each stretch of story a scroll length in vh. Transitions get more vh per unit of story than
 * the stretches around them: the "dwell" that makes a cut slow down instead of flashing by. The knots are joined
 * by a monotone cubic (Fritsch–Carlson), so story speed changes smoothly — gentle plateaus, never a kink.
 * Inside a transition the shown p may not move faster than `CLAMP_S` seconds per transition (velocity clamp),
 * and a transition that needs photographed frames waits at its edge until they are decoded (readiness gate).
 */

export interface Segment {
  /** Story p where the segment ends (it starts where the previous one ended). */
  readonly to: number;
  /** Scroll length in vh. More vh per story = slower = dwell. */
  readonly vh: number;
  /** A transition: velocity-clamped and frame-gated. */
  readonly transition?: string;
}

/**
 * Knob: chapter lengths. Read as "this much scrolling for this much story". Sums to the track length (+100 vh of
 * sticky viewport). Tuned with tools/transitions.mjs: a normal wheel (100 px / 166 ms) spends ≥ 1.2 s in each
 * transition.
 */
export const SEGMENTS: readonly Segment[] = [
  { to: 0.1, vh: 110 }, // 1 drawing set draws itself
  { to: 0.13, vh: 50 }, // 2 light red-pencil pass on all four
  { to: 0.155, vh: 80, transition: 'set → tầng 1' }, // tầng 1 grows into the plate
  { to: 0.2, vh: 80 }, // main red pencil + tally
  { to: 0.32, vh: 210 }, // 2b exploded axonometric and back down
  { to: 0.345, vh: 40 }, // book chrome slides away
  { to: 0.375, vh: 100, transition: 'trang sách → bàn' }, // ink → photographed print (match cut)
  { to: 0.5, vh: 150 }, // 4 white model on the desk
  { to: 0.57, vh: 170, transition: 'mô hình → nhà thật' }, // 5 A → clay → materials paint in
  { to: 0.78, vh: 210 }, // 6 exterior to the door
  { to: 0.8, vh: 70, transition: 'qua cửa' }, // threshold into the house
  { to: 1, vh: 200 }, // 7 interior, closing line
];

/**
 * Knob: top speed of the shown story anywhere, story units per second, after Lenis. 0.18 ≈ 2.5 viewport heights
 * of scroll per second at the track's average density (1 story over ~14 screens): a fast flick glides instead of
 * bursting through frames (and their decodes). The scrollbar stays honest: only the drawing lags, then catches up.
 */
export const MAX_STORY_PER_S = 0.18;
/** Knob: how quickly the shown story eases toward the target (1/s); the cap above limits it further. */
export const EASE_PER_S = 12;
/** Knob: a scroll jump larger than this in one frame (Home/End, scrollbar drag) lands at once with a 340 ms fade. */
export const JUMP = 0.1;
/** Knob: longest the readiness gate may hold (ms) before drawing the nearest frames anyway. */
export const GATE_MAX_MS = 2500;

/** Knob: minimum seconds the shown story spends inside any transition, whatever the scroll speed. */
export const CLAMP_S = 1.25;
/**
 * One frame of the shown story: ease toward the Lenis-smoothed target, cap the speed (MAX_STORY_PER_S), then the
 * transition clamp. No stepping: the eased step only ever shrinks.
 */
export function follow(shown: number, target: number, dt: number): number {
  const eased = (target - shown) * (1 - Math.exp(-EASE_PER_S * dt));
  const cap = MAX_STORY_PER_S * dt;
  const want = shown + Math.max(-cap, Math.min(cap, eased));
  const next = clampStep(shown, want, dt);
  return Math.abs(target - next) < 1e-5 ? target : next;
}

/** Knob: Lenis smoothing (0..1 per frame; lower = more glide). */
export const LENIS_LERP = 0.11;

export const TRACK_VH = SEGMENTS.reduce((s, g) => s + g.vh, 0) + 100;

interface Knot {
  readonly s: number;
  readonly p: number;
}

const KNOTS: readonly Knot[] = (() => {
  const total = TRACK_VH - 100;
  let acc = 0;
  const out: Knot[] = [{ s: 0, p: 0 }];
  for (const g of SEGMENTS) {
    acc += g.vh;
    out.push({ s: acc / total, p: g.to });
  }
  return out;
})();

/** Fritsch–Carlson tangents: monotone, so the story never runs backwards between knots. */
const TANGENTS: readonly number[] = (() => {
  const n = KNOTS.length;
  const d = KNOTS.slice(1).map((k, i) => (k.p - (KNOTS[i]?.p ?? 0)) / (k.s - (KNOTS[i]?.s ?? 0)));
  const m = KNOTS.map((_, i) => (i === 0 ? (d[0] ?? 0) : i === n - 1 ? (d[n - 2] ?? 0) : ((d[i - 1] ?? 0) + (d[i] ?? 0)) / 2));
  for (let i = 0; i < n - 1; i += 1) {
    const di = d[i] ?? 0;
    if (di === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = (m[i] ?? 0) / di;
    const b = (m[i + 1] ?? 0) / di;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * di) / h;
      m[i + 1] = (3 * b * di) / h;
    }
  }
  return m;
})();

/** Scroll s (0..1) → story p (0..1). */
export function storyAt(s: number): number {
  const x = Math.min(1, Math.max(0, s));
  let i = 0;
  while (i < KNOTS.length - 2 && x > (KNOTS[i + 1]?.s ?? 1)) i += 1;
  const a = KNOTS[i] ?? { s: 0, p: 0 };
  const b = KNOTS[i + 1] ?? { s: 1, p: 1 };
  const h = b.s - a.s;
  const t = h > 0 ? (x - a.s) / h : 0;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * a.p + (t3 - 2 * t2 + t) * h * (TANGENTS[i] ?? 0) + (-2 * t3 + 3 * t2) * b.p + (t3 - t2) * h * (TANGENTS[i + 1] ?? 0)
  );
}

/** Story p → scroll s (for seeking): bisection on the monotone map. */
export function scrollAt(p: number): number {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (storyAt(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Transition {
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

export const TRANSITIONS: readonly Transition[] = SEGMENTS.flatMap((g, i) =>
  g.transition === undefined ? [] : [{ name: g.transition, from: SEGMENTS[i - 1]?.to ?? 0, to: g.to }],
);

/**
 * One frame of the velocity clamp. Outside transitions `shown` follows the Lenis-smoothed target freely, but stops
 * at the edge of the next transition; inside a transition it moves at most (width / CLAMP_S) × dt per frame, so
 * every transition lasts ≥ CLAMP_S seconds however fast the wheel turns.
 */
export function clampStep(shown: number, target: number, dt: number): number {
  if (target === shown) return target;
  const fwd = target > shown;
  const eps = 1e-6;
  const next = fwd
    ? TRANSITIONS.find((t) => t.to > shown + eps && t.from < target)
    : [...TRANSITIONS].reverse().find((t) => t.from < shown - eps && t.to > target);
  if (next === undefined) return target;
  const inside = fwd ? shown >= next.from - eps : shown <= next.to + eps;
  if (!inside) return fwd ? Math.min(target, next.from) : Math.max(target, next.to);
  const step = ((next.to - next.from) / CLAMP_S) * Math.max(dt, 0);
  return fwd ? Math.min(target, shown + step) : Math.max(target, shown - step);
}

/**
 * Knob: which story p ranges need which photographed sequence, and when each starts downloading. Earlier than one
 * chapter ahead, at low concurrency (sources.ts), and paused while the reader scrolls through the drawings: measured,
 * a download + decode burst under a drawn chapter costs it half its frames on Intel UHD.
 */
export const NEEDS = {
  a: { from: 0.345, to: 0.57, prefetchAt: 0 },
  b: { from: 0.5, to: 1, prefetchAt: 0.12 },
} as const;
