import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Vector3,
  type Material,
} from 'three';
import { describe, expect, it } from 'vitest';

import type { PointMm } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';
import type { LevelId, RoomId, WallId } from '@/domain/spatial/types';
import type { Wall } from '@/domain/walls/types';
import type { LayerStates } from '@/lib/selection/selectionOps';

import { mergeByMaterial, type MergeResult } from '../../build/merge';
import { tagPart } from '../../build/scene';
import { buildWallMesh } from '../../build/wall';
import { firstEntityHit, isPickableKind, resolveHit, type RayIntersection } from '../hitTest';
import {
  createPointerPicker,
  createScenePick,
  CLICK_SLOP_PX,
  MAX_RAYCASTS_PER_SECOND,
  MIN_RAYCAST_INTERVAL_MS,
  toNormalizedDevice,
  type PickAt,
  type PickEvent,
  type PickerTimers,
  type PointerPosition,
} from '../raycast';

/* -------------------------------------------------------------------------- */
/* A hand-cranked clock.                                                       */
/* -------------------------------------------------------------------------- */

interface ScheduledTask {
  readonly handle: number;
  readonly atMs: number;
  readonly run: () => void;
}

interface FakeClock {
  readonly now: () => number;
  readonly timers: PickerTimers;
  /** Move time on, running everything that falls due on the way. */
  readonly advance: (byMs: number) => void;
}

function createFakeClock(): FakeClock {
  let nowMs = 0;
  let nextHandle = 1;
  let tasks: ScheduledTask[] = [];

  const timers: PickerTimers = {
    clearTimeout: (handle) => {
      tasks = tasks.filter((task) => task.handle !== handle);
    },
    setTimeout: (run, delayMs) => {
      const handle = nextHandle;

      nextHandle += 1;
      tasks.push({ atMs: nowMs + delayMs, handle, run });

      return handle;
    },
  };

  const advance = (byMs: number): void => {
    const targetMs = nowMs + byMs;

    for (;;) {
      const due = [...tasks]
        .filter((task) => task.atMs <= targetMs)
        .sort((first, second) => first.atMs - second.atMs)[0];

      if (due === undefined) {
        break;
      }

      tasks = tasks.filter((task) => task !== due);
      nowMs = due.atMs;
      due.run();
    }

    nowMs = targetMs;
  };

  return { advance, now: () => nowMs, timers };
}

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ids in the shape `domain/spatial/ids` makes and accepts them: a one-letter
 * prefix and a ten-character body.
 *
 * The length is not decoration. `selectableKindOf` validates the whole id before
 * it will name a layer for it, so a hit test given a hand-shortened `W-02` finds
 * no layer, refuses the pick, and looks exactly like a broken range table.
 */
const LEVEL_ID: LevelId = 'L-00000100AA';
const WALL_ONE = 'W-00000100AA' as WallId;
const WALL_TWO = 'W-00000200AA' as WallId;
const LOOSE_WALL = 'W-00007700AA' as WallId;
const ROOM_ONE = 'R-00000100AA' as RoomId;

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

/** A 4 m wall, 200 mm thick and 3 m tall, `acrossMm` away from the origin. */
function wallAt(id: WallId, acrossMm: number): Wall {
  return {
    baseElevationMm: millimetres(0),
    centreline: { end: pointAt(4_000, acrossMm), start: pointAt(0, acrossMm) },
    id,
    kind: 'partition',
    thicknessMm: millimetres(200),
    topElevationMm: millimetres(3_000),
  };
}

function namedMaterial(name: string): Material {
  const material = new MeshStandardMaterial();

  material.name = name;

  return material;
}

/**
 * Two walls six metres apart, merged into one buffer sharing one material.
 *
 * The point of the fixture: after the merge there is exactly one `Mesh`, so a
 * hit reports "the batch" and only the range table can say which wall it was.
 */
