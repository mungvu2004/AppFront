/**
 * The combo's whole scroll in one place.
 *
 * Two progress spaces:
 * - scroll s (0..1): how far the reader has scrolled through the track (after Lenis smoothing);
 * - story p (0..1): what the stage draws (the chapter map in stage.ts / spread.ts / axo.ts).
 * `SEGMENTS` gives each stretch of story a scroll length in vh. Transitions get more vh per unit of story than
 * the stretches around them: the "dwell" that makes a cut slow down instead of flashing by. The knots are joined
 * by a monotone cubic (Fritsch–Carlson), so story speed changes smoothly — gentle plateaus, never a kink.
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
  { to: 0.155, vh: 70, transition: 'set → tầng 1' }, // tầng 1 grows into the plate
  { to: 0.2, vh: 80 }, // main red pencil + tally
  { to: 0.32, vh: 220 }, // 2b exploded axonometric and back down
  { to: 0.345, vh: 40 }, // book chrome slides away
  { to: 0.375, vh: 90, transition: 'trang sách → bàn' }, // ink → photographed print (match cut)
  // 4 white model: all 250 of A's frames (pull-back, then walls rise, floors settle, roof, trees) play here.
  // ~16 px of scroll per frame at 1080p, so one wheel notch moves ~6 frames and a flick never skips the walls.
  // +101 vh for the pull-back (FLAT): it swept 38 % of the screen width per notch.
  { to: 0.5, vh: 481 },
  { to: 0.57, vh: 150, transition: 'mô hình → nhà thật' }, // 5 A → clay → materials paint in
  { to: 0.78, vh: 230 }, // 6 exterior to the door
  // 7 interior walk (389 frames int3_ from INSIDE_AT, motion-weighted, see FLAT): one frame
  // drawn at a time (a neighbour cross-fade ghosted 2-3 copies of the lamp whenever a stand-in was on screen).
  // Owner: the walk into the living room felt far too fast at 87 frames / 330 vh.
  // +311 vh over the walk for its fast turns: one notch swept 25 % of the width (int2_ frames 20-60, the dining pan).
  // int3_ (389 frames: int2_ + 216 in-betweens) measured 20 % more motion than int2_'s flow said, hence the extra.
  { to: 0.8, vh: 205, transition: 'qua cửa' }, // threshold into the house
  { to: 1, vh: 758 }, // into the living room, closing line
];

/**
 * Knob: motion-weighted frames (Seq.warp, motion.json). Inside a photographed chapter a frame gets scroll in
 * proportion to max(its on-screen motion, FLAT) (% of width per frame), so a wheel notch moves the picture at most
 * ~8 % of the width (85 px notch on an 866 px window); frames that move less than FLAT keep their old share. FLAT =
 * 8 x (old vh per frame) / 9.8 vh per notch. Change a chapter's vh in SEGMENTS together with its FLAT.
 * The walk's int3_ entries come pre-floored from assemble_int3.py (a piece of an int2_ pair split n ways gets 2.55 / n),
 * so its FLAT is 0.
 */
export const FLAT = { a: 1.25, exterior: 2.54, walk: 0 } as const;

/*
 * Why no speed cap, transition clamp or "wait for frames" gate any more (removed after owner testing): people
 * scroll in bursts — 3 to 8 notches in a flick, a pause, sometimes a notch back. A cap made the drawing trail the
 * wheel and keep moving after the hand stopped; the gate froze the picture for up to 2.5 s. Both read as jank.
 * Now the picture is exactly where the (Lenis-smoothed) scrollbar is: slow moments get scroll LENGTH in
 * SEGMENTS instead, and frames are decoded ahead off the main thread (frames.ts), the nearest one drawn meanwhile.
 */

/** Knob: a scroll jump larger than this in one frame (Home/End, scrollbar drag) lands behind a 340 ms fade. */
export const JUMP = 0.1;

/** Knob: Lenis smoothing (0..1 per frame; lower = more glide). Turns a burst of notches into one eased glide. */
export const LENIS_LERP = 0.09;
/** Knob: Lenis wheel multiplier: < 1 makes a notch cover a little less of the story. */
export const WHEEL_MULTIPLIER = 0.85;

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
  const m = KNOTS.map((_, i) =>
    i === 0 ? (d[0] ?? 0) : i === n - 1 ? (d[n - 2] ?? 0) : ((d[i - 1] ?? 0) + (d[i] ?? 0)) / 2,
  );
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
    (2 * t3 - 3 * t2 + 1) * a.p +
    (t3 - 2 * t2 + t) * h * (TANGENTS[i] ?? 0) +
    (-2 * t3 + 3 * t2) * b.p +
    (t3 - t2) * h * (TANGENTS[i + 1] ?? 0)
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
  g.transition === undefined
    ? []
    : [{ name: g.transition, from: SEGMENTS[i - 1]?.to ?? 0, to: g.to }],
);

/**
 * Knob: which story p ranges need which photographed sequence, and when each starts downloading. Earlier than one
 * chapter ahead, at low concurrency (sources.ts), and paused while the reader scrolls through the drawings: measured,
 * a download + decode burst under a drawn chapter costs it half its frames on Intel UHD.
 */
export const NEEDS = {
  a: { from: 0.345, to: 0.57, prefetchAt: 0 },
  b: { from: 0.5, to: 1, prefetchAt: 0.12 },
} as const;
