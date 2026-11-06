import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { degrees, millimetres } from '@/domain/units/types';

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

/** Wall thickness the resize-handle cases start from. */
const WALL_THICKNESS_MM = 220;

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


describe('the delta type', () => {
  it('carries a delta of the union type a consumer can switch on', () => {
    const deltas: GizmoDelta[] = [
      { axis: 'x', mode: 'translate', offsetMm: millimetres(50) },
      { angleDeg: degrees(15), axis: 'y', mode: 'rotate' },
      { axis: 'z', factor: 1, lengthMm: millimetres(200), mode: 'scale' },
    ];

    expect(deltas.map(isZeroDelta)).toEqual([false, false, true]);
  });
});