function mergedWalls(): { readonly root: Group; readonly merge: MergeResult } {
  const material = namedMaterial('wall');
  const meshes = [WALL_ONE, WALL_TWO].map((id, index) => {
    const mesh = buildWallMesh(wallAt(id, index * 6_000), { levelId: LEVEL_ID });

    mesh.material = material;

    return mesh;
  });

  const merge = mergeByMaterial(meshes);
  const root = new Group();

  for (const batch of merge.batches) {
    root.add(batch.mesh);
  }

  return { merge, root };
}

/** A camera one hundred metres up, looking straight down at one point. */
function cameraOver(x: number, z: number): OrthographicCamera {
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);

  camera.position.set(x, 100, z);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld(true);

  return camera;
}

const VIEWPORT = { height: 100, width: 100 };

/** The middle of that viewport, which is where the camera is aimed. */
const CENTRE: PointerPosition = { x: 50, y: 50 };

/** One crossing of a ray, written out rather than cast. */
function intersectionOn(object: Mesh, vertexIndex: number, distance = 1): RayIntersection {
  return {
    distance,
    face: { a: vertexIndex },
    object,
    point: new Vector3(0, 0, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Metering.                                                                   */
/* -------------------------------------------------------------------------- */

describe('raycast metering', () => {
  it('shoots no more than thirty rays in any one second, however fast the pointer moves', () => {
    const clock = createFakeClock();
    const castsAtMs: number[] = [];
    const pick: PickAt = () => {
      castsAtMs.push(clock.now());

      return null;
    };
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: () => {},
      pick,
      timers: clock.timers,
    });

    // Three seconds of pointer movement at 200 Hz: six hundred distinct positions.
    for (let step = 0; step < 600; step += 1) {
      picker.pointerMove({ x: step, y: 0 });
      clock.advance(5);
    }

    expect(castsAtMs.length).toBeGreaterThan(0);

    // Every one-second window, not just the average over the three seconds.
    const worstSecond = castsAtMs.reduce((worst, startMs) => {
      const inWindow = castsAtMs.filter(
        (atMs) => atMs >= startMs && atMs < startMs + 1_000,
      ).length;

      return Math.max(worst, inWindow);
    }, 0);

    expect(worstSecond).toBeLessThanOrEqual(MAX_RAYCASTS_PER_SECOND);
  });

  it('shoots nothing when the pointer has not really moved', () => {
    const clock = createFakeClock();
    let casts = 0;
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: () => {},
      pick: () => {
        casts += 1;

        return null;
      },
      timers: clock.timers,
    });

    picker.pointerMove({ x: 40, y: 30 });
    expect(casts).toBe(1);

    // The same coordinates again, long enough later that the meter would allow it.
    for (let repeat = 0; repeat < 20; repeat += 1) {
      clock.advance(100);
      picker.pointerMove({ x: 40, y: 30 });
    }

    expect(casts).toBe(1);
  });

  it('answers the first move of a gesture at once', () => {
    const clock = createFakeClock();
    const events: PickEvent[] = [];
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: () => null,
      timers: clock.timers,
    });

    picker.pointerMove({ x: 10, y: 10 });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('hover');
  });

  it('answers the last move too, once the window reopens', () => {
    const clock = createFakeClock();
    const castsAt: PointerPosition[] = [];
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: () => {},
      pick: (pointer) => {
        castsAt.push(pointer);

        return null;
      },
      timers: clock.timers,
    });

    picker.pointerMove({ x: 1, y: 0 });
    clock.advance(5);
    picker.pointerMove({ x: 2, y: 0 });
    clock.advance(5);
    picker.pointerMove({ x: 3, y: 0 });

    // Still one: the two later moves are inside the window.
    expect(castsAt).toHaveLength(1);

    clock.advance(MIN_RAYCAST_INTERVAL_MS);

    // The newest position was cast; the one it overtook never was.
    expect(castsAt).toHaveLength(2);
    expect(castsAt[1]).toEqual({ x: 3, y: 0 });
  });

  it('drops the deferred cast when the pointer leaves', () => {
    const clock = createFakeClock();
    let casts = 0;
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: () => {},
      pick: () => {
        casts += 1;

        return null;
      },
      timers: clock.timers,
    });

    picker.pointerMove({ x: 1, y: 1 });
    picker.pointerMove({ x: 2, y: 2 });
    picker.pointerLeave({ x: 2, y: 2 });
    clock.advance(1_000);

    expect(casts).toBe(1);
  });

  it('shoots nothing more once disposed', () => {
    const clock = createFakeClock();
    let casts = 0;
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: () => {},
      pick: () => {
        casts += 1;

        return null;
      },
      timers: clock.timers,
    });

    picker.pointerMove({ x: 1, y: 1 });
    picker.pointerMove({ x: 2, y: 2 });
    picker.dispose();
    clock.advance(1_000);

    expect(casts).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Press against drag.                                                         */
