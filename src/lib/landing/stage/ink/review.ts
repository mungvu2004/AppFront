/**
 * Scene 04: the user closes the gap the "AI" left in one wall.
 *
 * The closing is a real geometry edit, not a highlight being hidden: four
 * short segments of the blue outline (both faces across the gap, and the two
 * end caps) are rewritten in place as `review.close` slides the right-hand
 * endpoint along the wall. Same buffer every frame — no new geometry. The amber
 * outline and the two handles mark the gap while `review.highlight` is up.
 */

import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type Camera,
  type PerspectiveCamera,
} from 'three';

import type { LandingHouse } from '@/lib/landing/types';

import { inverseNeutral } from '../tone';

import { along, type P2, type WallFrame } from './geometry';
import { gapSpan } from './detect';
import { AMBER, flatStroke, lineMaterial, PAPER, staticLine, type P3, type RevealLine } from './lines';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export interface Review {
  /** The four in-place segments, drawn with the blue wall material. */
  readonly gap: RevealLine;
  readonly outline: RevealLine;
  /** Translucent amber over what is still open of the gap. */
  readonly fill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly handleFixed: Handle;
  readonly handleMoving: Handle;
  /** Gap centre on the drawing plane — anchor `gap`. */
  readonly centre: P3;
  /** Rewrite the gap segments for `close` ∈ [0, 1]. */
  setClose(close: number): void;
}

/** Handle radii in screen pixels: the moving one is the one to read. */
const FIXED_PX = 10;
const MOVING_PX = 12;
const scratch = new Vector3();

/** A ringed disc on the drawing plane, kept a constant size on screen. */
export interface Handle {
  readonly object: Group;
  setOpacity(opacity: number): void;
  /** Rescale for the camera so the radius stays `px` screen pixels at `heightPx` viewport height. */
  fit(camera: Camera, heightPx: number): void;
}

function handle(name: string, px: number): Handle {
  const ring = new MeshBasicMaterial({ color: new Color(AMBER), transparent: true, opacity: 0, depthWrite: false });
  const core = new MeshBasicMaterial({
    color: inverseNeutral(new Color(PAPER)),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const object = new Group();
  object.name = name;
  const disc = new Mesh(new CircleGeometry(0.62, 28), core);
  const rim = new Mesh(new RingGeometry(0.62, 1, 32), ring);
  for (const mesh of [disc, rim]) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    object.add(mesh);
  }
  object.position.y = 0.003;
  return {
    object,
    setOpacity(opacity) {
      ring.opacity = opacity;
      core.opacity = opacity * 0.95;
      object.visible = opacity > 1e-3;
    },
    fit(camera, heightPx) {
      if (!object.visible) {
        return;
      }
      object.getWorldPosition(scratch);
      const fov = (camera as PerspectiveCamera).fov ?? 35;
      const perPx = (2 * scratch.distanceTo(camera.position) * Math.tan((fov * Math.PI) / 360)) / Math.max(1, heightPx);
      object.scale.setScalar(px * perPx);
    },
  };
}

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
  const outline = staticLine('review:outline', [flatStroke([...box, box[0] as P2], 0.002)], lineMaterial(AMBER, 2.2));
  const handleFixed = handle('review:handleA', FIXED_PX);
  const fixedAt = along(w, s0);
  handleFixed.object.position.set(fixedAt[0], 0.003, fixedAt[1]);
  // Moved by its transform — the handle never changes shape.
  const handleMoving = handle('review:handleB', MOVING_PX);
  // Unit-long quad along the wall, scaled to the open part [s0, s] each frame.
  const fill = new Mesh(
    new PlaneGeometry(1, w.t).translate(0.5, 0, 0),
    new MeshBasicMaterial({ color: new Color(AMBER), transparent: true, opacity: 0, depthWrite: false }),
  );
  fill.name = 'review:fill';
  fill.rotation.set(-Math.PI / 2, 0, -Math.atan2(w.dir[1], w.dir[0]));
  fill.position.set(fixedAt[0], 0.001, fixedAt[1]);

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
    handleMoving.object.position.set(w.a[0] + w.dir[0] * s, 0.003, w.a[1] + w.dir[1] * s);
    fill.scale.x = Math.max(1e-4, s - s0);
  };
  setClose(0);

  layer.add(fill, gap.object, outline.object, handleFixed.object, handleMoving.object);
  const c = along(w, (s0 + s1) / 2);
  return { gap, outline, fill, handleFixed, handleMoving, centre: [c[0], 0, c[1]], setClose };
}
