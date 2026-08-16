import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Furniture,
  Level,
  Room,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';
import { degrees, millimetres } from '@/domain/units/types';
import {
  createMoveFurnitureCommand,
  createRotateFurnitureCommand,
  validateMoveFurniture,
  validateRotateFurniture,
} from '@/lib/commands/business/openingCommands';
import type { CommandContext } from '@/lib/commands/business/shared';
import {
  createChangeWallThicknessCommand,
  validateChangeWallThickness,
} from '@/lib/commands/business/wallCommands';

import {
  angleAroundAxis,
  axisDirection,
  closestPointOnAxis,
  describeDelta,
  GIZMO_ANGLE_STEP_DEG,
  GIZMO_AXES,
  GIZMO_GRID_STEP_MM,
  GIZMO_HANDLES,
  GIZMO_MODES,
  gizmoStatus,
  intersectAxisPlane,
  isZeroDelta,
  measureDrag,
  type GizmoAnchor,
  type GizmoDelta,
  type GizmoHandle,
  type PickRay,
} from '../gizmo';
import {
  createDragSession,
  type CommandBinding,
  type DragPreview,
} from '../dragSession';

/* -------------------------------------------------------------------------- */
/* Fixture — one room with a table in it, and a wall to resize.                */
/* -------------------------------------------------------------------------- */

const LEVEL_ID = 'L-LVL001AAAA' as const;
const WALL_ID = 'W-SOUTH01AAA' as const;
const ROOM_ID = 'R-LIVE01AAAA' as const;
const TABLE_ID = 'F-TABL01AAAA' as const;

const APPROVED = { confidence: 1, reviewed: true, source: 'human' } as const;

const WALL_THICKNESS_MM = 220;

/** The room the table has to stay inside: 4 m by 4 m from the origin. */
const ROOM_SIDE_MM = 4_000;

/** Where the table starts: the middle of the room. */
const TABLE_CENTRE_MM = { x: 1_000, y: 1_000 };

const LEVELS: readonly Level[] = [
  { ...APPROVED, elevationMm: 0, heightMm: 3_600, id: LEVEL_ID, name: 'Tầng 1', order: 0 },
];

const WALLS: readonly Wall[] = [
  {
    ...APPROVED,
    centreline: { end: { x: ROOM_SIDE_MM, y: 0 }, start: { x: 0, y: 0 } },
    heightMm: 3_400,
    id: WALL_ID,
    kind: 'loadBearing',
    levelId: LEVEL_ID,
    openingIds: [],
    thicknessMm: WALL_THICKNESS_MM,
  },
];

const ROOMS: readonly Room[] = [
  {
    ...APPROVED,
    areaM2: 16,
    id: ROOM_ID,
    levelId: LEVEL_ID,
    name: 'phòng khách',
    outline: [
      { x: 0, y: 0 },
      { x: ROOM_SIDE_MM, y: 0 },
      { x: ROOM_SIDE_MM, y: ROOM_SIDE_MM },
      { x: 0, y: ROOM_SIDE_MM },
    ],
    usage: 'livingRoom',
    wallIds: [WALL_ID],
  },
];

const TABLE: Furniture = {
  ...APPROVED,
  boundingBox: {
    max: { x: TABLE_CENTRE_MM.x + 400, y: TABLE_CENTRE_MM.y + 400 },
    min: { x: TABLE_CENTRE_MM.x - 400, y: TABLE_CENTRE_MM.y - 400 },
  },
  centre: { ...TABLE_CENTRE_MM },
  id: TABLE_ID,
  kind: 'table',
  levelId: LEVEL_ID,
  roomId: ROOM_ID,
  rotationDeg: 0,
};

const GRAPH: SpatialGraph = {
  axes: [],
  building: {
    ...APPROVED,
    datumElevationMm: 0,
    grossFloorAreaM2: 248.6,
    name: 'Nhà mẫu',
  },
  dimensions: [],
  furniture: [TABLE],
  levels: [...LEVELS],
  notes: [],
  openings: [],
  rooms: [...ROOMS],
  walls: [...WALLS],
};

const SPATIAL: NormalizedSpatial = normalizeSpatial(GRAPH);