/* -------------------------------------------------------------------------- */

describe('press against drag', () => {
  function pickerWithEvents(): {
    readonly events: PickEvent[];
    readonly picker: ReturnType<typeof createPointerPicker>;
    readonly clock: FakeClock;
    readonly casts: () => number;
  } {
    const clock = createFakeClock();
    const events: PickEvent[] = [];
    let casts = 0;

    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: () => {
        casts += 1;

        return null;
      },
      timers: clock.timers,
    });

    return { casts: () => casts, clock, events, picker };
  }

  it('treats a release under four pixels away as a pick', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerDown({ x: 100, y: 100 });
    picker.pointerMove({ x: 102, y: 102 });
    picker.pointerUp({ x: 102, y: 102 });

    const picks = events.filter((event) => event.type === 'pick');

    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({ pointer: { x: 102, y: 102 }, type: 'pick' });
  });

  it('treats a release four pixels away as a drag, so the boundary is exclusive', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerDown({ x: 100, y: 100 });
    picker.pointerMove({ x: 100 + CLICK_SLOP_PX, y: 100 });
    picker.pointerUp({ x: 100 + CLICK_SLOP_PX, y: 100 });

    expect(events.filter((event) => event.type === 'pick')).toHaveLength(0);
  });

  it('keeps a wandering gesture a drag even when it comes home', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerDown({ x: 100, y: 100 });
    picker.pointerMove({ x: 160, y: 140 });
    picker.pointerMove({ x: 100, y: 100 });
    picker.pointerUp({ x: 100, y: 100 });

    expect(events.filter((event) => event.type === 'pick')).toHaveLength(0);
  });

  it('hovers nothing while a drag is in progress', () => {
    const { casts, clock, picker } = pickerWithEvents();

    picker.pointerDown({ x: 100, y: 100 });
    picker.pointerMove({ x: 200, y: 200 });

    const duringDrag = casts();

    for (let step = 0; step < 40; step += 1) {
      clock.advance(50);
      picker.pointerMove({ x: 200 + step, y: 200 });
    }

    expect(casts()).toBe(duringDrag);
  });

  it('carries the additive modifier through without acting on it', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerDown({ x: 10, y: 10 });
    picker.pointerUp({ additive: true, x: 10, y: 10 });

    expect(events.filter((event) => event.type === 'pick')[0]).toMatchObject({
      additive: true,
    });
  });

  it('defaults the modifier to off', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerDown({ x: 10, y: 10 });
    picker.pointerUp({ x: 10, y: 10 });

    expect(events.filter((event) => event.type === 'pick')[0]).toMatchObject({
      additive: false,
    });
  });

  it('decides nothing on a release that had no press behind it', () => {
    const { events, picker } = pickerWithEvents();

    picker.pointerUp({ x: 10, y: 10 });

    expect(events).toHaveLength(0);
  });

  it('never meters a pick away', () => {
    const { events, picker } = pickerWithEvents();

    // A move has just used the window up; the click that follows must still land.
    picker.pointerMove({ x: 10, y: 10 });
    picker.pointerDown({ x: 10, y: 10 });
    picker.pointerUp({ x: 10, y: 10 });

    expect(events.filter((event) => event.type === 'pick')).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The reverse lookup.                                                         */
/* -------------------------------------------------------------------------- */

describe('reverse lookup through the range table', () => {
  it('names the wall a click landed on, in a scene merged to one mesh', () => {
    const { merge, root } = mergedWalls();

    expect(merge.batches).toHaveLength(1);

    const events: PickEvent[] = [];
    const clock = createFakeClock();
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      // The second wall's centre: 2 m along, 6 m across.
      pick: createScenePick({
        camera: cameraOver(2, 6),
        root,
        viewport: () => VIEWPORT,
        merge: () => merge,
      }),
      timers: clock.timers,
    });

    picker.pointerDown(CENTRE);
    picker.pointerUp(CENTRE);

    const pick = events.find((event) => event.type === 'pick');

    expect(pick?.hit?.entityId).toBe(WALL_TWO);
    expect(pick?.hit?.kind).toBe('wall');
    expect(pick?.hit?.levelId).toBe(LEVEL_ID);
  });

  it('names the other wall from the other end of the same buffer', () => {
    const { merge, root } = mergedWalls();
    const pick = createScenePick({
      camera: cameraOver(2, 0),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
    });

    expect(pick(CENTRE)?.entityId).toBe(WALL_ONE);
  });

  it('reports where the ray met the wall, for a label anchored in the scene', () => {
    const { merge, root } = mergedWalls();
    const hit = createScenePick({
      camera: cameraOver(2, 6),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
    })(CENTRE);

    expect(hit).not.toBeNull();
    // The top of a 3 m wall, at the point the camera was aimed through.
    expect(hit?.point.y).toBeCloseTo(3, 5);
    expect(hit?.point.x).toBeCloseTo(2, 5);
    // Looking straight down is the one direction `lookAt` has to nudge to keep
    // its up vector usable, so the ray leans a hair over the hundred metres it
    // travels. What is being claimed is that the point is on the second wall,
    // which is 200 mm thick — not that the camera is perfectly plumb.
    expect(hit?.point.z).toBeGreaterThan(5.9);
    expect(hit?.point.z).toBeLessThan(6.1);
  });

  it('finds nothing where there is nothing', () => {
    const { merge, root } = mergedWalls();
    const pick = createScenePick({
      camera: cameraOver(2, 30),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
    });

    expect(pick(CENTRE)).toBeNull();
  });

  it('reads a loose mesh off its own tag, with no range table at all', () => {
    const mesh = tagPart(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), {
      entityId: LOOSE_WALL,
      kind: 'wall',
      levelId: LEVEL_ID,
    });

    expect(resolveHit(intersectionOn(mesh, 0))?.entityId).toBe(LOOSE_WALL);
  });

  it('walks past a batch hit on no face the table knows', () => {
    const { merge, root } = mergedWalls();
    const batch = merge.batches[0];
    const beyondTheBuffer = 1_000_000;

    expect(batch).toBeDefined();
    expect(root.children).toHaveLength(1);

    expect(
      firstEntityHit([intersectionOn(batch?.mesh as Mesh, beyondTheBuffer)], { merge }),
    ).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Hidden and locked layers.                                                   */
/* -------------------------------------------------------------------------- */

describe('hidden and locked layers', () => {
  const HIDDEN_WALLS: LayerStates = { wall: { locked: false, visible: false } };
  const LOCKED_WALLS: LayerStates = { wall: { locked: true, visible: true } };

  it('steps over an object whose layer is hidden', () => {
    const { merge, root } = mergedWalls();
    const pick = createScenePick({
      camera: cameraOver(2, 6),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
      layers: () => HIDDEN_WALLS,
    });

    expect(pick(CENTRE)).toBeNull();
  });

  it('steps over an object whose layer is locked', () => {
    const { merge, root } = mergedWalls();
    const pick = createScenePick({
      camera: cameraOver(2, 6),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
      layers: () => LOCKED_WALLS,
    });

    expect(pick(CENTRE)).toBeNull();
  });

  it('keeps looking behind a locked object rather than stopping at it', () => {
    const locked = tagPart(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), {
      entityId: WALL_ONE,
      kind: 'wall',
      levelId: LEVEL_ID,
    });
    const behind = tagPart(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), {
      entityId: ROOM_ONE,
      kind: 'floorSlab',
      levelId: LEVEL_ID,
    });

    const found = firstEntityHit(
      [intersectionOn(locked, 0, 1), intersectionOn(behind, 0, 2)],
      { layers: LOCKED_WALLS },
    );

    expect(found?.entityId).toBe(ROOM_ONE);
  });

  it('reads the layer state fresh on every cast', () => {
    const { merge, root } = mergedWalls();
    let layers: LayerStates = {};
    const pick = createScenePick({
      camera: cameraOver(2, 6),
      root,
      viewport: () => VIEWPORT,
      merge: () => merge,
      layers: () => layers,
    });

    expect(pick(CENTRE)?.entityId).toBe(WALL_TWO);

    layers = HIDDEN_WALLS;

    expect(pick(CENTRE)).toBeNull();
  });

  it('takes an unlisted layer to be drawn and unlocked', () => {
    expect(isPickableKind('wall', {})).toBe(true);
    expect(isPickableKind('room', { wall: { locked: true, visible: true } })).toBe(true);
  });

  it('refuses a kind that cannot be picked at all', () => {
    expect(isPickableKind(null, {})).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The floating label.                                                         */
/* -------------------------------------------------------------------------- */

describe('hover events', () => {
  it('carries the entity id and the touch point', () => {
    const { merge, root } = mergedWalls();
    const events: PickEvent[] = [];
    const clock = createFakeClock();
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: createScenePick({
        camera: cameraOver(2, 6),
        root,
        viewport: () => VIEWPORT,
        merge: () => merge,
      }),
      timers: clock.timers,
    });

    picker.pointerMove(CENTRE);

    const hover = events.find((event) => event.type === 'hover');

    expect(hover?.hit?.entityId).toBe(WALL_TWO);
    expect(hover?.hit?.point.y).toBeCloseTo(3, 5);
    expect(hover?.pointer).toEqual(CENTRE);
  });

  it('says "nothing" once and then stays quiet', () => {
    const clock = createFakeClock();
    const events: PickEvent[] = [];
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: () => null,
      timers: clock.timers,
    });

    for (let step = 0; step < 10; step += 1) {
      picker.pointerMove({ x: step, y: 0 });
      clock.advance(100);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ hit: null, type: 'hover' });
  });

  it('clears the label when the pointer leaves', () => {
    const { merge, root } = mergedWalls();
    const clock = createFakeClock();
    const events: PickEvent[] = [];
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: createScenePick({
        camera: cameraOver(2, 6),
        root,
        viewport: () => VIEWPORT,
        merge: () => merge,
      }),
      timers: clock.timers,
    });

    picker.pointerMove(CENTRE);
    picker.pointerLeave({ x: 0, y: 0 });

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ hit: null, type: 'hover' });
  });

  it('does not repeat the clearing when the pointer leaves an empty scene', () => {
    const clock = createFakeClock();
    const events: PickEvent[] = [];
    const picker = createPointerPicker({
      now: clock.now,
      onEvent: (event) => events.push(event),
      pick: () => null,
      timers: clock.timers,
    });

    picker.pointerMove({ x: 1, y: 1 });
    picker.pointerLeave({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Canvas pixels to clip space.                                                */
/* -------------------------------------------------------------------------- */

describe('normalised device coordinates', () => {
  it('puts the middle of the canvas at the origin', () => {
    const device = toNormalizedDevice({ x: 400, y: 300 }, { height: 600, width: 800 });

    expect(device.x).toBeCloseTo(0, 10);
    expect(device.y).toBeCloseTo(0, 10);
  });

  it('flips the vertical axis, because a canvas counts down and clip space counts up', () => {
    const topLeft = toNormalizedDevice({ x: 0, y: 0 }, { height: 600, width: 800 });

    expect(topLeft.x).toBeCloseTo(-1, 10);
    expect(topLeft.y).toBeCloseTo(1, 10);
  });

  it('finds nothing in a canvas of no size', () => {
    const { merge, root } = mergedWalls();
    const pick = createScenePick({
      camera: cameraOver(2, 6),
      root,
      viewport: () => ({ height: 0, width: 0 }),
      merge: () => merge,
    });

    expect(pick(CENTRE)).toBeNull();
  });
});
