import { describe, expect, it } from 'vitest';

/**
 * R-04 itself, imported only here.
 *
 * `budget.ts` pulls in `three`; `orchestrate.ts` is imported by checkboxes and
 * tooltips and must not. So the threshold is restated in the motion module and
 * pinned to the real one by the test below — a test is not bundled, so it may
 * reach across the boundary that production code may not.
 */
import { SCENE_BUDGET } from '@/lib/three/perf/budget';

import {
  assertComposited,
  COMPOSITED_PROPERTIES,
  conditionedDurationMs,
  conditionsFor,
  createSceneOrchestrator,
  frameAt,
  isCompositedProperty,
  isLowPerformance,
  layoutTriggeringIn,
  LOW_FRAME_RATE,
  planScene,
  SCENE_TIMINGS,
  type SceneTransitionKind,
  type SceneTransitionSpec,
} from '../orchestrate';
import {
  MAX_STAGGERED_ITEMS,
  maxStaggerMs,
  STAGGER_BUDGET_MS,
  STAGGER_STEP_MS,
  staggerDelayMs,
  staggerDelaysMs,
  staggerSchedule,
  staggerScheduleEndMs,
} from '../stagger';
import { MOTION_DURATIONS_MS } from '../tokens';

const KINDS: readonly SceneTransitionKind[] = ['view', 'screen', 'floor'];

const spec = (over: Partial<SceneTransitionSpec> = {}): SceneTransitionSpec => ({
  kind: 'view',
  from: '2d',
  to: '3d',
  ...over,
});

/* -------------------------------------------------------------------------- */
/* The layout constraint.                                                      */
/* -------------------------------------------------------------------------- */

