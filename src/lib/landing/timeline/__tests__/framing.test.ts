/** @vitest-environment node */
/**
 * Composition: at every held shot that shows a label, the label's anchor lands
 * in the free part of the frame (right of the copy column on landscape, below
 * the copy band on portrait), so the type and its scrim never cover it.
 * Anchors mirror stage/anchors.ts: room centres 1.2 m up, the stair's middle
 * riser, D5 at mid height, the review gap on the floor. A label out of frame
 * is hidden by the screen, so only on-screen ones count.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { cameraAt, stateAt, WAYPOINTS } from '..';
import { freeRegion } from '../framing';

const ANCHORS: Record<string, readonly [number, number, number, boolean]> = {
  'room:R1': [2.5, 1.2, 2.5, false],
  'room:R2': [8.5, 1.2, 2.5, false],
  'room:R3': [2.5, 1.2, 7, false],
  'room:R6': [10, 1.2, 7, false],
  'room:R7': [4.1, 4.2, 2.4, true],
  'room:R8': [4, 4.2, 7, true],
  stair: [0.61, 1.5, 2.48, false],
  'check:C7': [0.61, 1.5, 2.48, false],
  'check:C4': [6.5, 1.05, 6.5, false],
  gap: [9.8, 0, 5, false],
};

function ndc(p: number, aspect: number, id: string): Vector3 {
  const c = cameraAt(p, aspect);
  const cam = new PerspectiveCamera(c.fovDeg, aspect, 0.05, 500);
  cam.position.set(...c.position);
  cam.lookAt(...c.target);
  cam.updateMatrixWorld();
  const [x, y, z, upper] = ANCHORS[id] ?? [0, 0, 0, false];
  return new Vector3(x, y + (upper ? stateAt(p).build.upperLiftM : 0), z).project(cam);
}

describe('label composition', () => {
  it.each([16 / 10, 4 / 3, 3 / 4])('puts held labels in the free region at aspect %d', (aspect) => {
    const [x0, x1, y0, y1] = freeRegion(aspect);
    const bad: string[] = [];
    for (const w of WAYPOINTS.filter((x) => x.hold === true)) {
      const labels = stateAt(w.p).labels;
      for (const id of Object.keys(ANCHORS).filter((k) => (labels[k] ?? 0) > 0.5)) {
        const q = ndc(w.p, aspect, id);
        const onScreen = q.z < 1 && Math.abs(q.x) < 1 && Math.abs(q.y) < 1;
        if (onScreen && (q.x < x0 - 0.04 || q.x > x1 || q.y < y0 || q.y > y1)) {
          bad.push(`${w.name} ${id} (${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
