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

import { MathUtils, Vector3, type WebGLRenderTarget } from 'three';

import { buildStair } from '@/lib/landing/house';
import {
  createAssetService,
  disposeMaterials,
  readPalette,
  type AssetService,
  type ScenePalette,
} from '@/lib/three/present';

import { LANDING_PALETTE } from '../palette';
import type { LandingHouse, LandingState } from '../types';

import { houseAnchors, projectPoint, type StageAnchor } from './anchors';
import { applyBuild, buildStageHouse, disposeStageHouse } from './house';
import { createInk } from './ink';
import type { createPost, PostChain } from './post';
import { QUALITY, sameNumbers, type Quality, type QualitySettings } from './quality';
import { createStageRenderer } from './renderer';
import { warmStage } from './warm';
import { applyPbr, type PbrHandle } from './textures';

export { NoWebGL2Error } from './renderer';
export {
  createFrameGovernor,
  pickStageQuality,
  QUALITY,
  qualityForRenderer,
  type FrameGovernor,
  type Quality,
} from './quality';

declare global {
  interface Window {
    /** DEV only: the last frame's draw calls/triangles (all passes), GPU memory, program count. */
    __landingStageInfo?: () => {
      quality: Quality;
      render: { calls: number; triangles: number; points: number; lines: number; frame: number };
      memory: { geometries: number; textures: number };
      programs: number;
    };
    /** DEV only: override single settings of the live tier (pass profiling); `null` clears. */
    __landingStageTune?: (patch: Partial<QualitySettings> | null, q?: Quality) => void;
  }
}