describe('composited properties', () => {
  it('allows only what the compositor can animate without re-running layout', () => {
    expect(COMPOSITED_PROPERTIES).toEqual(['opacity', 'transform', 'filter']);
  });

  it('recognises the safe properties', () => {
    expect(isCompositedProperty('opacity')).toBe(true);
    expect(isCompositedProperty('transform')).toBe(true);
  });

  it('refuses every property that forces a layout pass', () => {
    const offenders = ['width', 'height', 'top', 'left', 'margin', 'padding', 'font-size'];

    offenders.forEach((property) => {
      expect(isCompositedProperty(property)).toBe(false);
    });

    expect(layoutTriggeringIn(['opacity', ...offenders])).toEqual(offenders);
  });

  it('names every offender rather than only the first', () => {
    expect(() => assertComposited(['transform', 'width', 'height'])).toThrow(/width, height/u);
  });

  it('passes a list that is entirely safe', () => {
    expect(() => assertComposited(['opacity', 'transform'])).not.toThrow();
    expect(layoutTriggeringIn([])).toEqual([]);
  });

  it('never plans a scene change on a layout-triggering property', () => {
    KINDS.forEach((kind) => {
      const plan = planScene(spec({ kind }));

      expect(layoutTriggeringIn(plan.properties)).toEqual([]);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* The R-04 signal.                                                            */
/* -------------------------------------------------------------------------- */

describe('the low-performance signal', () => {
  it('uses the same frame-rate floor R-04 degrades at', () => {
    // The pin. If R-04 moves its floor, this fails rather than the two drifting.
    expect(LOW_FRAME_RATE).toBe(SCENE_BUDGET.minFrameRate.mobile);
  });

  it('reads a PerfSample-shaped reading straight from the meter', () => {
    // The fields PerfMonitor actually emits; structural typing does the rest.
    expect(isLowPerformance({ frameRate: 18 })).toBe(true);
    expect(isLowPerformance({ frameRate: 60 })).toBe(false);
  });

  it('treats the threshold itself as fast enough', () => {
    expect(isLowPerformance({ frameRate: LOW_FRAME_RATE })).toBe(false);
    expect(isLowPerformance({ frameRate: LOW_FRAME_RATE - 0.1 })).toBe(true);
  });

  it('keeps movement cut back once R-04 has already degraded the scene', () => {
    // The frame rate recovered *because* less is being drawn. Restoring the long
    // transitions would undo the thing that fixed it.
    expect(isLowPerformance({ frameRate: 60, isDegraded: true })).toBe(true);
  });

  it('assumes the machine is fine when there is no reading yet', () => {
    expect(isLowPerformance(null)).toBe(false);
    expect(isLowPerformance(undefined)).toBe(false);
    expect(isLowPerformance({})).toBe(false);
    expect(isLowPerformance({ frameRate: Number.NaN })).toBe(false);
  });

  it('folds a reading and a preference into one set of conditions', () => {
    expect(conditionsFor({ frameRate: 12 })).toEqual({
      reducedMotion: false,
      lowPerformance: true,
    });
    expect(conditionsFor({ frameRate: 60 }, { reducedMotion: true })).toEqual({
      reducedMotion: true,
      lowPerformance: false,
    });
  });
});

describe('conditionedDurationMs', () => {
  it('leaves the ladder alone when nothing is wrong', () => {
    expect(conditionedDurationMs('slow')).toBe(340);
    expect(conditionedDurationMs('standard')).toBe(260);
  });

  it('drops every slot to the instant one when the machine is struggling', () => {
    expect(conditionedDurationMs('slow', { lowPerformance: true })).toBe(120);
    expect(conditionedDurationMs('standard', { lowPerformance: true })).toBe(120);
    expect(conditionedDurationMs('fast', { lowPerformance: true })).toBe(120);
  });

  it('never makes a quick slot slower on a struggling machine', () => {
    expect(conditionedDurationMs('instant', { lowPerformance: true })).toBe(
      MOTION_DURATIONS_MS.instant,
    );
  });

  it('lets the stated preference beat the measurement', () => {
    // Reduced motion is something a person asked for; low performance is a guess.
    expect(conditionedDurationMs('slow', { reducedMotion: true, lowPerformance: true })).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Planning a scene change.                                                    */
/* -------------------------------------------------------------------------- */

describe('planScene', () => {
  it('builds every kind out of slots from the ladder', () => {
    const ladder = Object.values(MOTION_DURATIONS_MS);

    KINDS.forEach((kind) => {
      const timing = SCENE_TIMINGS[kind];

      expect(ladder).toContain(MOTION_DURATIONS_MS[timing.total]);
      expect(ladder).toContain(MOTION_DURATIONS_MS[timing.exit]);
      expect(ladder).toContain(MOTION_DURATIONS_MS[timing.enter]);
    });
  });

  it('lasts exactly one duration from the ladder, end to end', () => {
    expect(planScene(spec({ kind: 'view' })).totalMs).toBe(340);
    expect(planScene(spec({ kind: 'screen' })).totalMs).toBe(260);
    expect(planScene(spec({ kind: 'floor' })).totalMs).toBe(180);
  });

  it('overlaps the two halves rather than leaving a gap between them', () => {
    // A gap would show an empty screen between the two drawings — a flash.
    KINDS.forEach((kind) => {
      const plan = planScene(spec({ kind }));

      expect(plan.overlapMs).toBeGreaterThan(0);
      expect(plan.enter.startMs).toBeLessThan(plan.exit.endMs);
    });
  });

  it('derives the overlap from the three slots instead of declaring it', () => {
    const plan = planScene(spec({ kind: 'view' }));

    expect(plan.exit).toMatchObject({ startMs: 0, durationMs: 180, endMs: 180 });
    expect(plan.enter).toMatchObject({ startMs: 80, durationMs: 260, endMs: 340 });
    expect(plan.overlapMs).toBe(100);
  });

  it('never lets either half outlast the whole', () => {
    KINDS.forEach((kind) => {
      const plan = planScene(spec({ kind }));

      expect(plan.exit.endMs).toBeLessThanOrEqual(plan.totalMs);
      expect(plan.enter.endMs).toBe(plan.totalMs);
    });
  });

  it('moves the plan out on the exiting curve and in on the entering one', () => {
    const plan = planScene(spec());

    expect(plan.exit.easing).toBe('exit');
    expect(plan.enter.easing).toBe('enter');
  });

  it('collapses to the instant slot when the machine is struggling', () => {
    KINDS.forEach((kind) => {
      const plan = planScene(spec({ kind, lowPerformance: true }));

      expect(plan.totalMs).toBe(MOTION_DURATIONS_MS.instant);
    });
  });

  it('collapses to nothing at all under reduced motion', () => {
    const plan = planScene(spec({ reducedMotion: true }));

    expect(plan.totalMs).toBe(0);
    expect(plan.exit.durationMs).toBe(0);
    expect(plan.enter.durationMs).toBe(0);
    expect(plan.overlapMs).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Playing a scene change.                                                     */
/* -------------------------------------------------------------------------- */

describe('frameAt', () => {
  const plan = planScene(spec({ kind: 'view' }));

  it('starts with the outgoing layer present and the incoming one absent', () => {
    const frame = frameAt(plan, 0);

    expect(frame).toMatchObject({ phase: 'exit', exit: 0, enter: 0, done: false });
  });

  it('walks exit, then overlap, then enter', () => {
    expect(frameAt(plan, 40).phase).toBe('exit');
    expect(frameAt(plan, 120).phase).toBe('overlap');
    expect(frameAt(plan, 260).phase).toBe('enter');
  });

  it('has both layers part way through during the overlap', () => {
    const frame = frameAt(plan, 120);

    expect(frame.exit).toBeGreaterThan(0);
    expect(frame.exit).toBeLessThan(1);
    expect(frame.enter).toBeGreaterThan(0);
    expect(frame.enter).toBeLessThan(1);
  });

  it('ends with the handover complete', () => {
    const frame = frameAt(plan, 340);

    expect(frame).toMatchObject({ phase: 'idle', exit: 1, enter: 1, done: true });
  });

  it('stays finished afterwards rather than running on', () => {
    expect(frameAt(plan, 10_000)).toMatchObject({ exit: 1, enter: 1, done: true });
  });

  it('is finished before it starts under reduced motion', () => {
    const cut = planScene(spec({ reducedMotion: true }));

    expect(frameAt(cut, 0)).toMatchObject({ exit: 1, enter: 1, done: true });
  });

  it('treats a nonsense clock reading as the start', () => {
    expect(frameAt(plan, Number.NaN).done).toBe(false);
    expect(frameAt(plan, -50).exit).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* One at a time, and never by waiting.                                        */
/* -------------------------------------------------------------------------- */

describe('createSceneOrchestrator', () => {
  it('is idle before anything begins', () => {
    const orchestrator = createSceneOrchestrator();

    expect(orchestrator.plan).toBeNull();
    expect(orchestrator.isRunning).toBe(false);
    expect(orchestrator.phase).toBe('idle');
  });

  it('runs a scene change to completion', () => {
    const orchestrator = createSceneOrchestrator();
    orchestrator.begin(spec({ kind: 'floor', from: 'L1', to: 'L2' }));

    expect(orchestrator.isRunning).toBe(true);

    orchestrator.advance(90);
    expect(orchestrator.sample().done).toBe(false);

    const frame = orchestrator.advance(90);
    expect(frame.done).toBe(true);
    expect(orchestrator.isRunning).toBe(false);
  });

  it('never has two scene changes in flight at once', () => {
    const orchestrator = createSceneOrchestrator();

    orchestrator.begin(spec({ kind: 'view', from: '2d', to: '3d' }));
    orchestrator.advance(100);
    orchestrator.begin(spec({ kind: 'screen', from: 'qc', to: 'export' }));

    // The second replaced the first; there is exactly one plan, and it is the new one.
    expect(orchestrator.plan?.kind).toBe('screen');
    expect(orchestrator.plan?.to).toBe('export');
    expect(orchestrator.supersededCount).toBe(1);
  });

  it('starts the replacement immediately instead of queueing it behind the first', () => {
    // The constraint that matters: a transition must never make the reader wait.
    const orchestrator = createSceneOrchestrator();

    orchestrator.begin(spec({ kind: 'view' }));
    orchestrator.advance(100);

    const second = orchestrator.begin(spec({ kind: 'floor', from: 'L1', to: 'L2' }));

    expect(orchestrator.elapsedMs).toBe(0);
    expect(orchestrator.sample().phase).toBe('exit');
    expect(second.totalMs).toBe(180);
  });

  it('reports what the replaced change was and how far it had got', () => {
    const orchestrator = createSceneOrchestrator();

    orchestrator.begin(spec({ kind: 'view', from: '2d', to: '3d' }));
    orchestrator.advance(100);
    orchestrator.begin(spec({ kind: 'floor', from: 'L1', to: 'L2' }));

    expect(orchestrator.lastSuperseded).toMatchObject({
      atMs: 100,
      reason: 'superseded',
      plan: { kind: 'view', to: '3d' },
    });
  });

  it('does not count a change that had already finished as superseded', () => {
    const orchestrator = createSceneOrchestrator();

    orchestrator.begin(spec({ kind: 'floor', from: 'L1', to: 'L2' }));
    orchestrator.advance(180);
    orchestrator.begin(spec({ kind: 'floor', from: 'L2', to: 'L3' }));

    expect(orchestrator.supersededCount).toBe(0);
    expect(orchestrator.lastSuperseded).toBeNull();
  });

  it('accepts a new change on every frame without ever refusing one', () => {
    const orchestrator = createSceneOrchestrator();

    // A reader holding the floor-down key. Nothing may throw, nothing may queue.
    for (let index = 0; index < 20; index += 1) {
      expect(() =>
        orchestrator.begin(spec({ kind: 'floor', from: `L${index}`, to: `L${index + 1}` })),
      ).not.toThrow();
      orchestrator.advance(16);
    }

    expect(orchestrator.plan?.to).toBe('L20');
    expect(orchestrator.elapsedMs).toBe(16);
  });

  it('stops where it is when cancelled', () => {
    const orchestrator = createSceneOrchestrator();

    orchestrator.begin(spec({ kind: 'view' }));
    orchestrator.advance(100);
    orchestrator.cancel();

    expect(orchestrator.plan).toBeNull();
    expect(orchestrator.isRunning).toBe(false);
    expect(orchestrator.lastSuperseded).toMatchObject({ reason: 'cancelled', atMs: 100 });
    expect(orchestrator.supersededCount).toBe(0);
  });

  it('ignores a step that is zero, negative or not a number', () => {
    const orchestrator = createSceneOrchestrator();
    orchestrator.begin(spec());

    orchestrator.advance(0);
    orchestrator.advance(-40);
    orchestrator.advance(Number.NaN);

    expect(orchestrator.elapsedMs).toBe(0);
  });

  it('is over on the first frame when the machine is struggling', () => {
    const orchestrator = createSceneOrchestrator();
    orchestrator.begin(spec({ kind: 'view', ...conditionsFor({ frameRate: 11 }) }));

    expect(orchestrator.plan?.totalMs).toBe(MOTION_DURATIONS_MS.instant);
    expect(orchestrator.advance(120).done).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* The stepped delay schedule.                                                 */
/* -------------------------------------------------------------------------- */

describe('stagger', () => {
  it('adds one step per row', () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(1)).toBe(24);
    expect(staggerDelayMs(2)).toBe(48);
    expect(staggerDelayMs(7)).toBe(168);
  });

  it('staggers eight rows and lands the rest together', () => {
    expect(staggerDelaysMs(12)).toEqual([0, 24, 48, 72, 96, 120, 144, 168, 168, 168, 168, 168]);
  });

  it('keeps the whole ramp under the 200ms ceiling for a list of twenty', () => {
    const delays = staggerDelaysMs(20);

    expect(delays).toHaveLength(20);
    expect(Math.max(...delays)).toBe(168);
    expect(Math.max(...delays)).toBeLessThanOrEqual(STAGGER_BUDGET_MS);
  });

  it('keeps the ramp under the ceiling for any list length at all', () => {
    [0, 1, 8, 20, 100, 5_000].forEach((count) => {
      const delays = staggerDelaysMs(count);

      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(STAGGER_BUDGET_MS);
      });
    });
  });

  it('cannot be pushed over the ceiling by editing the two constants', () => {
    // The arithmetic, not a sample: raising either constant fails here first.
    expect((MAX_STAGGERED_ITEMS - 1) * STAGGER_STEP_MS).toBeLessThanOrEqual(STAGGER_BUDGET_MS);
    expect(maxStaggerMs()).toBe((MAX_STAGGERED_ITEMS - 1) * STAGGER_STEP_MS);
  });

  it('delays nothing under reduced motion', () => {
    expect(staggerDelaysMs(20, { reducedMotion: true }).every((delay) => delay === 0)).toBe(true);
    expect(maxStaggerMs({ reducedMotion: true })).toBe(0);
  });

  it('delays nothing on a struggling machine either', () => {
    // Below 30fps a frame is longer than a step, so the order would not be drawn.
    const conditions = conditionsFor({ frameRate: 20 });

    expect(staggerDelaysMs(20, conditions).every((delay) => delay === 0)).toBe(true);
  });

  it('handles a list of nothing, and nonsense counts', () => {
    expect(staggerDelaysMs(0)).toEqual([]);
    expect(staggerDelaysMs(-3)).toEqual([]);
    expect(staggerDelaysMs(Number.NaN)).toEqual([]);
    expect(staggerDelayMs(-1)).toBe(0);
  });

  it('gives every row the same duration and staggers only the start', () => {
    const schedule = staggerSchedule(3, { duration: 'fast' });

    expect(schedule).toEqual([
      { index: 0, delayMs: 0, durationMs: 180, startMs: 0, endMs: 180 },
      { index: 1, delayMs: 24, durationMs: 180, startMs: 24, endMs: 204 },
      { index: 2, delayMs: 48, durationMs: 180, startMs: 48, endMs: 228 },
    ]);
  });

  it('finishes a long list one duration after the ramp stops', () => {
    expect(staggerScheduleEndMs(50, { duration: 'fast' })).toBe(168 + 180);
    expect(staggerScheduleEndMs(0)).toBe(0);
  });

  it('finishes instantly under reduced motion', () => {
    expect(staggerScheduleEndMs(50, { reducedMotion: true })).toBe(0);
  });
});
