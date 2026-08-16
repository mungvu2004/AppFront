import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  degrees,
  degreesToRadians,
  radians,
  radiansToDegrees,
  RADIANS_PER_TURN,
} from '@/domain/units/types';

import { CAMERA_SETTINGS } from '../settings';
import {
  boundingRadiusM,
  buildingExtent,
  createCameraMode,
  extentFloorM,
  frameDistanceM,
  frameHalfHeightM,
  initialViewpoint,
  orbitDistanceLimits,
  OrbitCameraMode,
  switchCameraMode,
  TopCameraMode,
  topHalfHeightLimits,
  viewpointEye,
  WalkCameraMode,
  type CameraMode,
  type CameraModeContext,
  type Viewpoint,
} from '../modes';

/* -------------------------------------------------------------------------- */
/* Fixtures: the standard sample plan.                                         */
/* -------------------------------------------------------------------------- */

/** 24,86 m × 10 m is 248,60 m² — the standard sample floor area of invariant A14. */
const PLAN_WIDTH_M = 24.86;
const PLAN_DEPTH_M = 10;
const STOREY_HEIGHT_M = 3;

const EXTENT = buildingExtent(
  new Box3(new Vector3(0, 0, 0), new Vector3(PLAN_WIDTH_M, STOREY_HEIGHT_M, PLAN_DEPTH_M)),
);

const CONTEXT: CameraModeContext = { extent: EXTENT };

/** A block four times the size, for checking that the limits scale with it. */
const BIG_EXTENT = buildingExtent(new Box3(new Vector3(0, 0, 0), new Vector3(96, 24, 40)));

const FRAME_SECONDS = 1 / 60;

function toRad(value: number): number {
  return degreesToRadians(degrees(value));
}

function toDeg(value: number): number {
  return radiansToDegrees(radians(value));
}

/** A viewpoint aimed at the middle of the sample plan, from above and to one side. */
function sampleViewpoint(overrides: Partial<Viewpoint> = {}): Viewpoint {
  return {
    target: EXTENT.centre.clone(),
    azimuthRad: toRad(30),
    polarRad: toRad(55),
    distanceM: 24,
    ...overrides,
  };
}

function orbitAt(viewpoint: Viewpoint = sampleViewpoint()): OrbitCameraMode {
  return new OrbitCameraMode(viewpoint, CONTEXT);
}

/** Run a mode for `seconds` of 60 Hz frames, calling `each` after every one. */
function run(
  mode: { update: (dt: number) => boolean },
  seconds: number,
  each: () => void = () => undefined,
): void {
  const frames = Math.round(seconds / FRAME_SECONDS);
  for (let frame = 0; frame < frames; frame += 1) {
    mode.update(FRAME_SECONDS);
    each();
  }
}

const ALL_MODES: readonly CameraMode[] = ['orbit', 'top', 'walk'];

/** The tolerance the brief sets for a mode change: one centimetre. */
const SWITCH_TOLERANCE_M = 0.01;

/* -------------------------------------------------------------------------- */
/* The settings are the contract.                                              */
/* -------------------------------------------------------------------------- */

