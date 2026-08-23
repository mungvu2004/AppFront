import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { AMBIENT_LOOP_MS } from '@/lib/motion';

import {
  applyFieldOfView,
  applyFrustum,
  cameraPosition,
  DEFAULT_CAMERA_RIG,
  fitFieldOfView,
  fitFrustum,
  frameAim,
  headingAt,
  resolveRig,
  restingHeading,
  screenForward,
  screenUp,
  swayExtents,
  swayPeriodMs,
} from '../director';

const TURN = Math.PI * 2;

describe('the rig', () => {
  it('fills defaults and keeps overrides', () => {
    expect(resolveRig()).toEqual(DEFAULT_CAMERA_RIG);
    expect(resolveRig({ swayTurn: 0 }).swayTurn).toBe(0);
    expect(resolveRig({ swayTurn: 0 }).margin).toBe(DEFAULT_CAMERA_RIG.margin);
  });

  it('paces the sway in whole ambient beats', () => {
    expect(swayPeriodMs(DEFAULT_CAMERA_RIG)).toBe(AMBIENT_LOOP_MS * DEFAULT_CAMERA_RIG.swayBeats);
  });
});

describe('headingAt', () => {
  const rig = resolveRig({ restingTurn: 0.1, swayTurn: 0.05 });
  const period = swayPeriodMs(rig);

  it('starts and ends a period at rest', () => {
    expect(headingAt(rig, 0)).toBeCloseTo(restingHeading(rig));
    expect(headingAt(rig, period)).toBeCloseTo(restingHeading(rig));
    expect(headingAt(rig, period / 2)).toBeCloseTo(restingHeading(rig));
  });

  it('reaches its full sway a quarter of the way out and back', () => {
    expect(headingAt(rig, period / 4)).toBeCloseTo((0.1 + 0.05) * TURN);
    expect(headingAt(rig, (3 * period) / 4)).toBeCloseTo((0.1 - 0.05) * TURN);
  });

  it('never leaves the band either side of rest, including before time zero', () => {
    for (let t = -period; t <= 2 * period; t += period / 37) {
      const heading = headingAt(rig, t);
      expect(heading).toBeGreaterThanOrEqual((0.1 - 0.05) * TURN - 1e-9);
      expect(heading).toBeLessThanOrEqual((0.1 + 0.05) * TURN + 1e-9);
    }
  });
});

describe('framing', () => {
  const box = new Box3(new Vector3(-6, 0, -4), new Vector3(6, 2.4, 4));
  const centre = box.getCenter(new Vector3());

  it('reaches at least the box at rest and never more than its diagonal', () => {
    const still = swayExtents(box, centre, resolveRig({ restingTurn: 0, swayTurn: 0 }));
    const halfDiagonal = Math.hypot(6, 4);

    expect(still.halfWidth).toBeCloseTo(6);
    expect(still.halfHeight).toBeLessThanOrEqual(halfDiagonal + 1.2);
    expect(still.halfHeight).toBeGreaterThan(4 * Math.sin(DEFAULT_CAMERA_RIG.elevationRad));

    // At 45° a 12 × 8 box reaches 6·cos 45° + 4·sin 45° across the screen.
    const swung = swayExtents(box, centre, resolveRig({ restingTurn: 0.125, swayTurn: 0 }));
    expect(swung.halfWidth).toBeCloseTo((6 + 4) * Math.SQRT1_2, 3);
    expect(swung.halfWidth).toBeGreaterThan(still.halfWidth);
    expect(swung.halfWidth).toBeLessThanOrEqual(halfDiagonal);
  });

  it('grows with the sway, never shrinks', () => {
    const narrow = swayExtents(box, centre, resolveRig({ restingTurn: 0.05, swayTurn: 0.02 }));
    const wide = swayExtents(box, centre, resolveRig({ restingTurn: 0.05, swayTurn: 0.1 }));

    expect(wide.halfWidth).toBeGreaterThanOrEqual(narrow.halfWidth);
    expect(wide.halfHeight).toBeGreaterThanOrEqual(narrow.halfHeight);
  });

  it('fits a wide model to a wide viewport by width and to a tall one by height', () => {
    const rig = resolveRig({ margin: 1 });
    const extents = { halfWidth: 8, halfHeight: 4 };

    const wide = fitFrustum(extents, 4, rig);
    expect(wide.halfWidth).toBeCloseTo(16);
    expect(wide.halfHeight).toBeCloseTo(4);

    const tall = fitFrustum(extents, 1, rig);
    expect(tall.halfWidth).toBeCloseTo(8);
    expect(tall.halfHeight).toBeCloseTo(8);
  });

  it('applies the margin and writes the camera', () => {
    const rig = resolveRig({ margin: 1.1 });
    const camera = new OrthographicCamera();

    applyFrustum(camera, fitFrustum({ halfWidth: 10, halfHeight: 5 }, 2, rig));

    expect(camera.right).toBeCloseTo(11);
    expect(camera.left).toBeCloseTo(-11);
    expect(camera.top).toBeCloseTo(5.5);
    expect(camera.bottom).toBeCloseTo(-5.5);
  });

  it('stands the camera on the rig elevation, looking at the origin', () => {
    const rig = resolveRig({ elevationRad: Math.PI / 4 });
    const position = cameraPosition(rig, 10);

    expect(position.y).toBeCloseTo(position.z);
    expect(position.length()).toBeCloseTo(10);
    expect(screenUp(rig.elevationRad).dot(position.clone().normalize())).toBeCloseTo(0);
    expect(screenForward(rig.elevationRad).dot(position.clone().normalize())).toBeCloseTo(1);
  });
});