const CONTEXT: CommandContext = {
  actorId: 'U-TEST',
  graph: SPATIAL,
  id: 'C-TEST0000001',
  timestamp: '2026-08-16T09:00:00+07:00',
};

/* -------------------------------------------------------------------------- */
/* Rays, written by hand.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A ray dropped straight down onto one point of the ground plane.
 *
 * Its closest point on a horizontal axis is that point's own coordinate, and it
 * meets the horizontal plane exactly under itself, so every reading in this file
 * can be worked out on paper before it is asserted.
 */
function rayDownAt(sceneX: number, sceneZ: number, height = 10): PickRay {
  return {
    direction: new Vector3(0, -1, 0),
    origin: new Vector3(sceneX, height, sceneZ),
  };
}

/** The handle sits at the scene origin unless a test says otherwise. */
const ORIGIN_ANCHOR: GizmoAnchor = { position: new Vector3(0, 0, 0) };

/** Millimetres to scene units, for writing a ray at a model coordinate. */
function sceneAt(valueMm: number): number {
  return valueMm / 1_000;
}

/* -------------------------------------------------------------------------- */
/* The axes themselves.                                                        */
/* -------------------------------------------------------------------------- */

describe('gizmo axes', () => {
  it('offers nine handles: three modes locked to three axes', () => {
    expect(GIZMO_MODES).toEqual(['translate', 'rotate', 'scale']);
    expect(GIZMO_AXES).toEqual(['x', 'y', 'z']);
    expect(GIZMO_HANDLES).toHaveLength(9);
    expect(new Set(GIZMO_HANDLES.map((handle) => `${handle.mode}.${handle.axis}`)).size).toBe(9);
  });

  it('points each axis along its own unit vector', () => {
    expect(axisDirection('x').toArray()).toEqual([1, 0, 0]);
    expect(axisDirection('y').toArray()).toEqual([0, 1, 0]);
    expect(axisDirection('z').toArray()).toEqual([0, 0, 1]);
  });

  it('reads a straight-down ray as its own coordinate on a floor axis', () => {
    expect(closestPointOnAxis(rayDownAt(2.5, 0), ORIGIN_ANCHOR.position, 'x')).toBeCloseTo(2.5, 9);
    expect(closestPointOnAxis(rayDownAt(0, -1.25), ORIGIN_ANCHOR.position, 'z')).toBeCloseTo(
      -1.25,
      9,
    );
  });

  it('refuses to read an axis the pointer is looking straight down', () => {
    const alongY: PickRay = {
      direction: new Vector3(0, -1, 0),
      origin: new Vector3(0, 10, 0),
    };

    expect(closestPointOnAxis(alongY, ORIGIN_ANCHOR.position, 'y')).toBeNull();
  });

  it('meets the plane a rotate handle turns in, and refuses one behind the camera', () => {
    const met = intersectAxisPlane(rayDownAt(1, 1), ORIGIN_ANCHOR.position, 'y');

    expect(met?.x).toBeCloseTo(1, 9);
    expect(met?.y).toBeCloseTo(0, 9);
    expect(met?.z).toBeCloseTo(1, 9);

    // Aimed up and away: the plane is behind the ray, not in front of it.
    const upward: PickRay = {
      direction: new Vector3(0, 1, 0),
      origin: new Vector3(0, 10, 0),
    };

    expect(intersectAxisPlane(upward, ORIGIN_ANCHOR.position, 'y')).toBeNull();
  });

  it('refuses a plane the ray runs along', () => {
    const sideways: PickRay = {
      direction: new Vector3(1, 0, 0),
      origin: new Vector3(-5, 0, 0),
    };

    expect(intersectAxisPlane(sideways, ORIGIN_ANCHOR.position, 'y')).toBeNull();
  });

  it('reads the vertical axis in plan degrees, counter-clockwise from plan x', () => {
    // plan +x is 0°, plan +y — which is scene +z — is a quarter turn on.
    expect(angleAroundAxis(new Vector3(1, 0, 0), 'y')).toBeCloseTo(0, 9);
    expect(angleAroundAxis(new Vector3(0, 0, 1), 'y')).toBeCloseTo(90, 9);
    expect(angleAroundAxis(new Vector3(-1, 0, 0), 'y')).toBeCloseTo(180, 9);
    expect(angleAroundAxis(new Vector3(0, 0, -1), 'y')).toBeCloseTo(-90, 9);
  });
});

