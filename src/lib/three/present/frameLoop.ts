/**
 * Drawing only when a frame would look different — the loop behind the sway.
 *
 * A scene that sways at sixty frames a second spends most of those frames
 * drawing a picture nobody could tell from the last one: the model turns
 * eighteen degrees each way over twenty-one seconds, which at the rim of a
 * twelve-metre flat is a few pixels a second, and at the ends of the sway it
 * is nothing at all. Every frame still costs the whole render — every light,
 * every pixel — and on a laptop that is a fan that never stops.
 *
 * This loop draws a frame only when three things are true at once:
 *
 * - **Every gate is open.** Motion is wanted (no reduced-motion preference),
 *   the document is visible, the canvas is on screen, and the window has focus.
 *   A closed gate stops the loop outright rather than ticking idly — a hidden
 *   tab or a scrolled-away canvas draws nothing.
 * - **The heading has moved a pixel.** The caller says how many radians a
 *   pixel is at the current viewport; a tick that would move the rim by less
 *   than that is skipped. The sway slows to a stop at each end, so most ticks
 *   there are skipped.
 * - **Enough time has passed.** A ceiling on the frame rate, so that even the
 *   fastest part of the sway is drawn at thirty frames a second and not sixty.
 *
 * When motion is off the loop does not run; the model parks at its resting
 * heading and is drawn once. Anything that changes the picture without moving
 * it — a model arriving, a resize — calls {@link FrameLoop.invalidate}, which
 * draws once more at the current heading as soon as the gates allow.
 *
 * Pausing keeps the sway's phase: a tab that is hidden for a minute resumes
 * where it was rather than jumping to where it would have been.
 *
 * No DOM here — the scheduler is injected, and `requestAnimationFrame` is only
 * the default — so a test can drive the loop with a fake clock.
 */

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** The four reasons the loop may be stopped. All must be open for it to run. */
export type LoopGate = 'motion' | 'visible' | 'onScreen' | 'focused';

export const LOOP_GATES: readonly LoopGate[] = ['motion', 'visible', 'onScreen', 'focused'];

export interface FrameLoopOptions {
  /** The heading of the sway at an elapsed time, in radians. */
  readonly headingAt: (elapsedMs: number) => number;
  /** Where the model parks when motion is off. */
  readonly restingHeading: number;
  /** Draw one frame at the heading given. */
  readonly render: (heading: number) => void;
  /**
   * The smallest heading change worth a frame, in radians. Read on every tick,
   * because it follows the viewport: a bigger canvas makes a pixel a smaller angle.
   */
  readonly minStep: () => number;
  /** Frame scheduling; `requestAnimationFrame` by default. */
  readonly schedule?: (callback: (nowMs: number) => void) => number;
  readonly cancel?: (handle: number) => void;
  /** The most frames drawn per second while swaying. */
  readonly maxFps?: number;
}

