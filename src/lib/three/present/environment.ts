/**
 * An environment map for materials to reflect, made on the GPU at mount.
 *
 * Without one, a glossy tile has nothing to be glossy *with*: a standard
 * material's specular term reflects the environment, and an empty environment
 * reflects black. `RoomEnvironment` is three's own stand-in for a lit studio —
 * a box with a few area lights — and `PMREMGenerator` filters it into the
 * mip-chain the shader wants. It costs one render at mount and no asset at all,
 * which is the whole reason to use it over an HDRI here.
 *
 * This is the one module in `present/` that needs a live renderer, so it is
 * kept to a single function and exercised only in the browser.
 */

import { PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** How strongly the environment lights the scene. Below one: the lamps stay the story. */
const ENVIRONMENT_INTENSITY = 0.4;

/** Blur applied when filtering the room, in radians; softens the box's hard edges. */
const ENVIRONMENT_SIGMA = 0.04;

export interface EnvironmentHandle {
  readonly dispose: () => void;
}

/** Give `scene` a studio to reflect. The returned handle takes it away again. */
export function applyRoomEnvironment(renderer: WebGLRenderer, scene: Scene): EnvironmentHandle {
  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(new RoomEnvironment(), ENVIRONMENT_SIGMA);
  generator.dispose();

  scene.environment = target.texture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;

  return {
    dispose: () => {
      scene.environment = null;
      target.dispose();
    },
  };
}
