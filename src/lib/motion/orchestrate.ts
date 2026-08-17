/**
 * Who is allowed to move, when, and how fast when the machine is struggling.
 *
 * `tokens.ts` says how long a thing takes and what curve it takes it on.
 * `transition.ts` plays one. This file decides the things neither of those can
 * see: that a scene change has two halves which overlap rather than queue, that
 * only one scene change may be in flight, and that a viewer dropping frames
 * should be shown less movement rather than more.
 *
 * ## A scene change is one duration, divided
 *
 * A handover has an outgoing half and an incoming half, and the interesting
 * number is not either of them but the **overlap** — the window where both are
 * on screen. Too little and the screen is briefly empty, which reads as a flash.
 * Too much and the two drawings are legible at once, which reads as a smear.
 *
 * So the overlap is not a fourth number somebody tuned. Each kind of change
 * declares three slots from the ladder — a *total*, an *exit* and an *enter* —
 * and the overlap falls out of the arithmetic:
 *
 * ```
 *   enter starts at   total − enter
 *   overlap          = exit − (total − enter)
 * ```
 *
 * The total is one slot from the ladder, so a scene change is as long as some
 * single duration the product already uses, and never a fifth timing invented
 * for the occasion.
 *
 * | Kind     | Total          | Exit          | Enter          | Overlap |
 * |----------|----------------|---------------|----------------|--------:|
 * | `view`   | `slow` 340     | `fast` 180    | `standard` 260 |  100 ms |
 * | `screen` | `standard` 260 | `instant` 120 | `fast` 180     |   40 ms |
 * | `floor`  | `fast` 180     | `instant` 120 | `instant` 120  |   60 ms |
 *
 * 2D↔3D is the slow one because it replaces everything the reader is looking at.
 * A floor change is the quick one because the drawing is largely the same shape
 * and only the contents differ — animating it at the pace of a view change would
 * make paging through a building feel like wading.
 *
 * ## One at a time, and never by waiting
 *
 * Two scene changes at once would cross-fade three drawings, so the orchestrator
 * runs one. The way it enforces that matters: a second {@link
 * SceneOrchestrator.begin} **supersedes** the first rather than queueing behind
 * it. Queueing would mean the reader's second keystroke waits for an animation
 * to finish, which is precisely the thing a transition must never do — the
 * animation exists to explain the change, and the moment it starts delaying the
 * change it has stopped earning its place. `begin` therefore always starts
 * immediately, always returns a plan, and never refuses.
 *
 * Nothing here disables pointer events, and nothing here has a "blocking" mode
 * to turn on. A transition is something the caller *draws*; it is not something
 * the caller waits for.
 *
 * ## Only what the compositor can do alone
 *
 * Every plan animates `opacity` and `transform` and nothing else. Animating a
 * width, a height, a `top` or a margin makes the browser re-run layout on every
 * frame of the animation, for the whole subtree — on a floor plan with a few
 * thousand nodes that is the difference between a transition and a freeze.
 * {@link layoutTriggeringIn} names the offenders and {@link assertComposited}
 * refuses them, so the constraint is checked rather than remembered.
 *
 * ## When the machine is struggling
 *
 * The frame-rate signal comes from R-04 — `PerfMonitor` in
 * `src/lib/three/perf/monitor.ts`, whose `PerfSample.frameRate` and `isDegraded`
 * both satisfy {@link MotionPerformanceSignal} structurally, so a caller wires
 * `onSample` straight in with no adapter.
 *
 * **The threshold is restated here rather than imported, and that is
 * deliberate.** R-04's floor lives in `SCENE_BUDGET.minFrameRate.mobile`, in a
 * module that imports `three`. This module is imported by checkboxes and
 * tooltips; making the motion vocabulary drag in the 3D renderer to learn one
 * integer would be a poor trade. Instead {@link LOW_FRAME_RATE} is declared here
 * and `orchestrate.test.ts` asserts it equals R-04's floor — the test may import
 * `three` freely because it is not bundled. The two cannot drift, and nothing
 * ships that did not need to.
 *
 * Low performance drops every duration to the **instant** slot rather than to
 * zero. Zero is what `prefers-reduced-motion` means, and it means it because a
 * person asked; a slow machine has not asked for anything, and a 120 ms
 * handover still tells them the screen changed. Reduced motion therefore wins
 * over low performance wherever both apply.
 */

