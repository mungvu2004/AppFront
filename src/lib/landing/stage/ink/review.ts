/**
 * Scene 04: the user closes the gap the "AI" left in one wall.
 *
 * The closing is a real geometry edit, not a highlight being hidden: four
 * short segments of the blue outline (both faces across the gap, and the two
 * end caps) are rewritten in place as `review.close` slides the right-hand
 * endpoint along the wall. Same buffer every frame — no new geometry. The amber
 * outline and the two handles mark the gap while `review.highlight` is up.
 */

import type { Group } from 'three';

import type { LandingHouse } from '@/lib/landing/types';

import { along, circle, type P2, type WallFrame } from './geometry';
import { gapSpan } from './detect';
import { AMBER, flatStroke, lineMaterial, staticLine, type P3, type RevealLine } from './lines';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export interface Review {
  /** The four in-place segments, drawn with the blue wall material. */
  readonly gap: RevealLine;
  readonly outline: RevealLine;
  readonly handleFixed: RevealLine;
  readonly handleMoving: RevealLine;
  /** Gap centre on the drawing plane — anchor `gap`. */
  readonly centre: P3;
  /** Rewrite the gap segments for `close` ∈ [0, 1]. */
  setClose(close: number): void;
}

const HANDLE_R = 0.07;

export function createReview(house: LandingHouse, w: WallFrame, wallMaterial: LineMaterial, layer: Group): Review {
  const [s0, s1] = gapSpan(house, w);
  const h = w.t / 2;
  // Two face segments and two caps; positions are overwritten by setClose.
  const gap = staticLine(
    'detect:gap',
    [0, 1, 2, 3].map(() => flatStroke([along(w, s1), along(w, s1)])),
    wallMaterial,
  );
  const pad = 0.1;
  const box: P2[] = [
    along(w, s0 - pad, -h - pad),
    along(w, s1 + pad, -h - pad),
    along(w, s1 + pad, h + pad),
    along(w, s0 - pad, h + pad),
  ];
  const outline = staticLine('review:outline', [flatStroke([...box, box[0] as P2], 0.002)], lineMaterial(AMBER, 1.4));
  const handleMaterial = lineMaterial(AMBER, 1.6);
  const handleFixed = staticLine('review:handleA', [flatStroke(circle(along(w, s0), HANDLE_R, 20), 0.003)], handleMaterial);
  // Drawn around the origin and moved by its transform — the handle never changes shape.
  const handleMoving = staticLine('review:handleB', [flatStroke(circle([0, 0], HANDLE_R, 20), 0.003)], handleMaterial);

  const data = gap.geometry.attributes['instanceStart'] as unknown as { data: { array: Float32Array; needsUpdate: boolean } };
  const buffer = data.data;
  // Scalar maths only: this runs every frame and must not allocate.
  const put = (o: number, s: number, off: number): void => {
    buffer.array[o] = w.a[0] + w.dir[0] * s + w.nrm[0] * off;
    buffer.array[o + 1] = 0;
    buffer.array[o + 2] = w.a[1] + w.dir[1] * s + w.nrm[1] * off;
  };
  const write = (index: number, sa: number, oa: number, sb: number, ob: number): void => {
    put(index * 6, sa, oa);
    put(index * 6 + 3, sb, ob);
  };

  const setClose = (close: number): void => {
    const s = s1 - (s1 - s0) * Math.min(1, Math.max(0, close));
    write(0, s, h, s1, h);
    write(1, s, -h, s1, -h);
    // Wall continuous at the end: the caps across the gap collapse to a point.
    const shut = close >= 0.98;
    write(2, s0, h, s0, shut ? h : -h);
    write(3, s, h, s, shut ? h : -h);
    buffer.needsUpdate = true;
    handleMoving.object.position.set(w.a[0] + w.dir[0] * s, 0, w.a[1] + w.dir[1] * s);
  };
  setClose(0);

  layer.add(gap.object, outline.object, handleFixed.object, handleMoving.object);
  const c = along(w, (s0 + s1) / 2);
  return { gap, outline, handleFixed, handleMoving, centre: [c[0], 0, c[1]], setClose };
}
