/**
 * Pure rules of the landing frame loop (no three, no DOM): where the scroll
 * sits on the track, and when the ticker may sleep.
 *
 * The page used to keep three rAF loops alive forever (ScrollTrigger's own,
 * its 250 ms sync, gsap's ticker): ~280 rAF/s on a parked page. Now `p` is
 * read from Lenis' scroll against the track measured on resize, and the
 * ticker sleeps once nothing can change the next frame.
 */

/** No input for this long (ms) before the ticker may sleep. */
export const SLEEP_AFTER_INPUT_MS = 1000;
/** Pond ripples stop after this long (ms) without input or scroll; the page then sleeps. */
export const AMBIENT_IDLE_MS = 8000;
/** Ambient motion is drawn at most this often (ms): ≤ 30 fps. */
export const AMBIENT_FRAME_MS = 1000 / 30;
/** A pond smaller than this on screen (CSS px, radius) is not animated. */
export const AMBIENT_MIN_PX = 30;
/** Longest step (ms) fed to Lenis: after a sleep its lerp would otherwise jump straight to the target. */
export const MAX_STEP_MS = 50;

/** The track's start (document px) and scroll range (height - viewport), measured on resize. */
export interface TrackSpan {
  readonly top: number;
  readonly range: number;
}

/** Scroll fraction through the track, as ScrollTrigger's `start: 'top top', end: 'bottom bottom'`. */
export function progressAt(scrollY: number, span: TrackSpan): number {
  if (span.range <= 0) {
    return scrollY >= span.top ? 1 : 0;
  }
  return Math.min(1, Math.max(0, (scrollY - span.top) / span.range));
}

/** The document scroll that shows `p`. */
export function scrollFor(p: number, span: TrackSpan): number {
  return span.top + Math.max(0, span.range) * p;
}

export interface LoopState {
  /** ms since the last wheel / touch / key / pointer input. */
  readonly sinceInputMs: number;
  /** Lenis still animating (smooth or native). */
  readonly scrolling: boolean;
  /** p drawn === p raw (the damping stage has landed). */
  readonly settled: boolean;
  /** A frame is still owed (and the canvas can be seen). */
  readonly owed: boolean;
  /** Benchmark running or a tier switch waiting. */
  readonly busy: boolean;
  /** Ambient motion still wants frames. */
  readonly ambient: boolean;
}

/** True when no next frame can differ from this one: the ticker may sleep until input, scroll, resize, seek or a late asset. */
export function canSleep(s: LoopState): boolean {
  return s.sinceInputMs >= SLEEP_AFTER_INPUT_MS && !s.scrolling && s.settled && !s.owed && !s.busy && !s.ambient;
}

/** Tier switches wait for a still page: no recent input, Lenis stopped, the damped p landed. */
export function canSwitchTier(quiet: boolean, scrolling: boolean, settled: boolean): boolean {
  return quiet && !scrolling && settled;
}

/** On-screen radius (CSS px) of a sphere of `radius` at `dist` from a perspective camera with vertical `fovDeg`, viewport `heightPx` tall. */
export function radiusPx(radius: number, dist: number, fovDeg: number, heightPx: number): number {
  return (radius / (Math.max(1e-3, dist) * Math.tan((fovDeg * Math.PI) / 360))) * (heightPx / 2);
}

/**
 * Shadow-map redraws at most every `gapMs` (the house growing used to redraw it every frame: 1400+ calls).
 * `take(pending, now)` says whether this frame redraws it; a skipped one schedules `wake` for the gap's end,
 * so the last growth step still gets its shadow on a parked page.
 */
export function createShadowThrottle(gapMs: number, wake: () => void): {
  take(pending: boolean, now: number): boolean;
  reset(): void;
  dispose(): void;
} {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    take(pending, now) {
      if (!pending) {
        return false;
      }
      if (now - last >= gapMs) {
        last = now;
        return true;
      }
      timer ??= setTimeout(() => {
        timer = undefined;
        wake();
      }, gapMs - (now - last));
      return false;
    },
    reset() {
      last = -Infinity;
    },
    dispose() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
