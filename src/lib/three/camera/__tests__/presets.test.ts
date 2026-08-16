import { Box3, OrthographicCamera, PerspectiveCamera, Vector3, type Camera } from 'three';
import { describe, expect, it } from 'vitest';

import {
  degrees,
  degreesToRadians,
  millimetres,
  radians,
  radiansToDegrees,
} from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { OpeningId, RoomId, WallId } from '@/domain/spatial/types';

import {
  buildFloorMesh,
  type BuildFloorInput,
  type BuildableLevel,
  type BuildableRoom,
} from '../../build/floor';
import {
  buildingExtent,
  createCameraMode,
  viewpointEye,
  type CameraMode,
  type CameraModeContext,
  type Viewpoint,
} from '../modes';
import {
  boundsOfIds,
  boxExitDistance,
  boxOfExtent,
  frameObjects,
  frameViewpoint,
  unionBounds,
  viewBasis,
  type FrameOptions,
} from '../frameObjects';
import {
  CameraDirector,
  CAMERA_PRESETS,
  easeInOutCubic,
  interpolateViewpoint,
  isFlatMode,
  presetById,
  presetForKey,
  presetViewpoint,
  PRESET_SETTINGS,
  shortestTurn,
  ViewpointTransition,
  type CameraDirectorOptions,
  type CameraPresetId,
} from '../presets';

/* -------------------------------------------------------------------------- */
/* Fixture: the standard sample plan, 48 / 21 / 34 / 14 / 4.                    */
/* -------------------------------------------------------------------------- */

const WALL_COUNT = 48;
const OPENING_COUNT = 34;
const ROOM_COUNT = 14;

const LEVEL: BuildableLevel = {
  id: 'L-01',
  elevationMm: millimetres(0),
  heightMm: millimetres(3000),
};

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function twoDigits(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

const WALLS: readonly Wall[] = Array.from({ length: WALL_COUNT }, (_unused, index): Wall => {
  const alongMm = Math.floor(index / 6) * 5000;
  const acrossMm = (index % 6) * 6000;

  return {
    id: `W-${twoDigits(index + 1)}` as WallId,
    kind: 'partition',
    centreline: { start: pointAt(alongMm, acrossMm), end: pointAt(alongMm + 4000, acrossMm) },
    thicknessMm: millimetres(200),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
});

const OPENINGS: readonly AttachedOpening[] = Array.from(
  { length: OPENING_COUNT },
  (_unused, index): AttachedOpening => ({
    id: `D-${twoDigits(index + 1)}` as OpeningId,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2100),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: `W-${twoDigits(index + 1)}` as WallId,
    relativePosition: 0.5,
  }),
);

const ROOMS: readonly BuildableRoom[] = Array.from(
  { length: ROOM_COUNT },
  (_unused, index): BuildableRoom => {
    const offsetMm = index * 6000;
    return {
      id: `R-${twoDigits(index + 1)}` as RoomId,
      outline: [
        pointAt(offsetMm, 0),
        pointAt(offsetMm + 5000, 0),
        pointAt(offsetMm + 5000, 4000),
        pointAt(offsetMm, 4000),
      ],
    };
  },
);

const STOREY: BuildFloorInput = { level: LEVEL, walls: WALLS, rooms: ROOMS, openings: OPENINGS };

const SCENE = buildFloorMesh(STOREY);
const EXTENT = buildingExtent(new Box3().setFromObject(SCENE));
const CONTEXT: CameraModeContext = { extent: EXTENT };

/** Three walls at one end of the plan, spread across it — a real selection. */
const THREE_WALLS: readonly string[] = ['W-01', 'W-02', 'W-03'];

const ASPECT = 16 / 9;

function toRad(value: number): number {
  return degreesToRadians(degrees(value));
}

function toDeg(value: number): number {
  return radiansToDegrees(radians(value));
}

function required<TValue>(value: TValue | null, what: string): TValue {
  if (value === null) {
    throw new Error(`the fixture should have produced ${what}`);
  }
  return value;
}

function frameOptions(overrides: Partial<FrameOptions> = {}): FrameOptions {
  return {
    azimuthRad: toRad(30),
    polarRad: toRad(60),
    aspect: ASPECT,
    paddingFraction: PRESET_SETTINGS.framePaddingFraction,
    clearanceMarginM: PRESET_SETTINGS.clearanceMarginM,
    ...overrides,
  };
}

/** A camera standing where a viewpoint says, with the projection that mode draws with. */
function cameraFor(
  viewpoint: Viewpoint,
  mode: CameraMode,
  aspect: number = ASPECT,
): PerspectiveCamera | OrthographicCamera {
  const camera = isFlatMode(mode) ? new OrthographicCamera() : new PerspectiveCamera();
  createCameraMode(mode, viewpoint, CONTEXT).applyTo(camera, aspect);
  camera.updateMatrixWorld(true);
  return camera;
}

/** The perspective camera an orbit viewpoint is drawn with. */
function cameraAt(viewpoint: Viewpoint, aspect: number = ASPECT): Camera {
  return cameraFor(viewpoint, 'orbit', aspect);
}

/** Every corner of a box in normalised device coordinates. */
function ndcCorners(camera: Camera, box: Box3): Vector3[] {
  const points: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        points.push(new Vector3(x, y, z).project(camera));
      }
    }
  }
  return points;
}