/* -------------------------------------------------------------------------- */
/* Measuring, and the 50 mm grid.                                              */
/* -------------------------------------------------------------------------- */

describe('measuring a drag', () => {
  const translateX: GizmoHandle = { axis: 'x', mode: 'translate' };

  it('takes its grid from the shared snap table, at 50 mm', () => {
    expect(GIZMO_GRID_STEP_MM).toBe(50);
    expect(GIZMO_ANGLE_STEP_DEG).toBe(15);
  });

  it('snaps a translation onto the 50 mm grid', () => {
    const delta = measureDrag(
      translateX,
      ORIGIN_ANCHOR,
      rayDownAt(0, 0),
      rayDownAt(sceneAt(237), 0),
    );

    expect(delta).toEqual({ axis: 'x', mode: 'translate', offsetMm: 250 });
  });

  it('snaps a small drag back to nothing rather than inventing a millimetre', () => {
    const delta = measureDrag(
      translateX,
      ORIGIN_ANCHOR,
      rayDownAt(0, 0),
      rayDownAt(sceneAt(12), 0),
    );

    expect(delta).toEqual({ axis: 'x', mode: 'translate', offsetMm: 0 });
    expect(delta === null ? false : isZeroDelta(delta)).toBe(true);
  });

  it('keeps the sign of a translation, both ways', () => {
    const back = measureDrag(
      translateX,
      ORIGIN_ANCHOR,
      rayDownAt(0, 0),
      rayDownAt(sceneAt(-300), 0),
    );

    expect(back).toMatchObject({ offsetMm: -300 });
  });

  it('measures a turn about the vertical axis and snaps it to 15°', () => {
    const delta = measureDrag(
      { axis: 'y', mode: 'rotate' },
      ORIGIN_ANCHOR,
      rayDownAt(1, 0),
      rayDownAt(0, 1),
    );

    expect(delta).toEqual({ angleDeg: 90, axis: 'y', mode: 'rotate' });
  });

  it('keeps a turn signed rather than folding it into a full circle', () => {
    const delta = measureDrag(
      { axis: 'y', mode: 'rotate' },
      ORIGIN_ANCHOR,
      rayDownAt(1, 0),
      rayDownAt(0, -1),
    );

    // A quarter turn clockwise on the plan is −90°, not 270°.
    expect(delta).toEqual({ angleDeg: -90, axis: 'y', mode: 'rotate' });
  });

  it('snaps the resulting dimension of a resize, not the distance the hand moved', () => {
    const anchor: GizmoAnchor = {
      position: new Vector3(0, 0, 0),
      sizeMm: { x: millimetres(WALL_THICKNESS_MM) },
    };
    const delta = measureDrag(
      { axis: 'x', mode: 'scale' },
      anchor,
      rayDownAt(0, 0),
      rayDownAt(sceneAt(63), 0),
    );

    // 220 + 63 = 283, and the dimension that lands on the grid is 300.
    expect(delta).toMatchObject({ lengthMm: 300, mode: 'scale' });
    expect(delta?.mode === 'scale' ? delta.factor : 0).toBeCloseTo(300 / WALL_THICKNESS_MM, 9);
  });

  it('floors a resize at one grid step instead of turning it inside out', () => {
    const anchor: GizmoAnchor = {
      position: new Vector3(0, 0, 0),
      sizeMm: { x: millimetres(WALL_THICKNESS_MM) },
    };
    const delta = measureDrag(
      { axis: 'x', mode: 'scale' },
      anchor,
      rayDownAt(0, 0),
      rayDownAt(sceneAt(-5_000), 0),
    );

    expect(delta).toMatchObject({ lengthMm: GIZMO_GRID_STEP_MM });
  });

  it('has no reading for a resize with no dimension to resize', () => {
    expect(
      measureDrag(
        { axis: 'x', mode: 'scale' },
        ORIGIN_ANCHOR,
        rayDownAt(0, 0),
        rayDownAt(1, 0),
      ),
    ).toBeNull();
  });

  it('has no reading at all when the pointer looks down the axis', () => {
    expect(
      measureDrag(
        { axis: 'y', mode: 'translate' },
        ORIGIN_ANCHOR,
        rayDownAt(0, 0),
        rayDownAt(0, 1),
      ),
    ).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The provisional readout.                                                    */
/* -------------------------------------------------------------------------- */

describe('the provisional reading', () => {
  it('writes a translation with its sign, its unit and a decimal comma', () => {
    expect(describeDelta({ axis: 'x', mode: 'translate', offsetMm: millimetres(250) })).toBe(
      'trục X: +250 mm',
    );
    expect(describeDelta({ axis: 'z', mode: 'translate', offsetMm: millimetres(-1_250) })).toBe(
      'trục Z: -1.250 mm',
    );
  });

  it('writes a turn in degrees', () => {
    expect(describeDelta({ angleDeg: degrees(15), axis: 'y', mode: 'rotate' })).toBe(
      'trục Y: +15,0°',
    );
  });

  it('writes a resize as the dimension it would end at', () => {
    expect(
      describeDelta({ axis: 'x', factor: 2, lengthMm: millimetres(1_250), mode: 'scale' }),
    ).toBe('trục X: 1,25 m');
  });

  it('names a state code for the outline and never a colour', () => {
    expect(gizmoStatus('blocked')).toBe('violation');
    expect(gizmoStatus('dragging')).toBe('neutral');
    expect(gizmoStatus('hover')).toBe('neutral');
    expect(gizmoStatus('idle')).toBe('neutral');
  });
});

/* -------------------------------------------------------------------------- */
/* Bindings onto the real business commands.                                   */
/* -------------------------------------------------------------------------- */

/** Dragging the table across the floor: plan x for scene x, plan y for scene z. */
function moveTableBinding(): CommandBinding<{
  readonly furnitureId: typeof TABLE_ID;
  readonly to: { readonly x: number; readonly y: number };
}> {
  return {
    build: createMoveFurnitureCommand,
    context: CONTEXT,
    toInput: (delta) => {
      if (delta.mode !== 'translate') {
        return null;
      }

      return {
        furnitureId: TABLE_ID,
        to: {
          x: TABLE.centre.x + (delta.axis === 'x' ? delta.offsetMm : 0),
          y: TABLE.centre.y + (delta.axis === 'z' ? delta.offsetMm : 0),
        },
      };
    },
    validate: validateMoveFurniture,
  };
}

/** Turning the table about the vertical axis. */
function rotateTableBinding(): CommandBinding<{
  readonly furnitureId: typeof TABLE_ID;
  readonly rotationDeg: number;
}> {
  return {
    build: createRotateFurnitureCommand,
    context: CONTEXT,
    toInput: (delta) =>
      delta.mode === 'rotate'
        ? { furnitureId: TABLE_ID, rotationDeg: TABLE.rotationDeg + delta.angleDeg }
        : null,
    validate: validateRotateFurniture,
  };
}

/** Pulling a wall thicker or thinner. */
function wallThicknessBinding(): CommandBinding<{
  readonly wallId: typeof WALL_ID;
  readonly thicknessMm: number;
}> {
  return {
    build: createChangeWallThicknessCommand,
    context: CONTEXT,
    toInput: (delta) =>
      delta.mode === 'scale' ? { thicknessMm: delta.lengthMm, wallId: WALL_ID } : null,
    validate: validateChangeWallThickness,
  };
}

const TABLE_ANCHOR: GizmoAnchor = {
  position: new Vector3(sceneAt(TABLE_CENTRE_MM.x), 0, sceneAt(TABLE_CENTRE_MM.y)),
};

const WALL_ANCHOR: GizmoAnchor = {
  position: new Vector3(0, 0, 0),
  sizeMm: { x: millimetres(WALL_THICKNESS_MM) },
};

/** The ray that starts a drag on the table handle. */
function tableStartRay(): PickRay {
  return rayDownAt(sceneAt(TABLE_CENTRE_MM.x), sceneAt(TABLE_CENTRE_MM.y));
}

/** A ray that has dragged the table handle `offsetMm` along plan x. */
function tableRayAfter(offsetMm: number): PickRay {
  return rayDownAt(sceneAt(TABLE_CENTRE_MM.x + offsetMm), sceneAt(TABLE_CENTRE_MM.y));
}

/* -------------------------------------------------------------------------- */
/* One drag, one command.                                                      */
/* -------------------------------------------------------------------------- */

describe('a drag produces exactly one command', () => {
  /** A binding that counts what it was asked to do. */
  function countingBinding(): {
    readonly binding: CommandBinding<{
      readonly furnitureId: typeof TABLE_ID;
      readonly to: { readonly x: number; readonly y: number };
    }>;
    readonly counts: { validated: number; built: number };
  } {
    const inner = moveTableBinding();
    const counts = { built: 0, validated: 0 };

    return {
      binding: {
        ...inner,
        build: (input, context) => {
          counts.built += 1;

          return inner.build(input, context);
        },
        validate: (input, context) => {
          counts.validated += 1;

          return inner.validate(input, context);
        },
      },
      counts,
    };
  }

  it('builds one command after two hundred frames of dragging', () => {
    const { binding, counts } = countingBinding();
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding,
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    // Two hundred pointer frames, each one millimetre further along.
    for (let frame = 1; frame <= 200; frame += 1) {
      session.move(tableRayAfter(frame));
    }

    expect(counts.built).toBe(0);

    const outcome = session.drop();

    expect(counts.built).toBe(1);
    expect(outcome.kind).toBe('committed');
    expect(outcome.kind === 'committed' ? outcome.command.type : null).toBe('furniture.move');
    expect(outcome.kind === 'committed' ? outcome.command.changes : []).toHaveLength(1);
  });

  it('validates on every frame even though it builds on none of them', () => {
    const { binding, counts } = countingBinding();
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding,
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    // Frames from 50 mm on, so every one carries a non-zero snapped reading.
    for (let frame = 1; frame <= 200; frame += 1) {
      session.move(tableRayAfter(50 + frame));
    }

    expect(counts.validated).toBe(200);
    expect(counts.built).toBe(0);
  });

  it('carries the last reading into the command, not the first', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    for (let frame = 1; frame <= 200; frame += 1) {
      session.move(tableRayAfter(frame));
    }

    const outcome = session.drop();
    const change = outcome.kind === 'committed' ? outcome.command.changes[0] : undefined;

    expect(change?.kind).toBe('furniture');
    expect(change?.after).toMatchObject({ centre: { x: TABLE_CENTRE_MM.x + 200 } });
    // The saved drawing is untouched: the command carries the change, not the graph.
    expect(SPATIAL.byId[TABLE_ID]).toMatchObject({ centre: TABLE_CENTRE_MM });
  });

  it('will not build a second command however many times it is dropped', () => {
    const { binding, counts } = countingBinding();
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding,
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(200));

    expect(session.drop().kind).toBe('committed');
    expect(session.drop()).toEqual({ kind: 'nothingToDo' });
    expect(session.drop()).toEqual({ kind: 'nothingToDo' });
    expect(counts.built).toBe(1);
  });

  it('goes inert once it is over', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(200));
    session.drop();

    const settled = session.current();

    session.move(tableRayAfter(900));

    expect(session.current()).toBe(settled);
    expect(session.isFinished()).toBe(true);
  });

  it('does nothing at all for a drag that came back to where it started', () => {
    const { binding, counts } = countingBinding();
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding,
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(600));
    session.move(tableRayAfter(0));

    expect(session.drop()).toEqual({ kind: 'nothingToDo' });
    expect(counts.built).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Esc.                                                                        */
/* -------------------------------------------------------------------------- */

describe('cancelling mid-drag', () => {
  /**
   * A consumer that stages every preview, the way the draft slice would.
   *
   * Applying the previews to a copy is the whole point: if a cancel left
   * anything staged, this mirror would end the test somewhere other than where
   * the saved table is.
   */
  function stagingMirror(): {
    readonly stage: (preview: DragPreview) => void;
    readonly read: () => Furniture;
  } {
    let staged: Furniture = { ...TABLE, centre: { ...TABLE.centre } };

    return {
      read: () => staged,
      stage: (preview) => {
        const delta = preview.delta;

        staged =
          delta === null || delta.mode !== 'translate'
            ? { ...TABLE, centre: { ...TABLE.centre } }
            : {
                ...TABLE,
                centre: { x: TABLE.centre.x + delta.offsetMm, y: TABLE.centre.y },
              };
      },
    };
  }

  it('puts the drawing back exactly as it was, and builds nothing', () => {
    const { binding, counts } = ((): {
      binding: CommandBinding<{
        readonly furnitureId: typeof TABLE_ID;
        readonly to: { readonly x: number; readonly y: number };
      }>;
      counts: { built: number };
    } => {
      const inner = moveTableBinding();
      const counts = { built: 0 };

      return {
        binding: {
          ...inner,
          build: (input, context) => {
            counts.built += 1;

            return inner.build(input, context);
          },
        },
        counts,
      };
    })();

    const mirror = stagingMirror();
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding,
      handle: { axis: 'x', mode: 'translate' },
      onPreview: mirror.stage,
      startRay: tableStartRay(),
    });

    for (let frame = 1; frame <= 120; frame += 1) {
      session.move(tableRayAfter(frame * 5));
    }

    // Halfway through the drag the table really has moved on screen.
    expect(mirror.read().centre.x).not.toBe(TABLE.centre.x);

    const cancelled = session.cancel();

    expect(cancelled.phase).toBe('cancelled');
    expect(cancelled.delta).toBeNull();
    expect(cancelled.measurement).toBeNull();
    expect(mirror.read()).toEqual(TABLE);
    expect(counts.built).toBe(0);
    expect(SPATIAL.byId[TABLE_ID]).toEqual(TABLE);
  });

  it('cannot be dropped after it has been cancelled', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(200));
    session.cancel();

    expect(session.isFinished()).toBe(true);
    expect(session.drop()).toEqual({ kind: 'nothingToDo' });
  });

  it('ignores a second Esc', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(200));

    const first = session.cancel();

    expect(session.cancel()).toBe(first);
  });
});