export interface FrameLoop {
  /** Open or close one gate. The loop runs only while every gate is open. */
  readonly setGate: (gate: LoopGate, open: boolean) => void;
  /** Whether a gate is open. */
  readonly isOpen: (gate: LoopGate) => boolean;
  /** Something in the picture changed: draw again as soon as the gates allow. */
  readonly invalidate: () => void;
  /** Whether the sway is ticking right now. */
  readonly isRunning: () => boolean;
  /** The heading of the last frame drawn, or the resting heading before any. */
  readonly lastHeading: () => number;
  /** How many frames have been drawn — for a test or a diagnostic. */
  readonly framesDrawn: () => number;
  /** Stop for good. */
  readonly dispose: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The ceiling on the sway's frame rate. A rate, not a motion duration: rule B's
 * ladder says how long a movement takes, and the sway's period is on it; this
 * says how often the movement is sampled, and is a performance choice.
 */
export const MAX_SWAY_FPS = 30;

/**
 * Slack when deciding whether an interval has passed. A display ticks a touch
 * early or late, and a thirty-a-second cap that demanded exactly 33,3 ms would
 * draw every third frame of sixty rather than every second.
 */
const INTERVAL_TOLERANCE_MS = 1;

/* -------------------------------------------------------------------------- */
/* The loop.                                                                   */
/* -------------------------------------------------------------------------- */

/** Frame scheduling as the browser offers it. */
function defaultScheduler(): Pick<Required<FrameLoopOptions>, 'schedule' | 'cancel'> {
  return {
    schedule: (callback) => globalThis.requestAnimationFrame(callback),
    cancel: (handle) => {
      globalThis.cancelAnimationFrame(handle);
    },
  };
}

/**
 * Build a loop. Every gate starts **open** and the loop does not tick until a
 * gate is set or `invalidate()` is called — so a caller wires its gates, then
 * invalidates once, and the first frame follows on the next tick.
 */
export function createFrameLoop(options: FrameLoopOptions): FrameLoop {
  const { headingAt, restingHeading, render, minStep } = options;
  const { schedule, cancel } = { ...defaultScheduler(), ...options };
  const minIntervalMs = 1000 / (options.maxFps ?? MAX_SWAY_FPS);

  const gates: Record<LoopGate, boolean> = { motion: true, visible: true, onScreen: true, focused: true };
  let handle: number | null = null;
  let disposed = false;
  /** The first frame is always owed. */
  let dirty = true;
  let drawn = 0;
  let lastHeading = restingHeading;
  let lastDrawAt = -Infinity;
  let lastTickAt: number | null = null;
  /** The sway's phase, kept across pauses. */
  let elapsedAtPause = 0;
  let resumedAt: number | null = null;

  const running = (): boolean => handle !== null;
  const wanted = (): boolean => LOOP_GATES.every((gate) => gates[gate]);
  /** Whether a single parked frame may be drawn right now. */
  const showable = (): boolean => gates.visible && gates.onScreen;

  const draw = (heading: number, nowMs: number): void => {
    render(heading);
    lastHeading = heading;
    lastDrawAt = nowMs;
    dirty = false;
    drawn += 1;
  };

  const tick = (nowMs: number): void => {
    if (disposed || handle === null) {
      return;
    }

    resumedAt ??= nowMs;
    lastTickAt = nowMs;
    const heading = headingAt(elapsedAtPause + (nowMs - resumedAt));
    const intervalPassed = nowMs - lastDrawAt + INTERVAL_TOLERANCE_MS >= minIntervalMs;
    const moved = Math.abs(heading - lastHeading) >= minStep();

    if (dirty || (intervalPassed && moved)) {
      draw(heading, nowMs);
    }

    handle = schedule(tick);
  };

  /** Stop ticking, and bank the phase the sway had reached as of its last tick. */
  const stop = (): void => {
    if (handle === null) {
      return;
    }

    cancel(handle);
    handle = null;
    if (resumedAt !== null && lastTickAt !== null) {
      elapsedAtPause += lastTickAt - resumedAt;
    }
    resumedAt = null;
  };

  /** One frame, parked, drawn on the next tick so several invalidations coalesce. */
  let parkedHandle: number | null = null;
  const drawParked = (): void => {
    if (parkedHandle !== null) {
      return;
    }
    parkedHandle = schedule((nowMs) => {
      parkedHandle = null;
      if (!disposed && !running() && showable() && dirty) {
        draw(gates.motion ? lastHeading : restingHeading, nowMs);
      }
    });
  };

  const reconcile = (): void => {
    if (disposed) {
      return;
    }

    if (wanted()) {
      if (!running()) {
        handle = schedule(tick);
      }
      return;
    }

    if (running()) {
      stop();
      // Pausing for a hidden tab or a lost focus: the last frame stays. Parking
      // for reduced motion: the model has to be drawn at rest.
      if (!gates.motion) {
        dirty = true;
      }
    }

    if (dirty && showable()) {
      drawParked();
    }
  };

  return {
    setGate: (gate, open) => {
      if (gates[gate] === open) {
        return;
      }
      gates[gate] = open;
      reconcile();
    },
    isOpen: (gate) => gates[gate],
    invalidate: () => {
      dirty = true;
      if (!running()) {
        reconcile();
      }
    },
    isRunning: running,
    lastHeading: () => lastHeading,
    framesDrawn: () => drawn,
    dispose: () => {
      disposed = true;
      stop();
      if (parkedHandle !== null) {
        cancel(parkedHandle);
        parkedHandle = null;
      }
    },
  };
}
