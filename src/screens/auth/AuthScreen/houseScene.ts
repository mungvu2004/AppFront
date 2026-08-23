/**
 * The model on the sign-in panel: `houseModel.json`, handed to the presentation engine.
 *
 * This file used to hold the whole scene — materials, furniture, camera, loop.
 * All of that now lives in `src/lib/three/present`, where any plan can use it,
 * and what is left here is the one decision that belongs to this screen: which
 * plan to show, and where its models would come from if it named any.
 *
 * `houseModel.json` is a fixed drawing — walls as centrelines in millimetres,
 * openings placed along them, rooms as outlines, one storey, a furniture list.
 * The engine feeds it through `buildFloorMesh` from `src/lib/three/build`, the
 * same function the viewer uses, so the apartment on this screen is not an
 * illustration of the product — it is the product, run once on a small plan.
 *
 * ## Why the plan is a file here and not `SAMPLE_BUILDING`
 *
 * The fixture in `src/domain/spatial/__fixtures__` cannot draw a house: all
 * forty-eight of its walls run `(index·1000, 0) → ((index+1)·1000, 0)`, laid end
 * to end on a single straight line, and its fourteen rooms are identical
 * rectangles in one row. It exists to satisfy invariant A14 — forty-eight walls,
 * fourteen rooms, 248,60 m² — and every test that reads it counts or sums.
 * Rendering it draws a fifty-metre ruler.
 *
 * Kept as its own module, imported at effect time by `ValuePanel`, so three.js
 * and the engine arrive in their own chunk after the form has painted.
 */

import {
  createAssetService,
  mountPresentation,
  type PresentationHandle,
  type PresentationPlan,
} from '@/lib/three/present';

import plan from './houseModel.json';

/** What the caller keeps so it can give the GPU memory back. */
export type HouseSceneHandle = Pick<PresentationHandle, 'dispose'>;

/**
 * Where the Draco decoder is served from. `scripts/copy-draco.mjs` puts three's
 * own copy under `public/draco/`; a plan entry with a Draco-compressed `.glb`
 * needs it, and without it that entry simply keeps its procedural piece.
 */
const DRACO_DECODER_PATH = '/draco/';

/**
 * Builds the scene, starts the sway, and hands back the way to stop it.
 *
 * @param canvas The element to draw into. It is measured, not resized by this.
 *
 * @example
 * const handle = mountHouseScene(canvasRef.current);
 * return () => { handle.dispose(); };
 */
export function mountHouseScene(canvas: HTMLCanvasElement): HouseSceneHandle {
  const assets = createAssetService({ dracoDecoderPath: DRACO_DECODER_PATH });
  const handle = mountPresentation(canvas, plan as PresentationPlan, { assets });

  return {
    dispose: () => {
      handle.dispose();
      assets.dispose();
    },
  };
}
