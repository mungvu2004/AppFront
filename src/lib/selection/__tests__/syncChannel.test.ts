/**
 * The one-way pipe from the store to the 2D canvas, the 3D scene and the side
 * list, checked on a hand-cranked frame.
 *
 * Four properties carry this file:
 *
 * - **One publish per frame.** Ten changes inside one frame are one event
 *   carrying the last of them; the frame is turned by the test, not by the
 *   browser, so nothing here waits on a real clock.
 * - **The loop cannot form.** The only inbound call a consumer can make is
 *   `reportVisible`, and it is asserted to publish nothing. A listener that
 *   pushes back is asserted to land on the *next* frame rather than re-enter
 *   the publish it is inside.
 * - **The channel keeps no selection.** After a publish, another frame carries
 *   nothing, and the returned handle is asserted to expose no way of reading a
 *   selection back out — the store stays the only place one lives.
 * - **Six hundred objects are a tally, not a list.** Past the threshold the
 *   detail flips to counts by kind, and nobody is asked to scroll.
 */

import { describe, expect, it } from 'vitest';

import {
  sampleDoorId,
  sampleRoomId,
  sampleWallId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { EntityId } from '@/domain/spatial/types';
import {
  countByKind,
  describeSelection,
  planReveals,
  revealAnchor,
  SUMMARY_THRESHOLD,
  SYNC_TARGETS,
} from '../revealPolicy';
import type { Selection } from '../selectionOps';
import {
  createSelectionChannel,
  type FrameHandle,
  type FrameScheduler,
  type SelectionEvent,
  type SelectionListener,
} from '../syncChannel';

/* -------------------------------------------------------------------------- */
/* Fixture.                                                                    */
/* -------------------------------------------------------------------------- */

/** A frame the test turns by hand, standing in for `requestAnimationFrame`. */
interface ManualScheduler extends FrameScheduler {
  /** How many frames are waiting to run. */
  pendingFrames: () => number;
  /** Runs everything queued, as the browser would at the end of a frame. */
  runFrame: () => void;
}

const createManualScheduler = (): ManualScheduler => {
  const queued = new Map<FrameHandle, () => void>();
  let nextHandle = 0;

  return {
    cancel: (handle) => {
      queued.delete(handle);
    },
    pendingFrames: () => queued.size,
    runFrame: () => {
      const runs = [...queued.values()];

      // Cleared before running, so work scheduled from inside a frame lands in
      // the next one exactly as it would in a browser.
      queued.clear();

      for (const run of runs) {
        run();
      }
    },
    schedule: (run) => {
      const handle = nextHandle;

      nextHandle += 1;
      queued.set(handle, run);

      return handle;
    },
  };
};

const createRecorder = (): { events: SelectionEvent[]; listener: SelectionListener } => {
  const events: SelectionEvent[] = [];

  return {
    events,
    listener: (event) => {
      events.push(event);
    },
  };
};

const WALL_ONE = sampleWallId(0);
const WALL_TWO = sampleWallId(1);
const ROOM_ONE = sampleRoomId(0);

/*
 * The stress selection: 600 objects, past `SUMMARY_THRESHOLD`.
 *
 * These are id-shaped labels, not the sample building — the standard dataset
 * holds 48 walls, and the channel never looks an id up in a drawing. Six
 * hundred is the figure the summary rule exists for.
 */
const STRESS_WALL_COUNT = 400;
const STRESS_ROOM_COUNT = 150;
const STRESS_DOOR_COUNT = 50;
const STRESS_COUNT = STRESS_WALL_COUNT + STRESS_ROOM_COUNT + STRESS_DOOR_COUNT;

const STRESS_SELECTION: Selection = [
  ...Array.from({ length: STRESS_WALL_COUNT }, (_unused, index) => sampleWallId(index)),
  ...Array.from({ length: STRESS_ROOM_COUNT }, (_unused, index) => sampleRoomId(index)),
  ...Array.from({ length: STRESS_DOOR_COUNT }, (_unused, index) => sampleDoorId(index)),
];

const walls = (count: number): Selection =>
  Array.from({ length: count }, (_unused, index) => sampleWallId(index));

/* -------------------------------------------------------------------------- */
/* Coalescing.                                                                 */
/* -------------------------------------------------------------------------- */

describe('coalescing', () => {
  it('folds every change made inside one frame into a single publish', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);

    for (let change = 0; change < 10; change += 1) {
      channel.push([sampleWallId(change)]);
    }

    // Ten changes, one frame waiting, nothing published yet.
    expect(scheduler.pendingFrames()).toBe(1);
    expect(events).toHaveLength(0);

    scheduler.runFrame();

    expect(events).toHaveLength(1);
    expect(events[0]?.coalesced).toBe(10);
    expect(events[0]?.selection).toEqual([sampleWallId(9)]);
  });

  it('opens a fresh frame for the next burst', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE]);
    scheduler.runFrame();
    channel.push([WALL_TWO]);

    expect(scheduler.pendingFrames()).toBe(1);

    scheduler.runFrame();

    expect(events).toHaveLength(2);
    expect(events[1]?.coalesced).toBe(1);
  });

  it('publishes nothing when nothing was pushed', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    scheduler.runFrame();
    channel.flush();

    expect(events).toHaveLength(0);
  });

  it('publishes on demand and leaves no frame behind', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE]);
    channel.flush();

    expect(events).toHaveLength(1);
    expect(scheduler.pendingFrames()).toBe(0);

    // The frame that was already booked must not publish the same change twice.
    scheduler.runFrame();

    expect(events).toHaveLength(1);
  });

  it('hands the store array on without copying it', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();
    const pushed: Selection = [WALL_ONE, ROOM_ONE];

    channel.subscribe('canvas2d', listener);
    channel.push(pushed);
    scheduler.runFrame();

    expect(events[0]?.selection).toBe(pushed);
  });

  it('publishes on the browser frame when no scheduler is injected', async () => {
    const channel = createSelectionChannel();
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE]);
    channel.push([WALL_TWO]);

    expect(events).toHaveLength(0);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.coalesced).toBe(2);

    channel.dispose();
  });
});