import {
  clampProgress,
  easingOf,
  MOTION_DURATIONS_MS,
  type MotionDurationName,
  type MotionEasingName,
  type ReducedMotionOption,
} from './tokens';

/* -------------------------------------------------------------------------- */
/* What may be animated at all.                                                */
/* -------------------------------------------------------------------------- */

/** Properties the compositor animates on its own, without re-running layout. */
export type CompositedProperty = 'opacity' | 'transform' | 'filter';

/** The allowlist. Anything outside it costs a layout pass per frame. */
export const COMPOSITED_PROPERTIES: readonly CompositedProperty[] = Object.freeze([
  'opacity',
  'transform',
  'filter',
]);

export function isCompositedProperty(property: string): property is CompositedProperty {
  return (COMPOSITED_PROPERTIES as readonly string[]).includes(property);
}

/**
 * The properties in this list that would force a layout. Empty when all are safe.
 *
 * Returns the offenders rather than a boolean so a failure can say which
 * property was the problem, which is the difference between a message that fixes
 * the bug and one that starts an investigation.
 */
export function layoutTriggeringIn(properties: Iterable<string>): readonly string[] {
  return [...properties].filter((property) => !isCompositedProperty(property));
}

/** @throws RangeError naming every property that would force a layout. */
export function assertComposited(properties: Iterable<string>): void {
  const offenders = layoutTriggeringIn(properties);

  if (offenders.length > 0) {
    throw new RangeError(
      `Cấm chuyển động trên thuộc tính gây dựng lại bố cục: ${offenders.join(', ')}. ` +
        `Chỉ được dùng: ${COMPOSITED_PROPERTIES.join(', ')}.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Conditions: what the reader asked for, and what the machine can manage.     */
/* -------------------------------------------------------------------------- */

/**
 * The frame rate a viewer has to fall under before movement is cut back.
 *
 * Pinned to R-04's mobile floor by `orchestrate.test.ts` rather than imported —
 * see the module note for why the import would be the wrong trade.
 */
export const LOW_FRAME_RATE = 30;

/**
 * What R-04 reports. Structurally satisfied by `PerfSample` and by `PerfMonitor`
 * itself, so either can be handed over directly.
 */
export interface MotionPerformanceSignal {
  /** Frames per second over the last closed window. */
  readonly frameRate?: number;
  /** Whether R-04 has already dropped the scene to a cheaper drawing. */
  readonly isDegraded?: boolean;
}

/**
 * Is the machine struggling enough to cut movement back?
 *
 * A scene R-04 has already degraded counts even if the frame rate has since
 * recovered — the recovery is *because* less is being drawn, and restoring the
 * long transitions would undo it.
 */
export function isLowPerformance(
  signal: MotionPerformanceSignal | null | undefined,
  threshold: number = LOW_FRAME_RATE,
): boolean {
  if (signal === null || signal === undefined) {
    return false;
  }

  if (signal.isDegraded === true) {
    return true;
  }

  const { frameRate } = signal;

  return typeof frameRate === 'number' && Number.isFinite(frameRate) && frameRate < threshold;
}

/** Everything that can shorten a duration, in one bag. */
export interface MotionConditions extends ReducedMotionOption {
  /** Set from {@link isLowPerformance}. Drops every duration to `instant`. */
  readonly lowPerformance?: boolean;
}

/** The conditions implied by an R-04 signal, ready to merge with a caller's. */
export function conditionsFor(
  signal: MotionPerformanceSignal | null | undefined,
  base: ReducedMotionOption = {},
): MotionConditions {
  return {
    reducedMotion: base.reducedMotion === true,
    lowPerformance: isLowPerformance(signal),
  };
}

/**
 * How long a slot really lasts once the conditions are applied.
 *
 * Reduced motion is checked first and wins: it is a stated preference, where low
 * performance is a measurement. `Math.min` rather than a flat assignment so that
 * a slot already quicker than `instant` is never made *slower* by a struggling
 * machine.
 */
export function conditionedDurationMs(
  name: MotionDurationName,
  conditions: MotionConditions = {},
): number {
  if (conditions.reducedMotion === true) {
    return 0;
  }

  if (conditions.lowPerformance === true) {
    return Math.min(MOTION_DURATIONS_MS.instant, MOTION_DURATIONS_MS[name]);
  }

  return MOTION_DURATIONS_MS[name];
}

/* -------------------------------------------------------------------------- */
/* The shape of a scene change.                                                */
/* -------------------------------------------------------------------------- */

/** Which kind of scene is being handed over. */
export type SceneTransitionKind = 'view' | 'floor' | 'screen';

/** Where a scene change has got to. `idle` covers both "not started" and "over". */
export type ScenePhase = 'idle' | 'exit' | 'overlap' | 'enter';

/** The three slots a kind of change is built from. All from the ladder. */
export interface SceneTiming {
  /** The whole handover, end to end. */
  readonly total: MotionDurationName;
  /** How long the outgoing layer takes to leave. */
  readonly exit: MotionDurationName;
  /** How long the incoming layer takes to settle. */
  readonly enter: MotionDurationName;
}

/** The timings. See the table in the module note for the reasoning. */
export const SCENE_TIMINGS: Readonly<Record<SceneTransitionKind, SceneTiming>> = Object.freeze({
  view: Object.freeze({ total: 'slow', exit: 'fast', enter: 'standard' }),
  screen: Object.freeze({ total: 'standard', exit: 'instant', enter: 'fast' }),
  floor: Object.freeze({ total: 'fast', exit: 'instant', enter: 'instant' }),
});

/** One half of a handover, placed on the timeline. */
export interface PhaseWindow {
  readonly startMs: number;
  readonly durationMs: number;
  readonly endMs: number;
  readonly easing: MotionEasingName;
}

export interface SceneTransitionSpec extends MotionConditions {
  readonly kind: SceneTransitionKind;
  /** What is leaving — a view mode, a floor id, a route. For the caller's own use. */
  readonly from: string;
  /** What is arriving. */
  readonly to: string;
}

/** A scene change, fully timed, before anything has moved. */
export interface ScenePlan {
  readonly kind: SceneTransitionKind;
  readonly from: string;
  readonly to: string;
  readonly totalMs: number;
  readonly exit: PhaseWindow;
  readonly enter: PhaseWindow;
  /** How long both layers are on screen together. Derived, never declared. */
  readonly overlapMs: number;
  /** What may be animated. Always compositor-only. */
  readonly properties: readonly CompositedProperty[];
}

/** What a scene change animates. Never a property that forces layout. */
const SCENE_PROPERTIES: readonly CompositedProperty[] = Object.freeze(['opacity', 'transform']);

/**
 * Time a scene change without starting it. Pure.
 *
 * The enter window is anchored to the *end* of the total rather than to the end
 * of the exit, which is what makes the overlap fall out of the three slots
 * instead of needing a number of its own.
 */
export function planScene(spec: SceneTransitionSpec): ScenePlan {
  const timing = SCENE_TIMINGS[spec.kind];
  const totalMs = conditionedDurationMs(timing.total, spec);

  // Neither half may outlast the whole; under reduced motion all three are zero.
  const exitMs = Math.min(conditionedDurationMs(timing.exit, spec), totalMs);
  const enterMs = Math.min(conditionedDurationMs(timing.enter, spec), totalMs);
  const enterStartMs = totalMs - enterMs;

  return Object.freeze({
    kind: spec.kind,
    from: spec.from,
    to: spec.to,
    totalMs,
    exit: Object.freeze({
      startMs: 0,
      durationMs: exitMs,
      endMs: exitMs,
      easing: 'exit' as MotionEasingName,
    }),
    enter: Object.freeze({
      startMs: enterStartMs,
      durationMs: enterMs,
      endMs: totalMs,
      easing: 'enter' as MotionEasingName,
    }),
    overlapMs: Math.max(0, exitMs - enterStartMs),
    properties: SCENE_PROPERTIES,
  });
}

/* -------------------------------------------------------------------------- */
/* Playing it.                                                                 */
/* -------------------------------------------------------------------------- */

/** Where both layers stand at one instant. */
export interface SceneFrame {
  readonly phase: ScenePhase;
  /** The outgoing layer's progress away, 0 (still here) to 1 (gone). */
  readonly exit: number;
  /** The incoming layer's progress in, 0 (not yet) to 1 (arrived). */
  readonly enter: number;
  readonly done: boolean;
}

/**
 * Nothing is moving: the scene on screen is simply the scene.
 *
 * Note the asymmetry — `enter: 1` with `exit: 0`. Read as two layers it looks
 * wrong, but at rest **there is no outgoing layer to draw**: `enter` describes
 * the scene that is here, and `exit` is the progress of a departure that is not
 * happening. A caller renders the outgoing layer only while `done` is false.
 */
const IDLE_FRAME: SceneFrame = Object.freeze({
  phase: 'idle',
  exit: 0,
  enter: 1,
  done: true,
});

/** Eased position within one window, 0 before it opens and 1 after it closes. */
function progressIn(window: PhaseWindow, elapsedMs: number): number {
  if (window.durationMs <= 0) {
    return elapsedMs >= window.startMs ? 1 : 0;
  }

  const fraction = clampProgress((elapsedMs - window.startMs) / window.durationMs);

  return easingOf(window.easing).at(fraction);
}

/** Which phase a plan is in at this instant. Assumes it has not finished. */
function phaseAt(plan: ScenePlan, elapsedMs: number): ScenePhase {
  if (elapsedMs < plan.enter.startMs) {
    return 'exit';
  }

  if (elapsedMs < plan.exit.endMs) {
    return 'overlap';
  }

  return 'enter';
}

/** Sample a plan at an arbitrary time. Pure — for a caller keeping its own clock. */
export function frameAt(plan: ScenePlan, elapsedMs: number): SceneFrame {
  const at = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const done = at >= plan.totalMs;

  return {
    phase: done ? 'idle' : phaseAt(plan, at),
    exit: progressIn(plan.exit, at),
    enter: progressIn(plan.enter, at),
    done,
  };
}

/** A scene change that was cut short, and why. */
export interface SupersededScene {
  readonly plan: ScenePlan;
  /** How far it had got when it was replaced. */
  readonly atMs: number;
  readonly reason: 'superseded' | 'cancelled';
}

/**
 * Runs at most one scene change, and never makes the reader wait for it.
 *
 * It owns no clock: {@link SceneOrchestrator.advance} is driven from whatever
 * loop the caller already has, exactly as `transition.ts` is, which is what lets
 * a test step it 40 ms at a time with no DOM.
 */
export interface SceneOrchestrator {
  /** The plan in flight, or `null`. */
  readonly plan: ScenePlan | null;
  /** Is a scene change actually moving right now? */
  readonly isRunning: boolean;
  readonly phase: ScenePhase;
  readonly elapsedMs: number;
  /** How many changes have been cut short by a later one. */
  readonly supersededCount: number;
  /** The most recent change that did not get to finish. */
  readonly lastSuperseded: SupersededScene | null;
  /**
   * Start a scene change now, replacing any in flight.
   *
   * Never queues, never refuses, never throws. The returned plan is already the
   * current one.
   */
  begin(spec: SceneTransitionSpec): ScenePlan;
  /** Move time on and report where both layers stand. */
  advance(deltaMs: number): SceneFrame;
  /** Report where both layers stand, without moving time on. */
  sample(): SceneFrame;
  /** Stop without finishing. The incoming layer is left wherever it had got to. */
  cancel(): void;
}

export function createSceneOrchestrator(): SceneOrchestrator {
  let plan: ScenePlan | null = null;
  let elapsedMs = 0;
  let supersededCount = 0;
  let lastSuperseded: SupersededScene | null = null;

  const currentFrame = (): SceneFrame => (plan === null ? IDLE_FRAME : frameAt(plan, elapsedMs));

  /** Record the running plan as cut short, if it had not already finished. */
  const retire = (reason: SupersededScene['reason']): void => {
    if (plan === null || elapsedMs >= plan.totalMs) {
      return;
    }

    lastSuperseded = { plan, atMs: elapsedMs, reason };

    if (reason === 'superseded') {
      supersededCount += 1;
    }
  };

  return {
    get plan() {
      return plan;
    },
    get isRunning() {
      return plan !== null && elapsedMs < plan.totalMs;
    },
    get phase() {
      return currentFrame().phase;
    },
    get elapsedMs() {
      return elapsedMs;
    },
    get supersededCount() {
      return supersededCount;
    },
    get lastSuperseded() {
      return lastSuperseded;
    },
    begin: (spec) => {
      retire('superseded');
      plan = planScene(spec);
      elapsedMs = 0;

      return plan;
    },
    advance: (deltaMs) => {
      if (plan !== null && Number.isFinite(deltaMs) && deltaMs > 0) {
        elapsedMs = Math.min(plan.totalMs, elapsedMs + deltaMs);
      }

      return currentFrame();
    },
    sample: currentFrame,
    cancel: () => {
      retire('cancelled');
      plan = null;
      elapsedMs = 0;
    },
  };
}