/* -------------------------------------------------------------------------- */
/* Refusing while the pointer is still down.                                   */
/* -------------------------------------------------------------------------- */

describe('blocking an edit during the drag', () => {
  it('shows the violation outline before the release, and refuses the release', () => {
    const previews: DragPreview[] = [];
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      onPreview: (preview) => previews.push(preview),
      startRay: tableStartRay(),
    });

    // Still inside the room.
    session.move(tableRayAfter(500));

    expect(session.current().blocked).toBe(false);
    expect(session.current().status).toBe('neutral');

    // Dragged clear of the room the table is assigned to.
    session.move(tableRayAfter(5_000));

    const blocked = session.current();

    expect(blocked.blocked).toBe(true);
    expect(blocked.status).toBe('violation');
    expect(blocked.reasons.length).toBeGreaterThan(0);
    expect(blocked.reasons[0]).toContain('phòng khách');
    // The reading is still shown while it is refused: the user has to be able to
    // see how far out they are in order to come back in.
    expect(blocked.measurement).toBe('trục X: +5.000 mm');

    const outcome = session.drop();

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reasons : []).toEqual(blocked.reasons);
    expect(previews.some((preview) => preview.status === 'violation')).toBe(true);
  });

  it('lets the drag come back inside and be dropped after all', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      handle: { axis: 'x', mode: 'translate' },
      startRay: tableStartRay(),
    });

    session.move(tableRayAfter(5_000));

    expect(session.current().blocked).toBe(true);

    session.move(tableRayAfter(500));

    expect(session.current().blocked).toBe(false);
    expect(session.drop().kind).toBe('committed');
  });

  it('blocks a handle the bound command cannot express', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: moveTableBinding(),
      // A rotate handle bound to a move command.
      handle: { axis: 'y', mode: 'rotate' },
      startRay: rayDownAt(sceneAt(TABLE_CENTRE_MM.x) + 1, sceneAt(TABLE_CENTRE_MM.y)),
    });

    session.move(rayDownAt(sceneAt(TABLE_CENTRE_MM.x), sceneAt(TABLE_CENTRE_MM.y) + 1));

    expect(session.current().blocked).toBe(true);
    expect(session.current().status).toBe('violation');
    expect(session.drop().kind).toBe('refused');
  });
});

