/// <reference types="vite/client" />

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
 * ## Why the plan is fetched and not imported
 *
 * The drawing is content, the way a `.glb` is: twenty kilobytes of walls and
 * chairs that belong to this screen's scenery, not to the code that draws it.
 * Imported, it would sit in the route chunk the size gate pays for; fetched
 * (`?url` makes Vite serve the file as an asset), it arrives beside the
 * models, late and cacheable, through the engine's own `loadPlan`. The test
 * next door still reads the file directly — it is the same file.
 *
 * Kept as its own module, imported at effect time by `ValuePanel`, so three.js
 * and the engine arrive in their own chunk after the form has painted.
 */

import {
  createAssetService,
  createGeometryCache,
  DEFAULT_LIGHT_BUDGET,
  loadPlan,
  mountPresentation,
  planCacheKey,
  type PresentationHandle,
} from '@/lib/three/present';

import planUrl from './houseModel.json?url';

/** What the caller keeps so it can give the GPU memory back. */
export interface HouseSceneHandle extends Pick<PresentationHandle, 'dispose'> {
  /** Settles once the plan has arrived and the scene is on the canvas; rejects if it never will be. */
  readonly ready: Promise<void>;
}

/**
 * Where the Draco decoder is served from. `scripts/copy-draco.mjs` puts three's
 * own copy under `public/draco/`; a plan entry with a Draco-compressed `.glb`
 * needs it, and without it that entry simply keeps its procedural piece.
 */
const DRACO_DECODER_PATH = '/draco/';

/**
 * Fetches the plan, builds the scene, starts the sway, and hands back the way to stop it.
 *
 * @param canvas The element to draw into. It is measured, not resized by this.
 *
 * @example
 * const handle = mountHouseScene(canvasRef.current);
 * return () => { handle.dispose(); };
 */
export function mountHouseScene(canvas: HTMLCanvasElement): HouseSceneHandle {
  const aborter = new AbortController();
  const assets = createAssetService({ dracoDecoderPath: DRACO_DECODER_PATH });
  const geometryCache = createGeometryCache();
  let presentation: PresentationHandle | null = null;

  const ready = loadPlan(planUrl, { signal: aborter.signal }).then(async (plan) => {
    // The baked geometry from a previous visit, if this exact plan has one.
    // The cache never rejects — no IndexedDB, a bad entry, a stale fingerprint
    // all come back as a cold build, which is the path that always works.
    const cacheKey = planCacheKey(plan, DEFAULT_LIGHT_BUDGET);
    const cachedGeometry = await geometryCache.load(cacheKey);

    // Disposed while the plan was in flight: nothing to mount, nothing to leak.
    if (!aborter.signal.aborted) {
      presentation = mountPresentation(canvas, plan, { assets, cachedGeometry });

      const { geometry, geometryRestored } = presentation.report;
      if (geometry !== null && !geometryRestored) {
        // Fire and forget: a write that fails is next visit's cold build.
        void geometryCache.store(cacheKey, geometry);
      }
    }
  });

  return {
    ready,
    dispose: () => {
      aborter.abort();
      presentation?.dispose();
      assets.dispose();
    },
  };
}