export interface Stage {
  apply(s: LandingState): void;
  render(): void;
  resize(w: number, h: number, dpr: number): void;
  project(anchorId: string): { x: number; y: number; visible: boolean } | null;
  anchors(): string[];
  setQuality(q: Quality): void;
  /** Resolves once every tier's programs are compiled (switching tiers after this costs no link stall). */
  readonly warmed: Promise<void>;
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

/** Where `pnpm draco` puts three's Draco decoder (public/draco, gitignored), as AuthScreen's houseScene. */
export const DRACO_DECODER_PATH = '/draco/';
/** Depth range from the camera's distance to its target: near ≈ dist / 200 keeps the drawing's layers apart. */
const NEAR_PER_DIST = 1 / 200;
const NEAR_MIN = 0.02;
const FAR_PER_DIST = 4;
/** Far never closer than this past the target: an interior shot still sees the whole house. */
const FAR_MIN = 40;

export async function createStage(
  canvas: HTMLCanvasElement,
  house: LandingHouse,
  opts: {
    quality: Quality;
    /** CC0 `.glb` furniture (public/models). Default: present's service with the Draco decoder; the stage frees its own. */
    assets?: AssetService;
  },
): Promise<Stage> {
  const gl = createStageRenderer(canvas);
  const { renderer, scene, camera } = gl;
  const ownAssets = opts.assets === undefined ? createAssetService({ dracoDecoderPath: DRACO_DECODER_PATH }) : null;
  const assets = opts.assets ?? ownAssets;
  const models = new AbortController();
  const stage = buildStageHouse(
    house,
    (materials) => buildStair(house.stair, materials.wood),
    landingScenePalette(readPalette()),
    assets === null ? { signal: models.signal } : { assets, signal: models.signal },
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
  let last: LandingState | null = null;
  let shadowDirty = true;
  let tune: Partial<QualitySettings> = {};
  let warmedResolve: () => void = () => undefined;
  const warmed = new Promise<void>((resolve) => {
    warmedResolve = resolve;
  });
  const settingsNow = (): QualitySettings => ({ ...QUALITY[quality], ...tune });
  let width = 1;
  let height = 1;
  let dpr = 1;
  const lostCallbacks: (() => void)[] = [];
  const lifted = new Vector3();
  const target = new Vector3();

  // A `.glb` swapped in for a procedural piece gets the piece's growth clones, then one redraw.
  for (const piece of stage.pieces) {
    void piece.ready.then((source) => {
      if (source === 'model' && !disposed) {
        stage.furniture.get(piece.id)?.refresh();
        dirty = true;
        shadowDirty = true;
      }
    });
  }

  // The composer (postprocessing + n8ao) is its own chunk: lite never loads it.
  let postModule: { createPost: typeof createPost } | null = null;
  const loadPost = async (): Promise<void> => {
    postModule = await import('./post');
    if (!disposed) {
      configure();
    }
  };

  const configure = (): void => {
    const settings = settingsNow();
    if (settings.composer && post === null && postModule !== null) {
      post = postModule.createPost(renderer, scene, camera);
    } else if (settings.composer && postModule === null) {
      void loadPost();
    }
    // Until the composer is here, the renderer tone-maps itself (same curve, same picture).
    gl.configure(settings.composer && post === null ? { ...settings, composer: false } : settings);
    post?.configure(settings);
    renderer.setPixelRatio(Math.min(dpr, settings.maxDpr));
    renderer.setSize(width, height, false);
    if (settings.composer) {
      post?.composer.setSize(width, height, false);
    }
    dirty = true;
    shadowDirty = true;
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

  if (QUALITY[quality].composer) {
    await loadPost();
  } else {
    configure();
  }
  const environment = gl.loadEnvironment().then(() => {
    dirty = true;
  });

  /** Programs, textures and geometry warmed once the late parts (HDRI, PBR maps, `.glb`) are in — see warm.ts. */
  const warmUp = async (pbrLanded: Promise<unknown>): Promise<void> => {
    await Promise.allSettled([environment, pbrLanded, ...stage.pieces.map((piece) => piece.ready)]);
    const target = (): WebGLRenderTarget | null => (post !== null && QUALITY[quality].composer ? post.composer.inputBuffer : null);
    const growers = [...stage.walls.values(), ...stage.furniture.values(), ...stage.floors, ...stage.joinery, stage.stair];
    const parts = [...growers.map((grower) => grower.object), ...(stage.upper === null ? [] : [stage.upper])];
    if (!disposed && (await warmStage(renderer, scene, camera, target, parts, () => disposed))) {
      // Every lower tier's programs too (shadowed or not, tone-mapped by the renderer, drawn to the
      // screen): a later step down then links nothing — SMOOTH.md's 1.2 s stall. The governor never climbs.
      const lower = (['full', 'balanced', 'lite'] as const).slice((['full', 'balanced', 'lite'] as const).indexOf(quality) + 1);
      // Programs are created with the renderer's state at call time: set each tier, start, restore at once,
      // so a frame drawn while the driver links never shows a borrowed look.
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(null);
      const compiling = lower.map((tier) => {
        gl.configure(QUALITY[tier]);
        return renderer.compileAsync(scene, camera);
      });
      renderer.setRenderTarget(previous);
      configure();
      await Promise.allSettled(compiling);
      if (disposed) {
        return;
      }
      if (last !== null) {
        applyBuild(stage, last);
      }
      dirty = true;
    }
  };

  // Counts every pass of a frame (the composer renders several), reset once per frame below.
  renderer.info.autoReset = false;
  if (import.meta.env.DEV) {
    window.__landingStageInfo = info;
    window.__landingStageTune = (patch, q) => {
      tune = patch ?? {};
      quality = q ?? quality;
      configure();
    };
  }
  function info(): ReturnType<NonNullable<Window['__landingStageInfo']>> {
    return {
      quality,
      render: { ...renderer.info.render },
      memory: { ...renderer.info.memory },
      programs: renderer.info.programs?.length ?? 0,
    };
  }

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
      target.set(c.target[0], c.target[1], c.target[2]);
      camera.lookAt(target);
      camera.rotateZ(MathUtils.degToRad(c.rollDeg));
      const dist = camera.position.distanceTo(target);
      const near = Math.max(NEAR_MIN, dist * NEAR_PER_DIST);
      const far = Math.max(dist * FAR_PER_DIST, dist + FAR_MIN);
      if (camera.fov !== c.fovDeg || camera.near !== near || camera.far !== far) {
        camera.fov = c.fovDeg;
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      if (last === null || !sameNumbers(last.build, s.build) || !sameNumbers(last.compliance, s.compliance)) {
        shadowDirty = true;
      }
      applyBuild(stage, s);
      last = s;
      ink.apply(s, camera);
      dirty = true;
    },
    render() {
      if (!dirty || disposed) {
        return;
      }
      dirty = false;
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = shadowDirty;
      shadowDirty = false;
      if (post !== null && (tune.composer ?? QUALITY[quality].composer)) {
        post.composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (firstFrame) {
        firstFrame = false;
        // Photographic textures are not needed for the first paint; they land once, later.
        const landed = applyPbr(stage, house.plan.rooms);
        void warmUp(landed).catch(() => undefined).finally(warmedResolve);
        landed.then(
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
    warmed,
    onContextLost(cb) {
      lostCallbacks.push(cb);
    },
    dispose() {
      disposed = true;
      // A stage re-made on a fresh canvas (context loss) may already own the hook.
      if (import.meta.env.DEV && window.__landingStageInfo === info) {
        delete window.__landingStageInfo;
        delete window.__landingStageTune;
      }
      warmedResolve();
      models.abort();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      lostCallbacks.length = 0;
      pbr?.dispose();
      ink.dispose();
      post?.dispose();
      disposeStageHouse(stage, disposeMaterials);
      scene.remove(stage.root);
      ownAssets?.dispose();
      gl.dispose();
    },
  };
}