/* -------------------------------------------------------------------------- */
/* The other two modes, end to end.                                            */
/* -------------------------------------------------------------------------- */

describe('rotate and resize reach their own commands', () => {
  it('turns the table and emits one furniture.rotate', () => {
    const session = createDragSession({
      anchor: TABLE_ANCHOR,
      binding: rotateTableBinding(),
      handle: { axis: 'y', mode: 'rotate' },
      startRay: rayDownAt(sceneAt(TABLE_CENTRE_MM.x) + 1, sceneAt(TABLE_CENTRE_MM.y)),
    });

    for (let frame = 1; frame <= 200; frame += 1) {
      const turn = (frame / 200) * (Math.PI / 2);

      session.move(
        rayDownAt(
          sceneAt(TABLE_CENTRE_MM.x) + Math.cos(turn),
          sceneAt(TABLE_CENTRE_MM.y) + Math.sin(turn),
        ),
      );
    }

    expect(session.current().measurement).toBe('trục Y: +90,0°');

    const outcome = session.drop();

    expect(outcome.kind).toBe('committed');
    expect(outcome.kind === 'committed' ? outcome.command.type : null).toBe('furniture.rotate');
    expect(
      outcome.kind === 'committed' ? outcome.command.changes[0]?.after : undefined,
    ).toMatchObject({ rotationDeg: 90 });
  });

  it('pulls the wall thicker and emits one wall.changeThickness', () => {
    const session = createDragSession({
      anchor: WALL_ANCHOR,
      binding: wallThicknessBinding(),
      handle: { axis: 'x', mode: 'scale' },
      startRay: rayDownAt(0, 0),
    });

    for (let frame = 1; frame <= 200; frame += 1) {
      session.move(rayDownAt(sceneAt(frame * 0.4), 0));
    }

    expect(session.current().measurement).toBe('trục X: 300 mm');

    const outcome = session.drop();

    expect(outcome.kind).toBe('committed');
    expect(outcome.kind === 'committed' ? outcome.command.type : null).toBe(
      'wall.changeThickness',
    );
    expect(
      outcome.kind === 'committed' ? outcome.command.changes[0]?.after : undefined,
    ).toMatchObject({ thicknessMm: 300 });
  });

  it('refuses a wall dragged below the thinnest a wall may be', () => {
    const session = createDragSession({
      anchor: WALL_ANCHOR,
      binding: wallThicknessBinding(),
      handle: { axis: 'x', mode: 'scale' },
      startRay: rayDownAt(0, 0),
    });

    session.move(rayDownAt(sceneAt(-5_000), 0));

    const blocked = session.current();

    expect(blocked.blocked).toBe(true);
    expect(blocked.status).toBe('violation');
    expect(blocked.measurement).toBe('trục X: 50 mm');
    expect(session.drop().kind).toBe('refused');
  });
});