/* -------------------------------------------------------------------------- */
/* Summary mode.                                                               */
/* -------------------------------------------------------------------------- */

describe('summary mode', () => {
  it('turns 600 selected objects into counts by kind', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('list', listener);
    channel.push(STRESS_SELECTION);
    scheduler.runFrame();

    const detail = events[0]?.detail;

    expect(STRESS_COUNT).toBe(600);
    expect(detail?.mode).toBe('summary');
    expect(detail?.mode === 'summary' ? detail.countsByKind : null).toEqual({
      axis: 0,
      dimension: 0,
      furniture: 0,
      opening: STRESS_DOOR_COUNT,
      room: STRESS_ROOM_COUNT,
      wall: STRESS_WALL_COUNT,
    });
  });

  it('still carries the ids, because the canvas has to highlight them', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push(STRESS_SELECTION);
    scheduler.runFrame();

    expect(events[0]?.selection).toHaveLength(STRESS_COUNT);
  });

  it('summarises above the threshold and not at it', () => {
    expect(describeSelection(walls(SUMMARY_THRESHOLD)).mode).toBe('full');
    expect(describeSelection(walls(SUMMARY_THRESHOLD + 1)).mode).toBe('summary');
  });

  it('tallies a small selection by kind too', () => {
    expect(countByKind([WALL_ONE, WALL_TWO, ROOM_ONE])).toEqual({
      axis: 0,
      dimension: 0,
      furniture: 0,
      opening: 0,
      room: 1,
      wall: 2,
    });
  });

  it('asks nobody to move once the selection is summarised', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const recorders = SYNC_TARGETS.map((target) => {
      const recorder = createRecorder();

      channel.subscribe(target, recorder.listener);

      return recorder;
    });

    channel.push(STRESS_SELECTION);
    scheduler.runFrame();

    for (const recorder of recorders) {
      expect(recorder.events[0]?.reveal).toBeNull();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Reveal.                                                                     */
/* -------------------------------------------------------------------------- */

describe('reveal', () => {
  it('asks only the places that cannot see the newest pick', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const canvas = createRecorder();
    const scene = createRecorder();
    const list = createRecorder();

    channel.subscribe('canvas2d', canvas.listener);
    channel.subscribe('scene3d', scene.listener);
    channel.subscribe('list', list.listener);

    // The pick was made in the 2D canvas, so that canvas already shows it.
    channel.reportVisible('canvas2d', [WALL_ONE, WALL_TWO]);
    channel.push([WALL_ONE]);
    scheduler.runFrame();

    expect(canvas.events[0]?.reveal).toBeNull();
    expect(scene.events[0]?.reveal).toEqual({ id: WALL_ONE, target: 'scene3d' });
    expect(list.events[0]?.reveal).toEqual({ id: WALL_ONE, target: 'list' });
  });

  it('asks nobody when every place already shows it', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const recorders = SYNC_TARGETS.map((target) => {
      const recorder = createRecorder();

      channel.subscribe(target, recorder.listener);
      channel.reportVisible(target, [WALL_ONE]);

      return recorder;
    });

    channel.push([WALL_ONE]);
    scheduler.runFrame();

    for (const recorder of recorders) {
      expect(recorder.events[0]?.reveal).toBeNull();
    }
  });

  it('treats a place that has reported nothing as showing nothing', () => {
    expect(planReveals([WALL_ONE], { mode: 'full' }, {})).toEqual([
      { id: WALL_ONE, target: 'canvas2d' },
      { id: WALL_ONE, target: 'scene3d' },
      { id: WALL_ONE, target: 'list' },
    ]);
  });

  it('aims at the newest pick', () => {
    expect(revealAnchor([WALL_ONE, ROOM_ONE, WALL_TWO])).toBe(WALL_TWO);
    expect(revealAnchor([])).toBeNull();
    expect(planReveals([WALL_ONE, WALL_TWO], { mode: 'full' }, { list: [WALL_ONE] })).toContainEqual(
      { id: WALL_TWO, target: 'list' },
    );
  });

  it('asks nobody when the selection is empty', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('list', listener);
    channel.push([]);
    scheduler.runFrame();

    expect(events).toHaveLength(1);
    expect(events[0]?.reveal).toBeNull();
    expect(events[0]?.detail.mode).toBe('full');
  });
});