/** The furthest any corner of the box strays from the middle of the screen. */
function widestNdc(camera: Camera, box: Box3): number {
  return ndcCorners(camera, box).reduce(
    (widest, point) => Math.max(widest, Math.abs(point.x), Math.abs(point.y)),
    0,
  );
}

/** How wide a box reads on screen, as a fraction of the viewport. */
function ndcWidth(camera: Camera, box: Box3): number {
  const xs = ndcCorners(camera, box).map((point) => point.x);
  return Math.max(...xs) - Math.min(...xs);
}

/* -------------------------------------------------------------------------- */
/* Pure geometry.                                                              */
/* -------------------------------------------------------------------------- */

describe('unionBounds', () => {
  it('has nothing to say about nothing', () => {
    expect(unionBounds([])).toBeNull();
    expect(unionBounds([new Box3()])).toBeNull();
  });

  it('wraps everything it is given', () => {
    const union = required(
      unionBounds([
        new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1)),
        new Box3(new Vector3(4, -2, 3), new Vector3(5, 0, 6)),
      ]),
      'a union',
    );

    expect(union.min.toArray()).toEqual([0, -2, 0]);
    expect(union.max.toArray()).toEqual([5, 1, 6]);
  });

  it('steps over an empty box instead of swallowing everything into it', () => {
    const real = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    const union = required(unionBounds([new Box3(), real, new Box3()]), 'a union');

    expect(union.min.toArray()).toEqual([0, 0, 0]);
    expect(union.max.toArray()).toEqual([1, 1, 1]);
  });
});

describe('viewBasis', () => {
  it('builds a right-handed frame that agrees with the modes', () => {
    for (const polarDeg of [5, 45, 85]) {
      for (const azimuthDeg of [0, 30, 150, 270]) {
        const basis = viewBasis(toRad(azimuthDeg), toRad(polarDeg));

        expect(basis.forward.length()).toBeCloseTo(1, 12);
        expect(basis.right.length()).toBeCloseTo(1, 12);
        expect(basis.up.length()).toBeCloseTo(1, 12);
        expect(basis.right.dot(basis.forward)).toBeCloseTo(0, 12);
        expect(basis.up.dot(basis.forward)).toBeCloseTo(0, 12);
        expect(basis.right.y).toBeCloseTo(0, 12);
      }
    }
  });

  it('still has an up vector when the view is straight down', () => {
    const basis = viewBasis(0, 0);

    expect(basis.forward.y).toBeCloseTo(-1, 12);
    expect(basis.up.length()).toBeCloseTo(1, 12);
    expect(basis.up.y).toBeCloseTo(0, 12);
  });
});

describe('boxExitDistance', () => {
  const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

  it('reports the far face when the ray starts inside', () => {
    expect(boxExitDistance(box, new Vector3(0, 0, 0), new Vector3(0, 0, 1))).toBeCloseTo(1, 12);
    expect(boxExitDistance(box, new Vector3(-0.5, 0, 0), new Vector3(1, 0, 0))).toBeCloseTo(
      1.5,
      12,
    );
  });

  it('reports nothing when the ray never meets the box', () => {
    expect(boxExitDistance(box, new Vector3(0, 5, 0), new Vector3(0, 1, 0))).toBe(0);
    expect(boxExitDistance(box, new Vector3(9, 9, 9), new Vector3(0, 0, 1))).toBe(0);
  });

  it('reports the far face when the ray passes right through', () => {
    expect(boxExitDistance(box, new Vector3(0, 0, -5), new Vector3(0, 0, 1))).toBeCloseTo(6, 12);
  });
});