describe('CAMERA_SETTINGS', () => {
  it('states the numbers the brief asks for', () => {
    expect(CAMERA_SETTINGS.orbit.damping).toBe(0.08);
    expect(CAMERA_SETTINGS.orbit.minPolarDeg).toBe(5);
    expect(CAMERA_SETTINGS.orbit.maxPolarDeg).toBe(85);
    expect(CAMERA_SETTINGS.top.polarDeg).toBe(0);
    expect(CAMERA_SETTINGS.walk.eyeHeightM).toBe(1.6);
    expect(CAMERA_SETTINGS.walk.walkSpeedMps).toBe(1.4);
    expect(CAMERA_SETTINGS.walk.runSpeedMps).toBeGreaterThan(CAMERA_SETTINGS.walk.walkSpeedMps);
  });

  it('is frozen all the way down, so no caller can raise a limit at runtime', () => {
    expect(Object.isFrozen(CAMERA_SETTINGS)).toBe(true);
    expect(Object.isFrozen(CAMERA_SETTINGS.orbit)).toBe(true);
    expect(Object.isFrozen(CAMERA_SETTINGS.top)).toBe(true);
    expect(Object.isFrozen(CAMERA_SETTINGS.walk)).toBe(true);
    expect(Object.isFrozen(CAMERA_SETTINGS.walk.keys)).toBe(true);
    expect(Object.isFrozen(CAMERA_SETTINGS.walk.keys.forward)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* The building, and the limits it sets.                                       */
/* -------------------------------------------------------------------------- */

describe('the building extent', () => {
  it('measures the sample plan', () => {
    expect(EXTENT.centre.x).toBeCloseTo(PLAN_WIDTH_M / 2, 10);
    expect(EXTENT.sizeM.z).toBeCloseTo(PLAN_DEPTH_M, 10);
    expect(extentFloorM(EXTENT)).toBeCloseTo(0, 10);
  });

  it('treats an empty project as the smallest plan rather than as a point', () => {
    const empty = buildingExtent(new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0)));

    expect(boundingRadiusM(empty)).toBe(CAMERA_SETTINGS.shared.smallestPlanRadiusM);
    expect(orbitDistanceLimits(empty).maxM).toBeGreaterThan(orbitDistanceLimits(empty).minM);
  });

  it('converts between the two projections without losing the framing', () => {
    expect(frameHalfHeightM(frameDistanceM(7.5))).toBeCloseTo(7.5, 10);
  });

  it('opens on a distance inside the limits it will be held to', () => {
    const opening = initialViewpoint(EXTENT);
    const limits = orbitDistanceLimits(EXTENT);

    expect(opening.target.distanceTo(EXTENT.centre)).toBeCloseTo(0, 10);
    expect(opening.distanceM).toBeGreaterThanOrEqual(limits.minM);
    expect(opening.distanceM).toBeLessThanOrEqual(limits.maxM);
    expect(toDeg(opening.polarRad)).toBeGreaterThanOrEqual(CAMERA_SETTINGS.orbit.minPolarDeg);
    expect(toDeg(opening.polarRad)).toBeLessThanOrEqual(CAMERA_SETTINGS.orbit.maxPolarDeg);
  });
});

/* -------------------------------------------------------------------------- */
/* Orbit: the vertical angle never leaves 5°–85°.                              */
/* -------------------------------------------------------------------------- */

describe('the orbit mode', () => {
  // Dragging drags the building: pulling the roof down towards you tips it over
  // and takes the camera overhead, which is the 5° end of the band.
  it('never tilts past 5° however far the building is tipped over', () => {
    const mode = orbitAt();
    let highest = Infinity;

    for (let drag = 0; drag < 200; drag += 1) {
      mode.rotate(0, 40);
      run(mode, 3 * FRAME_SECONDS, () => {
        highest = Math.min(highest, toDeg(mode.viewpoint().polarRad));
      });
    }

    expect(highest).toBeGreaterThanOrEqual(CAMERA_SETTINGS.orbit.minPolarDeg);
    expect(toDeg(mode.viewpoint().polarRad)).toBeCloseTo(CAMERA_SETTINGS.orbit.minPolarDeg, 6);
  });

  it('never tilts past 85° however far the building is tipped back', () => {
    const mode = orbitAt();
    let lowest = -Infinity;

    for (let drag = 0; drag < 200; drag += 1) {
      mode.rotate(0, -40);
      run(mode, 3 * FRAME_SECONDS, () => {
        lowest = Math.max(lowest, toDeg(mode.viewpoint().polarRad));
      });
    }

    expect(lowest).toBeLessThanOrEqual(CAMERA_SETTINGS.orbit.maxPolarDeg);
    expect(toDeg(mode.viewpoint().polarRad)).toBeCloseTo(CAMERA_SETTINGS.orbit.maxPolarDeg, 6);
  });

  it('stays inside the band at every instant of a thrown pointer, not just at rest', () => {
    const mode = orbitAt();
    const seen: number[] = [];

    // A flick each way, sampled on every frame while the damping runs it out.
    for (const throwDistance of [900, -1500, 600, -300]) {
      mode.rotate(throwDistance / 2, throwDistance);
      run(mode, 1, () => seen.push(toDeg(mode.viewpoint().polarRad)));
    }

    expect(seen.length).toBeGreaterThan(200);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(CAMERA_SETTINGS.orbit.minPolarDeg);
    expect(Math.max(...seen)).toBeLessThanOrEqual(CAMERA_SETTINGS.orbit.maxPolarDeg);
  });

  it('holds the band through one enormous frame as well as many small ones', () => {
    const mode = orbitAt();
    mode.rotate(0, 100_000);
    mode.update(5);

    expect(toDeg(mode.viewpoint().polarRad)).toBeLessThanOrEqual(
      CAMERA_SETTINGS.orbit.maxPolarDeg,
    );
  });

  it('keeps the eye above the point it is looking at', () => {
    const mode = orbitAt();

    for (const drag of [500, -500, 5000, -5000]) {
      mode.rotate(0, drag);
      run(mode, 0.5, () => {
        const pose = mode.pose();
        expect(pose.eye.y).toBeGreaterThan(pose.target.y);
      });
    }
  });

  it('approaches the goal without overshooting it, then reports that it stopped', () => {
    const start = sampleViewpoint();
    const mode = orbitAt(start);
    const dragPx = 600;
    // Dragging left turns the heading up by a full turn per `rotatePixelsPerTurn`.
    const goalAzimuthRad =
      start.azimuthRad + (dragPx * RADIANS_PER_TURN) / CAMERA_SETTINGS.orbit.rotatePixelsPerTurn;
    mode.rotate(-dragPx, 0);

    let previousGap = Infinity;
    let moving = true;
    let frames = 0;

    while (moving && frames < 600) {
      moving = mode.update(FRAME_SECONDS);
      const gap = goalAzimuthRad - mode.viewpoint().azimuthRad;
      // Never past the goal, and never further from it than the frame before.
      // The tolerance is one rounding step: a lerp of a gap already down at 1e-15
      // can land a single ulp beyond it, which is float arithmetic, not a bounce.
      expect(gap).toBeGreaterThanOrEqual(-1e-12);
      expect(gap).toBeLessThanOrEqual(previousGap);
      previousGap = gap;
      frames += 1;
    }

    expect(moving).toBe(false);
    expect(frames).toBeLessThan(600);
    expect(mode.viewpoint().azimuthRad).toBeCloseTo(goalAzimuthRad, 12);
  });

  it('damps by the same amount whatever the frame rate', () => {
    const slow = orbitAt();
    const fast = orbitAt();
    slow.rotate(-600, 0);
    fast.rotate(-600, 0);

    slow.update(1 / 30);
    fast.update(FRAME_SECONDS);
    fast.update(FRAME_SECONDS);

    expect(slow.viewpoint().azimuthRad).toBeCloseTo(fast.viewpoint().azimuthRad, 12);
  });

  it('does not move on a frame of no length', () => {
    const mode = orbitAt();
    mode.rotate(-600, 0);
    const before = mode.viewpoint().azimuthRad;

    expect(mode.update(0)).toBe(true);
    expect(mode.viewpoint().azimuthRad).toBe(before);
  });

  it('holds the distance inside the limits the building size sets', () => {
    const mode = orbitAt();
    const limits = orbitDistanceLimits(EXTENT);

    for (let notch = 0; notch < 60; notch += 1) {
      mode.dolly(1);
      mode.update(FRAME_SECONDS);
      expect(mode.viewpoint().distanceM).toBeLessThanOrEqual(limits.maxM + 1e-9);
    }
    mode.settle();
    expect(mode.viewpoint().distanceM).toBeCloseTo(limits.maxM, 9);

    for (let notch = 0; notch < 120; notch += 1) {
      mode.dolly(-1);
      mode.update(FRAME_SECONDS);
      expect(mode.viewpoint().distanceM).toBeGreaterThanOrEqual(limits.minM - 1e-9);
    }
    mode.settle();
    expect(mode.viewpoint().distanceM).toBeCloseTo(limits.minM, 9);
  });

  it('gives a bigger building a bigger range to move in', () => {
    const small = orbitDistanceLimits(EXTENT);
    const large = orbitDistanceLimits(BIG_EXTENT);

    expect(large.maxM).toBeGreaterThan(small.maxM);
    expect(large.maxM / large.minM).toBeGreaterThan(small.maxM / small.minM);
  });

  it('never lets a starting viewpoint in outside the limits', () => {
    const limits = orbitDistanceLimits(EXTENT);
    const tooFar = orbitAt(sampleViewpoint({ distanceM: 10_000 }));
    const tooNear = orbitAt(sampleViewpoint({ distanceM: 0.001 }));
    const tooFlat = orbitAt(sampleViewpoint({ polarRad: toRad(120) }));

    expect(tooFar.viewpoint().distanceM).toBeCloseTo(limits.maxM, 9);
    expect(tooNear.viewpoint().distanceM).toBeCloseTo(limits.minM, 9);
    expect(toDeg(tooFlat.viewpoint().polarRad)).toBeCloseTo(CAMERA_SETTINGS.orbit.maxPolarDeg, 9);
  });

  it('slides the point it looks at without changing how far away it is', () => {
    const mode = orbitAt();
    const before = mode.viewpoint();

    mode.pan(120, -80, 900);
    mode.settle();
    const after = mode.viewpoint();

    expect(after.target.distanceTo(before.target)).toBeGreaterThan(0.1);
    expect(after.distanceM).toBeCloseTo(before.distanceM, 12);
    expect(after.polarRad).toBeCloseTo(before.polarRad, 12);
  });

  it('ignores a drag over a viewport with no height', () => {
    const mode = orbitAt();
    const before = mode.viewpoint().target.clone();

    mode.pan(120, -80, 0);
    mode.settle();

    expect(mode.viewpoint().target.distanceTo(before)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Top: straight down, orthographic, no tilt.                                  */
/* -------------------------------------------------------------------------- */

describe('the top mode', () => {
  it('looks straight down at the point it is aimed at', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const pose = mode.pose();

    expect(pose.eye.x).toBeCloseTo(pose.target.x, 12);
    expect(pose.eye.z).toBeCloseTo(pose.target.z, 12);
    expect(pose.eye.y).toBeGreaterThan(EXTENT.centre.y + EXTENT.sizeM.y / 2);
    expect(mode.viewpoint().polarRad).toBe(degreesToRadians(degrees(CAMERA_SETTINGS.top.polarDeg)));
  });

  it('is orthographic, and says how much of the plan it is showing', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);

    expect(mode.pose().orthographicHalfHeightM).toBeCloseTo(mode.halfHeightM, 12);
    expect(mode.halfHeightM).toBeGreaterThan(0);
  });

  it('stands its up vector on the plan, since world up is useless overhead', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const up = mode.pose().up;

    expect(up.y).toBeCloseTo(0, 12);
    expect(up.length()).toBeCloseTo(1, 12);
  });

  it('cannot be tilted or turned by any input it has', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const before = mode.viewpoint();

    mode.pan(300, -200, 900);
    mode.zoom(-4);
    run(mode, 2);

    expect(mode.viewpoint().polarRad).toBe(before.polarRad);
    expect(mode.viewpoint().azimuthRad).toBe(before.azimuthRad);
  });

  it('slides across the storey without leaving it', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const before = mode.viewpoint().target.clone();

    mode.pan(240, 160, 900);
    mode.settle();
    const after = mode.viewpoint().target;

    expect(after.y).toBeCloseTo(before.y, 12);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.1);
  });

  it('holds the zoom inside the limits the building size sets', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const limits = topHalfHeightLimits(EXTENT);

    for (let notch = 0; notch < 80; notch += 1) {
      mode.zoom(1);
      mode.update(FRAME_SECONDS);
      expect(mode.halfHeightM).toBeLessThanOrEqual(limits.maxM + 1e-9);
    }
    mode.settle();
    expect(mode.halfHeightM).toBeCloseTo(limits.maxM, 9);

    for (let notch = 0; notch < 160; notch += 1) {
      mode.zoom(-1);
      mode.update(FRAME_SECONDS);
      expect(mode.halfHeightM).toBeGreaterThanOrEqual(limits.minM - 1e-9);
    }
    mode.settle();
    expect(mode.halfHeightM).toBeCloseTo(limits.minM, 9);
  });

  it('gives a bigger building a wider view to zoom out to', () => {
    expect(topHalfHeightLimits(BIG_EXTENT).maxM).toBeGreaterThan(topHalfHeightLimits(EXTENT).maxM);
  });
});