/* -------------------------------------------------------------------------- */
/* Nothing is written before the release.                                      */
/* -------------------------------------------------------------------------- */

describe('the saved drawing', () => {
  it('is never touched by a drag, however it ends', () => {
    const snapshot = JSON.stringify(SPATIAL.byId);

    for (const ending of ['drop', 'cancel'] as const) {
      const session = createDragSession({
        anchor: TABLE_ANCHOR,
        binding: moveTableBinding(),
        handle: { axis: 'x', mode: 'translate' },
        startRay: tableStartRay(),
      });

      for (let frame = 1; frame <= 50; frame += 1) {
        session.move(tableRayAfter(frame * 4));
      }

      if (ending === 'drop') {
        session.drop();
      } else {
        session.cancel();
      }

      expect(JSON.stringify(SPATIAL.byId)).toBe(snapshot);
    }
  });

  it('carries a delta of the union type a consumer can switch on', () => {
    const deltas: GizmoDelta[] = [
      { axis: 'x', mode: 'translate', offsetMm: millimetres(50) },
      { angleDeg: degrees(15), axis: 'y', mode: 'rotate' },
      { axis: 'z', factor: 1, lengthMm: millimetres(200), mode: 'scale' },
    ];

    expect(deltas.map(isZeroDelta)).toEqual([false, false, true]);
  });
});