describe('framing in perspective', () => {
  const box = new Box3(new Vector3(-6, 0, -4), new Vector3(6, 2.4, 4));
  const centre = box.getCenter(new Vector3());
  const rig = resolveRig({ restingTurn: 0, swayTurn: 0 });
  const distance = 40;

  it('measures the reach as a ratio to depth only when given a camera distance', () => {
    expect(swayExtents(box, centre, rig).tanHalfWidth).toBeUndefined();

    const extents = swayExtents(box, centre, rig, distance);
    // A corner nearer the camera than the centre looms larger than its orthographic reach.
    expect(extents.tanHalfWidth).toBeGreaterThan(extents.halfWidth / distance);
    expect(extents.tanHalfHeight).toBeGreaterThan(extents.halfHeight / distance);
    // ...but not by much at forty metres from a twelve-metre flat.
    expect(extents.tanHalfWidth).toBeLessThan((extents.halfWidth / distance) * 1.25);
  });

  it('aims below the centre, along the screen up axis, so the near half does not crowd the top', () => {
    const aim = frameAim(box, centre, rig, distance);
    const up = screenUp(rig.elevationRad);

    expect(aim.dot(up)).toBeLessThan(0);
    expect(aim.clone().normalize().dot(up)).toBeCloseTo(-1);
    expect(aim.length()).toBeLessThan(2);

    // Aimed there, the reach is tighter than aimed at the centre.
    const centred = swayExtents(box, centre, rig, distance);
    const aimed = swayExtents(box, centre, rig, distance, aim);
    expect(aimed.tanHalfHeight).toBeLessThan(centred.tanHalfHeight!);
  });

  it('fits a field of view by height or by width, whichever binds, with the margin', () => {
    const extents = swayExtents(box, centre, rig, distance);
    const tall = fitFieldOfView(extents, 0.5, rig, distance);
    const wide = fitFieldOfView(extents, 3, rig, distance);
    const byHeight = (2 * Math.atan(extents.tanHalfHeight! * rig.margin) * 180) / Math.PI;

    expect(wide).toBeCloseTo(byHeight);
    expect(tall).toBeGreaterThan(wide);

    // Without perspective ratios the orthographic reach over the distance stands in.
    const flat = fitFieldOfView({ halfWidth: 6, halfHeight: 4 }, 1, rig, distance);
    expect(flat).toBeCloseTo((2 * Math.atan((6 / distance) * rig.margin) * 180) / Math.PI);
  });

  it('writes the field of view and aspect to a perspective camera', () => {
    const camera = new PerspectiveCamera();
    applyFieldOfView(camera, 25, 1.5);

    expect(camera.fov).toBe(25);
    expect(camera.aspect).toBe(1.5);
  });
});
