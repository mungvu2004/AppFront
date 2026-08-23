/**
 * An environment map for materials to reflect, made on the GPU at mount.
 *
 * Without one, a glossy tile has nothing to be glossy *with*: a standard
 * material's specular term reflects the environment, and an empty environment
 * reflects black. The studio here is a stand-in for a lit room — a grey box
 * with a bright panel in the ceiling and a softer one on each wall — and
 * `PMREMGenerator` filters it into the mip-chain the shader wants. It costs
 * one render at mount and no asset at all, which is the whole reason to use
 * it over an HDRI here.
 *
 * It is built from unlit materials on purpose: a panel that *is* its own
 * light needs no light to be seen, so the studio compiles one cheap shader
 * rather than a lit one, and it is gone again — geometry, materials,
 * programs — the moment the map has been made.
 *
 * This is the one module in `present/` that needs a live renderer, so it is
 * kept to a single function and exercised only in the browser.
 */

import {
  BackSide,
  BoxGeometry,
  Color,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  type Side,
  type WebGLRenderer,
} from 'three';

/** How strongly the environment lights the scene. Below one: the lamps stay the story. */
const ENVIRONMENT_INTENSITY = 0.18;

/** Blur applied when filtering the room, in radians; softens the box's hard edges. */
const ENVIRONMENT_SIGMA = 0.04;

/** The studio's grey walls, as a radiance. */
const STUDIO_WALL_RADIANCE = 0.45;

/**
 * The light panels: where each sits, how big it is, and how bright. A strong
 * one overhead — what a floor sees most of — and four softer ones round the
 * walls, unevenly, so a reflection has a shape rather than a glow.
 */
const STUDIO_PANELS: readonly {
  readonly at: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly radiance: number;
}[] = [
  { at: [0, 20, 0], size: [4, 0.1, 4], radiance: 70 },
  { at: [-16, 14, 8], size: [0.1, 2.5, 2.7], radiance: 50 },
  { at: [-16, 18, -8], size: [0.1, 2.4, 2.8], radiance: 50 },
  { at: [15, 12, -2], size: [0.15, 4.3, 6.3], radiance: 17 },
  { at: [0, 9, 14.5], size: [4.4, 5.4, 0.1], radiance: 43 },
  { at: [3, 11.5, -12.5], size: [2.5, 2, 0.1], radiance: 20 },
];

export interface EnvironmentHandle {
  readonly dispose: () => void;
}

/** An unlit grey, or a panel brighter than white. */
function flat(radiance: number, side: Side = FrontSide): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(radiance, radiance, radiance), side });
}

/** The studio: a box seen from inside, and the panels that light it. */
export function createStudioScene(): Scene {
  const scene = new Scene();
  const box = new BoxGeometry();

  const room = new Mesh(box, flat(STUDIO_WALL_RADIANCE, BackSide));
  room.position.set(-0.8, 13.2, 0.7);
  room.scale.set(31.7, 28.3, 28.6);
  scene.add(room);

  for (const panel of STUDIO_PANELS) {
    const mesh = new Mesh(box, flat(panel.radiance));
    mesh.position.set(...panel.at);
    mesh.scale.set(...panel.size);
    scene.add(mesh);
  }

  return scene;
}

/** Release the studio's one geometry and every material. */
export function disposeStudioScene(scene: Scene): void {
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as MeshBasicMaterial).dispose();
    }
  });
}

/** Give `scene` a studio to reflect. The returned handle takes it away again. */
export function applyRoomEnvironment(renderer: WebGLRenderer, scene: Scene): EnvironmentHandle {
  const generator = new PMREMGenerator(renderer);
  const studio = createStudioScene();
  const target = generator.fromScene(studio, ENVIRONMENT_SIGMA);
  // The studio was rendered once into `target` and is not needed again; its
  // geometry and materials — and the program compiled for them — go now.
  disposeStudioScene(studio);
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