/* -------------------------------------------------------------------------- */
/* frameViewpoint: fifteen per cent, and never inside.                         */
/* -------------------------------------------------------------------------- */

describe('frameViewpoint', () => {
  const box = new Box3(new Vector3(0, 0, 0), new Vector3(8, 3, 5));

  it('aims at the middle of what it is framing', () => {
    const viewpoint = frameViewpoint(box, frameOptions());

    expect(viewpoint.target.toArray()).toEqual([4, 1.5, 2.5]);
  });

  it('leaves fifteen per cent of the viewport empty around it', () => {
    for (const azimuthDeg of [0, 37, 121, 264]) {
      for (const polarDeg of [15, 55, 85]) {
        const viewpoint = frameViewpoint(
          box,
          frameOptions({ azimuthRad: toRad(azimuthDeg), polarRad: toRad(polarDeg) }),
        );
        const widest = widestNdc(cameraAt(viewpoint), box);

        // Never past the padding line, and never so far back that the box is lost
        // in the middle of the screen.
        expect(widest).toBeLessThanOrEqual(1 - PRESET_SETTINGS.framePaddingFraction + 1e-9);
        expect(widest).toBeGreaterThan(0.4);
      }
    }
  });

  it('frames a wide box by its width once the viewport is narrow enough', () => {
    const wide = frameViewpoint(box, frameOptions({ aspect: 0.5 }));
    const square = frameViewpoint(box, frameOptions({ aspect: 1 }));

    expect(wide.distanceM).toBeGreaterThan(square.distanceM);
    expect(widestNdc(cameraAt(wide, 0.5), box)).toBeLessThanOrEqual(
      1 - PRESET_SETTINGS.framePaddingFraction + 1e-9,
    );
  });

  it('never leaves the camera standing inside what it is looking at', () => {
    const deep = new Box3(new Vector3(-0.5, 0, -20), new Vector3(0.5, 3, 20));

    for (const azimuthDeg of [0, 45, 90, 180, 270]) {
      for (const polarDeg of [5, 45, 85]) {
        const viewpoint = frameViewpoint(
          deep,
          frameOptions({ azimuthRad: toRad(azimuthDeg), polarRad: toRad(polarDeg) }),
        );

        expect(deep.containsPoint(viewpointEye(viewpoint))).toBe(false);
      }
    }
  });

  it('keeps its distance from a selection with no size at all', () => {
    const speck = new Box3(new Vector3(2, 1, 2), new Vector3(2, 1, 2));
    const viewpoint = frameViewpoint(speck, frameOptions());

    expect(viewpoint.distanceM).toBeGreaterThanOrEqual(PRESET_SETTINGS.clearanceMarginM);
  });

  it('stays out of a second solid when it is given one', () => {
    const shell = new Box3(new Vector3(-30, -1, -30), new Vector3(30, 8, 30));
    const inside = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 3, 1));

    const free = frameViewpoint(inside, frameOptions());
    const avoiding = frameViewpoint(inside, { ...frameOptions(), avoid: shell });

    expect(shell.containsPoint(viewpointEye(free))).toBe(true);
    expect(shell.containsPoint(viewpointEye(avoiding))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* frameObjects against a real storey.                                         */
/* -------------------------------------------------------------------------- */

describe('frameObjects', () => {
  it('finds the walls it is asked for and nothing else', () => {
    const three = required(boundsOfIds(SCENE, THREE_WALLS), 'a box around three walls');
    const one = required(boundsOfIds(SCENE, ['W-01']), 'a box around one wall');

    expect(three.containsBox(one)).toBe(true);
    expect(three.getSize(new Vector3()).length()).toBeGreaterThan(
      one.getSize(new Vector3()).length(),
    );
  });

  it('has nothing to say about ids the scene has never heard of', () => {
    expect(boundsOfIds(SCENE, ['W-999'])).toBeNull();
    expect(boundsOfIds(SCENE, [])).toBeNull();
    expect(frameObjects(SCENE, ['W-999'], frameOptions())).toBeNull();
  });

  it('brings all three walls inside the frame, from any angle', () => {
    for (const azimuthDeg of [0, 30, 115, 200, 330]) {
      for (const polarDeg of [10, 60, 85]) {
        const viewpoint = required(
          frameObjects(
            SCENE,
            THREE_WALLS,
            frameOptions({ azimuthRad: toRad(azimuthDeg), polarRad: toRad(polarDeg) }),
          ),
          'a viewpoint',
        );
        const camera = cameraAt(viewpoint);

        for (const id of THREE_WALLS) {
          const wall = required(boundsOfIds(SCENE, [id]), `a box for ${id}`);
          for (const corner of ndcCorners(camera, wall)) {
            expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
            // In front of the camera and inside the clip planes.
            expect(corner.z).toBeGreaterThan(-1);
            expect(corner.z).toBeLessThan(1);
          }
        }
      }
    }
  });

  it('fills the frame with the three walls rather than with the whole storey', () => {
    const three = required(boundsOfIds(SCENE, THREE_WALLS), 'a box');
    const selection = required(frameObjects(SCENE, THREE_WALLS, frameOptions()), 'a viewpoint');
    const everything = frameViewpoint(boxOfExtent(EXTENT), frameOptions());

    // Close enough that the selection is the subject, not a detail of the plan.
    expect(selection.distanceM).toBeLessThan(everything.distanceM / 2);
    expect(widestNdc(cameraAt(selection), three)).toBeGreaterThan(0.3);
  });

  it('does not park the camera inside the walls it is framing', () => {
    const three = required(boundsOfIds(SCENE, THREE_WALLS), 'a box');
    const viewpoint = required(frameObjects(SCENE, THREE_WALLS, frameOptions()), 'a viewpoint');

    expect(three.containsPoint(viewpointEye(viewpoint))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The six presets.                                                            */
/* -------------------------------------------------------------------------- */

describe('the presets', () => {
  it('are six, in key order', () => {
    expect(CAMERA_PRESETS.map((preset) => preset.id)).toEqual([
      'top',
      'front',
      'back',
      'left',
      'right',
      'perspective',
    ]);
  });

  it('answer to the number keys, on the digit row and on the numpad', () => {
    const expected: readonly CameraPresetId[] = [
      'top',
      'front',
      'back',
      'left',
      'right',
      'perspective',
    ];

    expected.forEach((id, index) => {
      const digit = index + 1;
      expect(presetForKey(`Digit${String(digit)}`)?.id).toBe(id);
      expect(presetForKey(`Numpad${String(digit)}`)?.id).toBe(id);
    });

    expect(presetForKey('Digit7')).toBeNull();
    expect(presetForKey('KeyW')).toBeNull();
  });

  it('refuses an id that is not one of the six', () => {
    expect(() => presetById('oblique' as unknown as CameraPresetId)).toThrow(RangeError);
  });

  it('put the eye on the side of the building each one is named for', () => {
    const centre = EXTENT.centre;
    const eyeOf = (id: CameraPresetId): Vector3 =>
      viewpointEye(presetViewpoint(presetById(id), EXTENT, ASPECT));

    expect(eyeOf('front').z).toBeGreaterThan(centre.z);
    expect(eyeOf('front').x).toBeCloseTo(centre.x, 6);

    expect(eyeOf('back').z).toBeLessThan(centre.z);
    expect(eyeOf('right').x).toBeGreaterThan(centre.x);
    expect(eyeOf('left').x).toBeLessThan(centre.x);

    expect(eyeOf('top').y).toBeGreaterThan(centre.y);
    expect(eyeOf('top').x).toBeCloseTo(centre.x, 6);
    expect(eyeOf('top').z).toBeCloseTo(centre.z, 6);
  });

  it('read the elevations dead level, in the mode that can hold them there', () => {
    for (const id of ['front', 'back', 'left', 'right'] as const) {
      const preset = presetById(id);

      expect(preset.polarDeg).toBe(90);
      expect(preset.mode).toBe('elevation');

      // And the mode keeps it: nothing clamps a true elevation back to 85°.
      const built = createCameraMode(preset.mode, presetViewpoint(preset, EXTENT, ASPECT), CONTEXT);
      expect(toDeg(built.viewpoint().polarRad)).toBeCloseTo(90, 9);
      expect(built.pose().orthographicHalfHeightM).not.toBeNull();
      expect(built.pose().eye.y).toBeCloseTo(built.pose().target.y, 9);
    }
  });

  it('measures a facade truly: two equal walls read equal however far back they are', () => {
    // W-01 and W-06 are the same 4 m wall at opposite ends of the plan's depth,
    // so under the front elevation one is thirty metres behind the other.
    const near = required(boundsOfIds(SCENE, ['W-06']), 'W-06');
    const far = required(boundsOfIds(SCENE, ['W-01']), 'W-01');
    expect(near.getSize(new Vector3()).x).toBeCloseTo(far.getSize(new Vector3()).x, 9);
    expect(Math.abs(near.getCenter(new Vector3()).z - far.getCenter(new Vector3()).z)).toBeCloseTo(
      30,
      6,
    );

    const preset = presetById('front');
    const viewpoint = presetViewpoint(preset, EXTENT, ASPECT);

    // The elevation is orthographic, so the two measure identically.
    const elevation = cameraFor(viewpoint, preset.mode);
    expect(ndcWidth(elevation, near)).toBeCloseTo(ndcWidth(elevation, far), 9);

    // This is the defect the mode exists to fix: the perspective camera the
    // elevations used to be taken with reads the nearer wall about three
    // quarters longer than the identical wall behind it.
    const perspective = cameraFor(viewpoint, 'orbit');
    expect(ndcWidth(perspective, near) / ndcWidth(perspective, far)).toBeGreaterThan(1.5);
  });

  it('never stand inside the building', () => {
    const building = boxOfExtent(EXTENT);

    for (const preset of CAMERA_PRESETS) {
      // Where the camera really ends up, through the mode that draws it — for a
      // flat view that is where it parks, which is not its framing distance.
      const built = createCameraMode(preset.mode, presetViewpoint(preset, EXTENT, ASPECT), CONTEXT);
      expect(building.containsPoint(built.pose().eye)).toBe(false);
    }
  });

  it('bring the whole building into the frame, with the margin left round it', () => {
    const building = boxOfExtent(EXTENT);
    const padded = 1 - PRESET_SETTINGS.framePaddingFraction;

    for (const preset of CAMERA_PRESETS) {
      // Each one measured through the camera it is actually drawn with.
      const camera = cameraFor(presetViewpoint(preset, EXTENT, ASPECT), preset.mode);
      const widest = widestNdc(camera, building);

      expect(widest).toBeLessThanOrEqual(padded + 1e-9);

      if (isFlatMode(preset.mode)) {
        // A flat view is fitted exactly: depth cannot change size under an
        // orthographic camera, so the building reaches the padding line and
        // stops on it. Fitted as though it had perspective depth it would sit
        // well inside — which is what the `orthographic` flag exists to prevent.
        expect(widest).toBeCloseTo(padded, 9);
      } else {
        // A perspective fit allows for the near corner subtending more than the
        // far one, so it is deliberately conservative.
        expect(widest).toBeGreaterThan(0.4);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Easing and interpolation.                                                   */
/* -------------------------------------------------------------------------- */

describe('easeInOutCubic', () => {
  it('starts at nothing and ends at everything', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-4)).toBe(0);
    expect(easeInOutCubic(9)).toBe(1);
  });

  it('is not a straight line', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.15);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.85);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
  });

  it('only ever goes forwards', () => {
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
      const value = easeInOutCubic(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('shortestTurn', () => {
  it('takes the short way round', () => {
    expect(toDeg(shortestTurn(toRad(350), toRad(10)))).toBeCloseTo(20, 9);
    expect(toDeg(shortestTurn(toRad(10), toRad(350)))).toBeCloseTo(-20, 9);
    expect(toDeg(shortestTurn(toRad(0), toRad(90)))).toBeCloseTo(90, 9);
    expect(Math.abs(toDeg(shortestTurn(toRad(0), toRad(180))))).toBeCloseTo(180, 9);
  });
});

describe('interpolateViewpoint', () => {
  const from: Viewpoint = {
    target: new Vector3(0, 0, 0),
    azimuthRad: toRad(350),
    polarRad: toRad(20),
    distanceM: 5,
  };
  const to: Viewpoint = {
    target: new Vector3(10, 4, -2),
    azimuthRad: toRad(10),
    polarRad: toRad(60),
    distanceM: 80,
  };

  it('returns the ends exactly', () => {
    expect(interpolateViewpoint(from, to, 0).distanceM).toBe(5);
    expect(interpolateViewpoint(from, to, 1).distanceM).toBe(80);
    expect(interpolateViewpoint(from, to, 1).target.distanceTo(to.target)).toBe(0);
  });

  it('crosses the distance geometrically, not linearly', () => {
    // The geometric middle of 5 and 80 is 20; the linear one would be 42,5.
    expect(interpolateViewpoint(from, to, 0.5).distanceM).toBeCloseTo(20, 9);
  });

  it('turns the short way through zero', () => {
    const middle = interpolateViewpoint(from, to, 0.5);
    expect(toDeg(middle.azimuthRad)).toBeCloseTo(360, 9);
  });

  it('does not alias the viewpoints it was given', () => {
    const middle = interpolateViewpoint(from, to, 0.5);
    middle.target.set(99, 99, 99);

    expect(from.target.toArray()).toEqual([0, 0, 0]);
    expect(to.target.toArray()).toEqual([10, 4, -2]);
  });
});

/* -------------------------------------------------------------------------- */
/* The move.                                                                   */
/* -------------------------------------------------------------------------- */

function someViewpoint(overrides: Partial<Viewpoint> = {}): Viewpoint {
  return {
    target: EXTENT.centre.clone(),
    azimuthRad: toRad(30),
    polarRad: toRad(55),
    distanceM: 30,
    ...overrides,
  };
}

describe('ViewpointTransition', () => {
  const start = someViewpoint();
  const end = someViewpoint({ azimuthRad: toRad(180), polarRad: toRad(20), distanceM: 60 });

  it('takes 340 ms by default, one of the durations the repository allows', () => {
    expect(new ViewpointTransition(start, end).durationMs).toBe(340);
    expect(PRESET_SETTINGS.transitionMs).toBe(340);
  });

  it('starts where it was and ends where it was told', () => {
    const move = new ViewpointTransition(start, end);

    expect(move.viewpoint().distanceM).toBeCloseTo(start.distanceM, 9);
    move.advance(0.34);
    expect(move.finished).toBe(true);
    expect(move.viewpoint().distanceM).toBeCloseTo(end.distanceM, 9);
    expect(move.viewpoint().target.distanceTo(end.target)).toBeCloseTo(0, 9);
  });

  it('is not halfway when the time is', () => {
    const move = new ViewpointTransition(start, end);
    move.advance(0.085);

    expect(move.fraction).toBeCloseTo(0.25, 9);
    expect(move.eased).toBeLessThan(0.15);
  });

  it('runs past its end without going past its destination', () => {
    const move = new ViewpointTransition(start, end);
    move.advance(10);

    expect(move.fraction).toBe(1);
    expect(move.viewpoint().distanceM).toBeCloseTo(end.distanceM, 9);
  });

  it('stops dead when it is cancelled, and does not resume', () => {
    const move = new ViewpointTransition(start, end);
    move.advance(0.17);
    const stoppedAt = move.viewpoint();

    move.cancel();
    move.advance(5);

    expect(move.cancelled).toBe(true);
    expect(move.finished).toBe(false);
    expect(move.viewpoint().distanceM).toBeCloseTo(stoppedAt.distanceM, 12);
  });

  it('takes no time at all under reduced motion', () => {
    const move = new ViewpointTransition(start, end, { reducedMotion: true });

    expect(move.durationMs).toBe(0);
    expect(move.finished).toBe(true);
    expect(move.viewpoint().distanceM).toBeCloseTo(end.distanceM, 9);
  });

  it('does not alias the viewpoints it was handed', () => {
    const mutable = someViewpoint();
    const move = new ViewpointTransition(mutable, end);
    mutable.target.set(0, 0, 0);

    expect(move.from.target.distanceTo(EXTENT.centre)).toBeCloseTo(0, 12);
  });
});

/* -------------------------------------------------------------------------- */
/* The director.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A director looking at a corner of the plan rather than at its middle, so that
 * a move to a preset has to travel on every channel and not only on the angle.
 */
function directorAt(options: CameraDirectorOptions = {}): CameraDirector {
  const start = someViewpoint({ target: EXTENT.centre.clone().add(new Vector3(6, 0, -4)) });

  return new CameraDirector(createCameraMode('orbit', start, CONTEXT), CONTEXT, {
    root: SCENE,
    aspect: ASPECT,
    ...options,
  });
}

describe('CameraDirector', () => {
  it('flies to a preset over 340 ms and arrives in the mode that preset belongs to', () => {
    const director = directorAt();
    const destination = presetViewpoint(presetById('front'), EXTENT, ASPECT);

    const start = director.viewpoint();
    director.goToPreset('front');
    expect(director.moving).toBe(true);

    director.update(0.17);
    const halfway = director.viewpoint();
    expect(director.moving).toBe(true);
    // Under way on every channel, and arrived on none of them.
    expect(halfway.target.distanceTo(destination.target)).toBeGreaterThan(0.01);
    expect(halfway.target.distanceTo(start.target)).toBeGreaterThan(0.01);
    expect(Math.abs(halfway.distanceM - destination.distanceM)).toBeGreaterThan(0.01);

    director.update(0.17);
    expect(director.moving).toBe(false);
    expect(director.controller.mode).toBe('elevation');
    expect(director.viewpoint().target.distanceTo(destination.target)).toBeLessThan(1e-9);
    expect(director.viewpoint().distanceM).toBeCloseTo(destination.distanceM, 9);
  });

  it('flies to an elevation with the perspective camera, and lands orthographic', () => {
    const director = directorAt();
    director.goToPreset('front');

    director.update(0.17);
    expect(director.controller.mode).toBe('orbit');
    expect(director.pose().orthographicHalfHeightM).toBeNull();

    director.update(0.17);
    expect(director.controller.mode).toBe('elevation');
    expect(director.pose().orthographicHalfHeightM).not.toBeNull();
  });

  it('stays orthographic turning from one elevation to the next', () => {
    const director = directorAt({ reducedMotion: true });
    director.goToPreset('front');
    expect(director.controller.mode).toBe('elevation');

    director.setReducedMotion(false);
    director.goToPreset('right');
    director.update(0.17);

    expect(director.controller.mode).toBe('elevation');
    expect(director.pose().orthographicHalfHeightM).not.toBeNull();
    // Mid-turn between the two facades, not sat on either.
    const heading = toDeg(director.viewpoint().azimuthRad);
    expect(heading).toBeGreaterThan(1);
    expect(heading).toBeLessThan(89);
  });

  it('arrives instantly under reduced motion, with no frame of animation', () => {
    const director = directorAt({ reducedMotion: true });
    const destination = presetViewpoint(presetById('front'), EXTENT, ASPECT);

    const move = director.goToPreset('front');

    // Nothing has been updated, and it is already there.
    expect(move.durationMs).toBe(0);
    expect(director.moving).toBe(false);
    expect(director.viewpoint().target.distanceTo(destination.target)).toBeLessThan(1e-9);
    expect(director.viewpoint().distanceM).toBeCloseTo(destination.distanceM, 9);
  });

  it('can be told to stop animating part-way through a session', () => {
    const director = directorAt();
    director.goToPreset('front');
    director.update(0.05);
    expect(director.moving).toBe(true);

    director.setReducedMotion(true);
    const destination = presetViewpoint(presetById('back'), EXTENT, ASPECT);
    director.goToPreset('back');

    expect(director.moving).toBe(false);
    expect(director.viewpoint().target.distanceTo(destination.target)).toBeLessThan(1e-9);
  });

  it('hands the camera back where it was interrupted', () => {
    const director = directorAt();
    director.goToPreset('back');
    director.update(0.17);
    const grabbed = director.viewpoint();

    director.interrupt();

    expect(director.moving).toBe(false);
    expect(director.transition).toBeNull();
    expect(director.viewpoint().target.distanceTo(grabbed.target)).toBeCloseTo(0, 12);
    expect(director.viewpoint().distanceM).toBeCloseTo(grabbed.distanceM, 12);

    // And it stays there: no settling, no snap to either end.
    director.update(1);
    expect(director.viewpoint().target.distanceTo(grabbed.target)).toBeCloseTo(0, 9);
    expect(director.viewpoint().distanceM).toBeCloseTo(grabbed.distanceM, 9);
  });

  it('is happy to be interrupted when nothing is moving', () => {
    const director = directorAt();
    const before = director.viewpoint();

    director.interrupt();

    expect(director.viewpoint().distanceM).toBe(before.distanceM);
  });

  it('retargets from where it has got to, not from where it set off', () => {
    const director = directorAt();
    director.goToPreset('front');
    director.update(0.17);
    const halfway = director.viewpoint();

    const second = director.goToPreset('back');

    expect(second.from.target.distanceTo(halfway.target)).toBeCloseTo(0, 12);
    expect(second.from.distanceM).toBeCloseTo(halfway.distanceM, 12);
  });

  it('flies into the plan view with the perspective camera, and lands orthographic', () => {
    const director = directorAt();
    director.goToPreset('top');

    director.update(0.17);
    expect(director.controller.mode).toBe('orbit');
    expect(director.pose().orthographicHalfHeightM).toBeNull();

    director.update(0.17);
    expect(director.controller.mode).toBe('top');
    expect(director.pose().orthographicHalfHeightM).not.toBeNull();
  });

  it('stays orthographic for a move that never leaves the plan view', () => {
    const director = directorAt();
    director.goToPreset('top');
    director.update(0.34);
    expect(director.controller.mode).toBe('top');

    director.goToPreset('top');
    director.update(0.17);
    expect(director.controller.mode).toBe('top');
    expect(director.pose().orthographicHalfHeightM).not.toBeNull();
  });

  it('answers the number keys and ignores everything else', () => {
    const director = directorAt({ reducedMotion: true });

    expect(director.handleKey('Digit2')).toBe(true);
    expect(director.viewpoint().azimuthRad).toBeCloseTo(toRad(presetById('front').azimuthDeg), 9);

    expect(director.handleKey('Numpad5')).toBe(true);
    expect(director.viewpoint().azimuthRad).toBeCloseTo(toRad(presetById('right').azimuthDeg), 9);

    expect(director.handleKey('KeyW')).toBe(false);
    expect(director.handleKey('Digit9')).toBe(false);
  });

  it('frames a selection and brings every wall of it into view', () => {
    const director = directorAt({ reducedMotion: true });

    expect(director.frameObjects(THREE_WALLS)).not.toBeNull();

    const camera = new PerspectiveCamera();
    director.applyTo(camera, ASPECT);
    camera.updateMatrixWorld(true);

    for (const id of THREE_WALLS) {
      const wall = required(boundsOfIds(SCENE, [id]), `a box for ${id}`);
      for (const corner of ndcCorners(camera, wall)) {
        expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the heading it was already looking from when it frames a selection', () => {
    const director = directorAt({ reducedMotion: true });
    const before = director.viewpoint();

    director.frameObjects(THREE_WALLS);

    expect(director.viewpoint().azimuthRad).toBeCloseTo(before.azimuthRad, 9);
    expect(director.viewpoint().polarRad).toBeCloseTo(before.polarRad, 9);
  });

  it('leaves the camera alone when there is nothing to frame', () => {
    const director = directorAt({ reducedMotion: true });
    const before = director.viewpoint();

    expect(director.frameObjects(['W-999'])).toBeNull();
    expect(director.frameObjects([])).toBeNull();
    expect(director.viewpoint().distanceM).toBe(before.distanceM);

    director.setRoot(null);
    expect(director.frameObjects(THREE_WALLS)).toBeNull();
  });

  it('lifts a walker into the orbit mode rather than framing on foot', () => {
    const walker = createCameraMode('walk', someViewpoint(), CONTEXT);
    const director = new CameraDirector(walker, CONTEXT, {
      root: SCENE,
      aspect: ASPECT,
      reducedMotion: true,
    });

    expect(director.frameObjects(THREE_WALLS)).not.toBeNull();
    expect(director.controller.mode).toBe('orbit');
  });

  it('drives the mode as usual when no move is running', () => {
    const director = directorAt();
    const orbit = director.controller;

    expect(director.moving).toBe(false);
    // A settled mode reports that nothing changed, which is what a caller needs
    // to know to stop redrawing.
    expect(director.update(1 / 60)).toBe(false);
    expect(director.controller).toBe(orbit);
  });
});