/* -------------------------------------------------------------------------- */
/* Walk: 1,6 m off the floor, at 1,4 m/s.                                      */
/* -------------------------------------------------------------------------- */

/** A walker standing at the origin, facing −z, looking level. */
function walkerAtOrigin(): WalkCameraMode {
  return new WalkCameraMode(
    {
      target: new Vector3(0, CAMERA_SETTINGS.walk.eyeHeightM, -3),
      azimuthRad: 0,
      polarRad: toRad(90),
      distanceM: 3,
    },
    CONTEXT,
  );
}

describe('the walk mode', () => {
  it('stands 1,6 m above the floor', () => {
    const mode = walkerAtOrigin();

    expect(mode.floorM).toBeCloseTo(extentFloorM(EXTENT), 12);
    expect(mode.pose().eye.y).toBeCloseTo(
      extentFloorM(EXTENT) + CAMERA_SETTINGS.walk.eyeHeightM,
      12,
    );
  });

  it('takes the floor it is given over the one the extent implies', () => {
    const upstairs = new WalkCameraMode(sampleViewpoint(), {
      extent: EXTENT,
      floorElevationM: STOREY_HEIGHT_M,
    });

    expect(upstairs.pose().eye.y).toBeCloseTo(
      STOREY_HEIGHT_M + CAMERA_SETTINGS.walk.eyeHeightM,
      12,
    );
  });

  it('keeps that height through two minutes of walking', () => {
    const mode = walkerAtOrigin();
    const eyeY = extentFloorM(EXTENT) + CAMERA_SETTINGS.walk.eyeHeightM;
    mode.press('KeyW');
    mode.press('KeyD');

    run(mode, 120, () => {
      expect(mode.pose().eye.y).toBeCloseTo(eyeY, 12);
    });
  });

  it('covers 1,4 m in one second of holding W', () => {
    const mode = walkerAtOrigin();
    const before = mode.pose().eye.clone();

    mode.press('KeyW');
    run(mode, 1);

    expect(mode.pose().eye.distanceTo(before)).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('covers the same distance in one long frame as in sixty short ones', () => {
    const stepped = walkerAtOrigin();
    const single = walkerAtOrigin();
    stepped.press('KeyW');
    single.press('KeyW');

    run(stepped, 1);
    single.update(1);

    expect(stepped.pose().eye.distanceTo(single.pose().eye)).toBeCloseTo(0, 9);
  });

  it('runs while Shift is held, and walks again the moment it is let go', () => {
    const mode = walkerAtOrigin();
    mode.press('KeyW');
    mode.press('ShiftLeft');

    expect(mode.running).toBe(true);
    expect(mode.speedMps).toBe(CAMERA_SETTINGS.walk.runSpeedMps);

    const before = mode.pose().eye.clone();
    run(mode, 1);
    expect(mode.pose().eye.distanceTo(before)).toBeCloseTo(CAMERA_SETTINGS.walk.runSpeedMps, 9);

    mode.release('ShiftLeft');
    const running = mode.pose().eye.clone();
    run(mode, 1);
    expect(mode.pose().eye.distanceTo(running)).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('walks forward, back, left and right in the directions those words mean', () => {
    const forward = walkerAtOrigin();
    forward.press('KeyW');
    forward.update(1);
    // Heading zero faces −z, which is where an untouched three camera points.
    expect(forward.pose().eye.z).toBeCloseTo(-CAMERA_SETTINGS.walk.walkSpeedMps, 9);
    expect(forward.pose().eye.x).toBeCloseTo(0, 9);

    const back = walkerAtOrigin();
    back.press('KeyS');
    back.update(1);
    expect(back.pose().eye.z).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);

    const right = walkerAtOrigin();
    right.press('KeyD');
    right.update(1);
    expect(right.pose().eye.x).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);
    expect(right.pose().eye.z).toBeCloseTo(0, 9);

    const left = walkerAtOrigin();
    left.press('KeyA');
    left.update(1);
    expect(left.pose().eye.x).toBeCloseTo(-CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('accepts the arrow keys as well as the letters', () => {
    const arrows = walkerAtOrigin();
    arrows.press('ArrowUp');
    arrows.update(1);

    expect(arrows.pose().eye.z).toBeCloseTo(-CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('is no faster diagonally', () => {
    const mode = walkerAtOrigin();
    const before = mode.pose().eye.clone();

    mode.press('KeyW');
    mode.press('KeyD');
    mode.update(1);

    expect(mode.pose().eye.distanceTo(before)).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('stands still when opposite keys are held together', () => {
    const mode = walkerAtOrigin();
    const before = mode.pose().eye.clone();

    mode.press('KeyW');
    mode.press('KeyS');

    expect(mode.update(1)).toBe(false);
    expect(mode.pose().eye.distanceTo(before)).toBe(0);
  });

  it('stops when the window takes every key away mid-stride', () => {
    const mode = walkerAtOrigin();
    mode.press('KeyW');
    mode.update(FRAME_SECONDS);

    mode.releaseAll();
    const stopped = mode.pose().eye.clone();
    run(mode, 1);

    expect(mode.pose().eye.distanceTo(stopped)).toBe(0);
    expect(mode.running).toBe(false);
  });

  it('walks where it is looking after it turns', () => {
    // A quarter turn to the right — pointer travel is a full turn over
    // `lookPixelsPerTurn` — leaves the walker facing +x, and W follows.
    const right = walkerAtOrigin();
    right.look(CAMERA_SETTINGS.walk.lookPixelsPerTurn / 4, 0);
    right.press('KeyW');
    right.update(1);

    expect(right.pose().eye.x).toBeCloseTo(CAMERA_SETTINGS.walk.walkSpeedMps, 9);
    expect(right.pose().eye.z).toBeCloseTo(0, 9);

    const left = walkerAtOrigin();
    left.look(-CAMERA_SETTINGS.walk.lookPixelsPerTurn / 4, 0);
    left.press('KeyW');
    left.update(1);

    expect(left.pose().eye.x).toBeCloseTo(-CAMERA_SETTINGS.walk.walkSpeedMps, 9);
  });

  it('never tilts past 85° up or down', () => {
    const down = walkerAtOrigin();
    down.look(0, 100_000);
    expect(toDeg(down.pitch)).toBeCloseTo(-CAMERA_SETTINGS.walk.maxPitchDeg, 9);

    const up = walkerAtOrigin();
    up.look(0, -100_000);
    expect(toDeg(up.pitch)).toBeCloseTo(CAMERA_SETTINGS.walk.maxPitchDeg, 9);
  });

  it('does not move the walker when they only look around', () => {
    const mode = walkerAtOrigin();
    const before = mode.pose().eye.clone();

    mode.look(400, -250);
    run(mode, 1);

    expect(mode.pose().eye.distanceTo(before)).toBe(0);
  });

  it('keeps the point it looks at the same distance ahead as it walks', () => {
    const mode = walkerAtOrigin();
    mode.press('KeyW');
    run(mode, 2);

    const pose = mode.pose();
    expect(pose.eye.distanceTo(pose.target)).toBeCloseTo(3, 9);
  });
});

/* -------------------------------------------------------------------------- */
/* Switching: the point being looked at does not move.                         */
/* -------------------------------------------------------------------------- */

describe('switching mode', () => {
  it('keeps whatever viewpoint it was built from', () => {
    for (const mode of ALL_MODES) {
      const built = createCameraMode(mode, sampleViewpoint(), CONTEXT);

      expect(built.mode).toBe(mode);
      expect(built.viewpoint().target.distanceTo(EXTENT.centre)).toBeLessThan(SWITCH_TOLERANCE_M);
    }
  });

  for (const from of ALL_MODES) {
    for (const to of ALL_MODES) {
      it(`from ${from} to ${to} does not move the point being looked at`, () => {
        const start = createCameraMode(from, sampleViewpoint(), CONTEXT);
        const before = start.viewpoint();

        const next = switchCameraMode(start, to, CONTEXT);
        const after = next.viewpoint();

        expect(next.mode).toBe(to);
        expect(after.target.distanceTo(before.target)).toBeLessThan(SWITCH_TOLERANCE_M);
      });
    }
  }

  it('carries the heading across, so the building does not spin', () => {
    for (const to of ALL_MODES) {
      const start = createCameraMode('orbit', sampleViewpoint(), CONTEXT);
      const next = switchCameraMode(start, to, CONTEXT);

      expect(next.viewpoint().azimuthRad).toBeCloseTo(start.viewpoint().azimuthRad, 9);
    }
  });

  it('hands back the same controller when the mode has not changed', () => {
    const start = createCameraMode('orbit', sampleViewpoint(), CONTEXT);

    expect(switchCameraMode(start, 'orbit', CONTEXT)).toBe(start);
  });

  it('survives a round trip through all three modes', () => {
    const opening = initialViewpoint(EXTENT);
    const start = createCameraMode('orbit', opening, CONTEXT);
    const anchor = start.viewpoint().target.clone();

    let current = start;
    for (const mode of ['top', 'walk', 'orbit', 'walk', 'top', 'orbit'] as const) {
      current = switchCameraMode(current, mode, CONTEXT);
      expect(current.viewpoint().target.distanceTo(anchor)).toBeLessThan(SWITCH_TOLERANCE_M);
    }
  });

  it('hands over the viewpoint on screen, not the one being damped towards', () => {
    const orbit = orbitAt();
    orbit.pan(200, 120, 900);
    orbit.update(FRAME_SECONDS);

    const onScreen = orbit.viewpoint().target.clone();
    const walk = switchCameraMode(orbit, 'walk', CONTEXT);

    expect(walk.viewpoint().target.distanceTo(onScreen)).toBeLessThan(SWITCH_TOLERANCE_M);
  });

  it('puts the walker down on the spot the plan view was looking at', () => {
    const top = new TopCameraMode(
      { target: new Vector3(12, 0, 5), azimuthRad: toRad(30), polarRad: 0, distanceM: 24 },
      CONTEXT,
    );
    const anchor = top.viewpoint().target.clone();

    const walk = switchCameraMode(top, 'walk', CONTEXT);

    expect(walk.viewpoint().target.distanceTo(anchor)).toBeLessThan(SWITCH_TOLERANCE_M);
    expect(walk.pose().eye.y).toBeCloseTo(
      extentFloorM(EXTENT) + CAMERA_SETTINGS.walk.eyeHeightM,
      12,
    );
    // The only way to still see a point directly below is to look down steeply.
    expect(toDeg((walk as WalkCameraMode).pitch)).toBeCloseTo(
      -CAMERA_SETTINGS.walk.maxPitchDeg,
      6,
    );
  });

  it('lifts off the ground into a legal orbit angle without losing the wall', () => {
    const walk = walkerAtOrigin();
    walk.press('KeyW');
    run(walk, 2);
    const anchor = walk.viewpoint().target.clone();

    const orbit = switchCameraMode(walk, 'orbit', CONTEXT);
    const after = orbit.viewpoint();

    expect(after.target.distanceTo(anchor)).toBeLessThan(SWITCH_TOLERANCE_M);
    expect(toDeg(after.polarRad)).toBeGreaterThanOrEqual(CAMERA_SETTINGS.orbit.minPolarDeg);
    expect(toDeg(after.polarRad)).toBeLessThanOrEqual(CAMERA_SETTINGS.orbit.maxPolarDeg);
  });

  it('keeps the point even when the walker has left the building', () => {
    const walk = walkerAtOrigin();
    walk.press('KeyW');
    run(walk, 60);
    const anchor = walk.viewpoint().target.clone();

    expect(anchor.distanceTo(EXTENT.centre)).toBeGreaterThan(boundingRadiusM(EXTENT));

    for (const mode of ALL_MODES) {
      const next = switchCameraMode(walk, mode, CONTEXT);
      expect(next.viewpoint().target.distanceTo(anchor)).toBeLessThan(SWITCH_TOLERANCE_M);
    }
  });

  it('comes back to the same framing after a trip through the plan view', () => {
    const orbit = orbitAt(sampleViewpoint({ distanceM: 24 }));
    const back = switchCameraMode(switchCameraMode(orbit, 'top', CONTEXT), 'orbit', CONTEXT);

    expect(back.viewpoint().distanceM).toBeCloseTo(24, 6);
  });

  it('agrees with itself about where the eye is', () => {
    for (const mode of ALL_MODES) {
      const built = createCameraMode(mode, sampleViewpoint(), CONTEXT);
      const eye = viewpointEye(built.viewpoint());

      // The top view is the exception, and says so: its projection has no eye
      // distance, so the framing distance stands in for one.
      if (mode !== 'top') {
        expect(eye.distanceTo(built.pose().eye)).toBeLessThan(1e-9);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Writing onto a three camera.                                                */
/* -------------------------------------------------------------------------- */

describe('applyTo', () => {
  it('puts a perspective camera where the pose says, with the settings lens', () => {
    const mode = orbitAt();
    const camera = new PerspectiveCamera();

    mode.applyTo(camera, 16 / 9);

    expect(camera.position.distanceTo(mode.pose().eye)).toBeLessThan(1e-9);
    expect(camera.fov).toBe(CAMERA_SETTINGS.shared.fieldOfViewDeg);
    expect(camera.aspect).toBeCloseTo(16 / 9, 12);
    expect(camera.near).toBe(CAMERA_SETTINGS.shared.nearM);
    expect(camera.far).toBeGreaterThanOrEqual(CAMERA_SETTINGS.shared.minFarM);
  });

  it('sizes an orthographic frustum from the half-height and the aspect', () => {
    const mode = new TopCameraMode(sampleViewpoint(), CONTEXT);
    const camera = new OrthographicCamera();

    mode.applyTo(camera, 2);

    expect(camera.top).toBeCloseTo(mode.halfHeightM, 12);
    expect(camera.bottom).toBeCloseTo(-mode.halfHeightM, 12);
    expect(camera.right).toBeCloseTo(mode.halfHeightM * 2, 12);
    expect(camera.left).toBeCloseTo(-mode.halfHeightM * 2, 12);
  });

  it('falls back to a square viewport rather than dividing by a collapsed one', () => {
    const mode = orbitAt();
    const camera = new PerspectiveCamera();

    mode.applyTo(camera, 0);

    expect(camera.aspect).toBe(1);
  });

  it('stands the walk camera at eye height', () => {
    const mode = walkerAtOrigin();
    const camera = new PerspectiveCamera();

    mode.applyTo(camera, 16 / 9);

    expect(camera.position.y).toBeCloseTo(
      extentFloorM(EXTENT) + CAMERA_SETTINGS.walk.eyeHeightM,
      12,
    );
  });
});
