/**
 * Stage warm-up: no first-use stall when the user scrolls into S05.
 *
 * Measured on Intel UHD: entering the wall rise compiled ~20 programs and
 * uploaded ~400 geometries on the spot (seeks of 0.4–0.8 s, stalls up to
 * 2.2 s). `compileAsync` (over hidden nodes too, see compileSliced) walks every material with the real
 * lights and — given the target the frame will draw into (the composer's
 * linear buffer, not the sRGB screen) — the same program keys; parallel
 * compile keeps it off the main thread. It skips the shadow pass and geometry
 * upload, so unculled draws of every node in slices (hidden ones shown for it, then
 * hidden again) with a shadow-map pass follows, into the buffer the next frame
 * overwrites anyway (FINDINGS §3: forcing only the house growers left ~500
 * uploads and 160+ depth programs for the first S05 frames). The caller
 * re-applies its last state afterwards.
 *
 * Needs a live renderer; exercised in the browser only (untested by design).
 */

import { Texture, type Camera, type Material, type Object3D, type Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/** Returns false when `stopped()` turned true while compiling (nothing drawn). */
export async function warmStage(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  target: () => WebGLRenderTarget | null,
  stopped: () => boolean,
  /** Draws the real frame again, shadow map included: a slice's draw (to the screen off the composer) and its
   * slice-only shadow map must never be what the page presents. Runs in the same task as each slice. */
  redraw: () => void,
): Promise<boolean> {
  const textures = new Set<Texture>();
  scene.traverse((node) => {
    const material = (node as { material?: Material | Material[] }).material;
    for (const m of Array.isArray(material) ? material : material === undefined ? [] : [material]) {
      for (const value of Object.values(m)) {
        if (value instanceof Texture && !value.isRenderTargetTexture) {
          textures.add(value);
        }
      }
    }
  });
  // Uploads and program creation are synchronous (≈ 0.28 + 0.49 s on Intel UHD in one go, PERF-V3): sliced.
  for (const batch of slices([...textures])) {
    for (const texture of batch) renderer.initTexture(texture);
    await nextFrame();
    if (stopped()) {
      return false;
    }
  }
  const previous = renderer.getRenderTarget();
  await compileSliced(renderer, scene, camera, () => renderer.setRenderTarget(target()), () => renderer.setRenderTarget(previous), stopped);
  if (stopped()) {
    return false;
  }
  // One draw of everything blocked the main thread ≈ 3 s on Intel UHD (uploads + shadow pass, PERF-V3):
  // draw it in slices, the scene back as it was between them, so the page keeps its frames meanwhile.
  const drawables: Object3D[] = [];
  scene.traverse((node) => {
    if ((node as Object3D & { isMesh?: boolean }).isMesh === true) drawables.push(node);
  });
  const size = Math.max(1, Math.ceil(drawables.length / WARM_SLICES));
  for (let start = 0; start < drawables.length; start += size) {
    const slice = new Set(drawables.slice(start, start + size));
    const hide = showAll(scene);
    const changed: Object3D[] = [];
    for (const node of drawables) {
      if (!slice.has(node)) {
        if (node.visible) {
          node.visible = false;
          changed.push(node);
        }
      } else if (node.frustumCulled) {
        node.frustumCulled = false;
        changed.push(node);
      }
    }
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(target());
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    for (const node of changed) {
      if (slice.has(node)) node.frustumCulled = true;
      else node.visible = true;
    }
    hide();
    redraw();
    await nextFrame();
    if (stopped()) {
      return false;
    }
  }
  return true;
}

/** Warm-draw slices: ≈ 3 s in one draw → each slice well under the 50 ms frame cap on Intel UHD. */
const WARM_SLICES = 48;

/**
 * Shows every hidden node (traverseVisible would stop at a hidden parent); returns the re-hide. Lights stay
 * as they are: the furniture .glb carries hidden punctual lights, and counting them compiled 8-spot-light
 * variants while every frame draws with none — 39 programs then linked mid-scroll (PERF-V3).
 */
function showAll(scene: Scene): () => void {
  const hidden: Object3D[] = [];
  scene.traverse((node) => {
    if (!node.visible && !(node as Object3D & { isLight?: boolean }).isLight) {
      node.visible = true;
      hidden.push(node);
    }
  });
  return () => {
    for (const node of hidden) node.visible = false;
  };
}

/** One frame's yield (paused while the tab is hidden, as the page is). */
function nextFrame(): Promise<unknown> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Main-thread time a warm-up step takes before it yields a frame. */
const STEP_MS = 12;

/** Texture uploads per frame: 168 maps took ≈ 0.28 s in one go on Intel UHD, so ≈ 7 ms per four. */
const UPLOADS_PER_STEP = 4;

function* slices<T>(items: readonly T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += UPLOADS_PER_STEP) yield items.slice(i, i + UPLOADS_PER_STEP);
}

/**
 * `compileAsync` of every drawable, hidden ones too (three's `compile` walks `traverseVisible`, so the house
 * growers hidden at p = 0 used to link synchronously in the warm draw — a 17 s stall on Intel UHD, PERF-V3),
 * one object at a time against the scene's lights, yielding a frame every STEP_MS: creating ~150 programs in
 * one call blocked the main thread ≈ 0.5 s. `before`/`after` set and restore the renderer state around each
 * step, so a frame drawn in between never shows a borrowed look. Lights are left alone (see showAll).
 */
async function compileSliced(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  before: () => void,
  after: () => void,
  stopped: () => boolean = () => false,
): Promise<void> {
  const drawables: Object3D[] = [];
  scene.traverse((node) => {
    if ((node as { material?: unknown }).material !== undefined) drawables.push(node);
  });
  const pending: Promise<unknown>[] = [];
  let i = 0;
  while (i < drawables.length) {
    before();
    const t0 = performance.now();
    while (i < drawables.length && performance.now() - t0 < STEP_MS) {
      const node = drawables[i] as Object3D;
      i += 1;
      const was = node.visible;
      node.visible = true;
      pending.push(renderer.compileAsync(node, camera, scene));
      node.visible = was;
    }
    after();
    await nextFrame();
    if (stopped()) {
      return;
    }
  }
  await Promise.allSettled(pending);
}

/**
 * Compile the scene once per tier (`tiers` set each tier's renderer state), to the screen, sliced like the
 * warm-up. Programs are created with the renderer's state at call time: each step sets the tier and
 * restores (`restore`) before yielding. Nothing is drawn.
 */
export async function compileTiers(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  tiers: readonly (() => void)[],
  restore: () => void,
): Promise<void> {
  const previous = renderer.getRenderTarget();
  for (const useTier of tiers) {
    await compileSliced(
      renderer,
      scene,
      camera,
      () => {
        useTier();
        renderer.setRenderTarget(null);
      },
      () => {
        renderer.setRenderTarget(previous);
        restore();
      },
    );
  }
}
