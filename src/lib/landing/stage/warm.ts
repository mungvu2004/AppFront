/**
 * Stage warm-up: no first-use stall when the user scrolls into S05.
 *
 * Measured on Intel UHD: entering the wall rise compiled ~20 programs and
 * uploaded ~400 geometries on the spot (seeks of 0.4–0.8 s, stalls up to
 * 2.2 s). `compileAsync` walks every material, visible or not, with the real
 * lights and — given the target the frame will draw into (the composer's
 * linear buffer, not the sRGB screen) — the same program keys; parallel
 * compile keeps it off the main thread. It skips the shadow pass and geometry
 * upload, so one unculled draw of everything follows, into the buffer the next
 * frame overwrites anyway. The caller re-applies its last state afterwards
 * (that draw turns every part visible).
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
  parts: readonly Object3D[],
  stopped: () => boolean,
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
  for (const texture of textures) {
    renderer.initTexture(texture);
  }
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target());
  const compiling = renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(previous);
  await compiling;
  if (stopped()) {
    return false;
  }
  for (const part of parts) {
    part.visible = true;
  }
  const culled: Object3D[] = [];
  scene.traverse((node) => {
    if (node.frustumCulled) {
      node.frustumCulled = false;
      culled.push(node);
    }
  });
  renderer.setRenderTarget(target());
  renderer.render(scene, camera);
  renderer.setRenderTarget(previous);
  for (const node of culled) {
    node.frustumCulled = true;
  }
  return true;
}

/**
 * Compile the scene once per tier (`tiers` set each tier's renderer state), to the screen. Programs are
 * created with the renderer's state at call time: set each tier, start, restore at once (`restore`),
 * so a frame drawn while the driver links never shows a borrowed look. Nothing is drawn.
 */
export async function compileTiers(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  tiers: readonly (() => void)[],
  restore: () => void,
): Promise<void> {
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(null);
  const compiling = tiers.map((useTier) => {
    useTier();
    return renderer.compileAsync(scene, camera);
  });
  renderer.setRenderTarget(previous);
  restore();
  await Promise.allSettled(compiling);
}
