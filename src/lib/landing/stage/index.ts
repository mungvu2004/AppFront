/**
 * The landing stage: an imperative three.js scene that draws one `LandingState`.
 *
 * The screen owns time and scroll; this owns pixels. `apply(state)` writes
 * the camera, uniforms, visibility and the upper storey's lift and marks the
 * frame dirty — it allocates nothing and builds nothing. `render()` draws only
 * when something changed, so a parked page costs no GPU. Everything heavy is
 * made in `createStage` (house, clones, post chain) or arrives late and once
 * (HDRI, photographic textures).
 *
 * The WebGL parts live in `renderer.ts` / `post.ts` and are untested by design
 * (node has no GL); the logic they call — growth patch, house indexing,
 * anchors, quality governor — is tested on its own.
 */

import { MathUtils, Vector3 } from 'three';

import { buildStair } from '@/lib/landing/house';
import { disposeMaterials, readPalette, type ScenePalette } from '@/lib/three/present';

import { LANDING_PALETTE } from '../palette';
import type { LandingHouse, LandingState } from '../types';

import { houseAnchors, projectPoint, type StageAnchor } from './anchors';
import { applyBuild, buildStageHouse, disposeStageHouse } from './house';
import { createInk } from './ink';
import { createPost, type PostChain } from './post';
import { QUALITY, type Quality } from './quality';
import { createStageRenderer } from './renderer';
import { applyPbr, type PbrHandle } from './textures';

export { NoWebGL2Error } from './renderer';
export { createFrameGovernor, QUALITY, type FrameGovernor, type Quality } from './quality';

export interface Stage {
  apply(s: LandingState): void;
  render(): void;
  resize(w: number, h: number, dpr: number): void;
  project(anchorId: string): { x: number; y: number; visible: boolean } | null;
  anchors(): string[];
  setQuality(q: Quality): void;
  onContextLost(cb: () => void): void;
  dispose(): void;
}

/**
 * The landing's art direction over present's roles (R3–R5): a gallery model,
 * not the app's themed viewer. Warm off-white plaster, a light mineral
 * render outside, a soft graphite cut (not the page's text black), natural
 * oak, linen and graphite metal, and one muted sage as the only accent —
 * present's ochre cushion and orange woods read as toys.
 */
export const LANDING_LOOK: Readonly<Partial<Record<keyof ScenePalette, string>>> = {
  backdrop: LANDING_PALETTE.paper,
  plaster: '#EFECE6',
  exterior: '#DEDDD8',
  cut: '#7D7972',
  wood: '#B9A891',
  woodDark: '#6B5D50',
  fabric: '#E6E0D5',
  textile: '#CBC3B5',
  ochre: '#97A391',
  stone: '#DAD6CE',
  metal: '#3A3D42',
  clay: '#B9A28C',
  foliage: '#6E7D5C',
  screen: '#2A2D31',
};

/** present's palette roles, with the landing's look in place of the page's tokens. */
export function landingScenePalette(base: ScenePalette = readPalette(() => '')): ScenePalette {
  const out: Record<string, ScenePalette[keyof ScenePalette]> = { ...base };
  for (const [role, hex] of Object.entries(LANDING_LOOK)) {
    out[role] = base.backdrop.clone().set(hex);
  }
  return out as ScenePalette;
}

export async function createStage(
  canvas: HTMLCanvasElement,
  house: LandingHouse,
  opts: { quality: Quality },
): Promise<Stage> {
  const gl = createStageRenderer(canvas);
  const { renderer, scene, camera } = gl;
  const stage = buildStageHouse(
    house,
    (materials) => buildStair(house.stair, materials.wood),
    landingScenePalette(readPalette()),
  );
  scene.add(stage.root);
  const ink = createInk(house);
  scene.add(ink.group);
  const own = houseAnchors(house);

  let quality = opts.quality;
  let post: PostChain | null = null;
  let dirty = true;
  let firstFrame = true;
  let pbr: PbrHandle | null = null;
  let disposed = false;
  let width = 1;
  let height = 1;
  let dpr = 1;
  const lostCallbacks: (() => void)[] = [];
  const lifted = new Vector3();

  const configure = (): void => {
    const settings = QUALITY[quality];
    gl.configure(settings);
    if (settings.composer && post === null) {
      post = createPost(renderer, scene, camera);
    }
    post?.configure(settings);
    renderer.setPixelRatio(Math.min(dpr, settings.maxDpr));
    renderer.setSize(width, height, false);
    if (settings.composer) {
      post?.composer.setSize(width, height, false);
    }
    dirty = true;
  };

  const onLost = (event: Event): void => {
    event.preventDefault();
    for (const cb of lostCallbacks) {
      cb();
    }
  };
  const onRestored = (): void => {
    dirty = true;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  configure();
  void gl.loadEnvironment().then(() => {
    dirty = true;
  });

  const anchorPoint = (id: string): Vector3 | null => {
    const mine: StageAnchor | undefined = own.get(id);
    if (mine !== undefined) {
      lifted.copy(mine.point);
      if (mine.upper && stage.upper !== null) {
        lifted.y += stage.upper.position.y;
      }
      return lifted;
    }
    return ink.anchors.get(id) ?? null;
  };

  return {
    apply(s) {
      const c = s.camera;
      camera.position.set(c.position[0], c.position[1], c.position[2]);
      camera.lookAt(c.target[0], c.target[1], c.target[2]);
      camera.rotateZ(MathUtils.degToRad(c.rollDeg));
      if (camera.fov !== c.fovDeg) {
        camera.fov = c.fovDeg;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      applyBuild(stage, s);
      ink.apply(s, camera);
      dirty = true;
    },
    render() {
      if (!dirty || disposed) {
        return;
      }
      dirty = false;
      if (post !== null && QUALITY[quality].composer) {
        post.composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (firstFrame) {
        firstFrame = false;
        // Photographic textures are not needed for the first paint; they land once, later.
        applyPbr(stage, house.plan.rooms).then(
          (handle) => {
            if (disposed) {
              handle.dispose();
            } else {
              pbr = handle;
              dirty = true;
            }
          },
          () => undefined, // keep present's drawn textures
        );
      }
    },
    resize(w, h, nextDpr) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      dpr = nextDpr;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      ink.setResolution(width, height);
      configure();
    },
    project(anchorId) {
      const point = anchorPoint(anchorId);
      return point === null ? null : projectPoint(point, camera, width, height);
    },
    anchors() {
      return [...new Set([...own.keys(), ...ink.anchors.keys()])];
    },
    setQuality(q) {
      if (q !== quality) {
        quality = q;
        configure();
      }
    },
    onContextLost(cb) {
      lostCallbacks.push(cb);
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      lostCallbacks.length = 0;
      pbr?.dispose();
      ink.dispose();
      post?.dispose();
      disposeStageHouse(stage, disposeMaterials);
      scene.remove(stage.root);
      gl.dispose();
    },
  };
}