/* -------------------------------------------------------------------------- */
/* One way only.                                                               */
/* -------------------------------------------------------------------------- */

describe('one way only', () => {
  it('publishes nothing when a place reports what it can see', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);

    for (const target of SYNC_TARGETS) {
      channel.reportVisible(target, [WALL_ONE]);
    }

    expect(scheduler.pendingFrames()).toBe(0);

    scheduler.runFrame();

    expect(events).toHaveLength(0);
  });

  it('cannot be re-entered by a listener that pushes back', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const events: SelectionEvent[] = [];
    let pushedBack = false;

    channel.subscribe('canvas2d', (event) => {
      events.push(event);

      if (!pushedBack) {
        pushedBack = true;
        channel.push([WALL_TWO]);
      }
    });

    channel.push([WALL_ONE]);
    scheduler.runFrame();

    // The push made mid-publish booked the next frame instead of recursing.
    expect(events).toHaveLength(1);
    expect(scheduler.pendingFrames()).toBe(1);

    scheduler.runFrame();

    expect(events).toHaveLength(2);
    expect(events[1]?.selection).toEqual([WALL_TWO]);
  });

  it('keeps no selection between frames', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE]);
    scheduler.runFrame();
    scheduler.runFrame();
    channel.flush();

    expect(events).toHaveLength(1);
  });

  it('offers no way to read a selection back out of the channel', () => {
    const channel = createSelectionChannel({ scheduler: createManualScheduler() });

    expect(Object.keys(channel).sort()).toEqual([
      'dispose',
      'flush',
      'push',
      'reportVisible',
      'subscribe',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Subscription.                                                               */
/* -------------------------------------------------------------------------- */

describe('subscription', () => {
  it('delivers one event to each place, naming that place', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const recorders = SYNC_TARGETS.map((target) => {
      const recorder = createRecorder();

      channel.subscribe(target, recorder.listener);

      return { recorder, target };
    });

    channel.push([WALL_ONE]);
    scheduler.runFrame();

    for (const { recorder, target } of recorders) {
      expect(recorder.events).toHaveLength(1);
      expect(recorder.events[0]?.target).toBe(target);
    }
  });

  it('stops delivering once unsubscribed', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();
    const unsubscribe = channel.subscribe('canvas2d', listener);

    channel.push([WALL_ONE]);
    scheduler.runFrame();
    unsubscribe();
    channel.push([WALL_TWO]);
    scheduler.runFrame();

    expect(events).toHaveLength(1);
  });

  it('survives a listener unsubscribing another mid-publish', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const first = createRecorder();
    const second = createRecorder();

    const stopSecond = channel.subscribe('canvas2d', second.listener);

    channel.subscribe('canvas2d', (event) => {
      first.listener(event);
      stopSecond();
    });

    channel.push([WALL_ONE]);
    scheduler.runFrame();
    channel.push([WALL_TWO]);
    scheduler.runFrame();

    expect(first.events).toHaveLength(2);
    expect(second.events).toHaveLength(1);
  });

  it('drops listeners and any pending frame when disposed', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE]);
    channel.dispose();

    expect(scheduler.pendingFrames()).toBe(0);

    scheduler.runFrame();

    expect(events).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Types the events carry.                                                     */
/* -------------------------------------------------------------------------- */

describe('event shape', () => {
  it('carries ids, never entities', () => {
    const scheduler = createManualScheduler();
    const channel = createSelectionChannel({ scheduler });
    const { events, listener } = createRecorder();

    channel.subscribe('canvas2d', listener);
    channel.push([WALL_ONE, ROOM_ONE]);
    scheduler.runFrame();

    const selection: readonly EntityId[] = events[0]?.selection ?? [];

    expect(selection.every((id) => typeof id === 'string')).toBe(true);
  });
});
