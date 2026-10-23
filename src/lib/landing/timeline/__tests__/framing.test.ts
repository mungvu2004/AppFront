/** @vitest-environment node */
/**
 * Composition: at every held shot that shows a label, the label's anchor lands
 * in the free part of the frame (right of the copy column on landscape, below
 * the copy band on portrait), so the type and its scrim never cover it.
 * Anchors are the stage's own (stage/anchors.ts, from the villa data), upper
 * ones riding `liftK × upperLiftM`. A label out of frame is hidden by the
 * screen, so only on-screen ones count.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '../../house';
import { houseAnchors } from '../../stage/anchors';
import { cameraAt, stateAt, WAYPOINTS } from '..';
import { freeRegion } from '../framing';

const ANCHORS = houseAnchors(LANDING_HOUSE);

function ndc(p: number, aspect: number, id: string): Vector3 | null {
  const a = ANCHORS.get(id);
  if (a === undefined) return null;
  const c = cameraAt(p, aspect);
  const cam = new PerspectiveCamera(c.fovDeg, aspect, 0.05, 500);
  cam.position.set(...c.position);
  cam.lookAt(...c.target);
  cam.updateMatrixWorld();
  const lift = a.upper ? (a.liftK ?? 1) * stateAt(p).build.upperLiftM : 0;
  return a.point.clone().add(new Vector3(0, lift, 0)).project(cam);
}

describe('label composition', () => {
  it('has a stage anchor for every house label the timeline shows (detections belong to ink)', () => {
    const ids = Object.keys(stateAt(0).labels).filter((id) => !id.startsWith('det:'));
    expect(ids.filter((id) => !ANCHORS.has(id))).toEqual([]);
  });

  it.each([16 / 10, 4 / 3, 3 / 4])('puts held labels in the free region at aspect %d', (aspect) => {
    const [x0, x1, y0, y1] = freeRegion(aspect);
    const bad: string[] = [];
    for (const w of WAYPOINTS.filter((x) => x.hold)) {
      const labels = stateAt(w.p).labels;
      for (const id of Object.keys(labels).filter((k) => (labels[k] ?? 0) > 0.5)) {
        const q = ndc(w.p, aspect, id);
        const onScreen = q !== null && q.z < 1 && Math.abs(q.x) < 1 && Math.abs(q.y) < 1;
        if (q !== null && onScreen && (q.x < x0 - 0.04 || q.x > x1 || q.y < y0 || q.y > y1)) {
          bad.push(`${w.name} ${id} (${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
