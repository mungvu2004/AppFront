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

import { Box3, MathUtils, Vector3, type Group, type Texture, type WebGLRenderTarget } from 'three';

import { buildStair } from '@/lib/landing/house';
import { createAssetService, disposeMaterials, readPalette, type AssetService, type SceneMaterials } from '@/lib/three/present';

import type { LandingHouse, LandingState, Vec3 } from '../types';

import { houseAnchors, projectPoint, type StageAnchor } from './anchors';
import { gpuMemory, type StageInfo } from './dev';
import { recolourModel } from './facade';
import { landingScenePalette, matchSheetPaper, warmInterior } from './look';
import { applyBuild } from './build';
import { buildStageHouse, disposeStageHouse } from './house';
import { createInk } from './ink';
import type { createPost, PostChain } from './post';
import { pixelRatioFor, QUALITY, sameNumbers, type Quality, type QualitySettings } from './quality';
import { createStageRenderer } from './renderer';
import { buildRoofs } from './roof';
import { compileTiers, warmStage } from './warm';
import { applyPbr, type PbrHandle } from './textures';

export { NoWebGL2Error } from './renderer';
export { LANDING_LOOK, landingScenePalette } from './look';
export {
  createFrameGovernor,
  pickStageQuality,
  QUALITY,
  qualityForRenderer,
  type FrameGovernor,
  type Quality,
} from './quality';

export interface Stage {
  apply(s: LandingState): void;
  render(): void;
  resize(w: number, h: number, dpr: number): void;
  project(anchorId: string): { x: number; y: number; visible: boolean } | null;
  anchors(): string[];
  setQuality(q: Quality): void;
  /** Ambient motion (pond ripples, koi); marks a redraw only when something moved. */
  ambient(timeMs: number): void;
  /** Resolves once every tier's programs are compiled (switching tiers after this costs no link stall). */
  readonly warmed: Promise<void>;
  onContextLost(cb: () => void): void;
  dispose(): void;
}

interface SiteHandle {
  readonly group: Group;
  apply(state: LandingState, eye?: Vector3, target?: Vector3): boolean;
  ambient(timeMs: number): boolean;
  dispose(): void;
}
type CreateSite = (house: LandingHouse, ctx: { materials: SceneMaterials; anisotropy: number }) => SiteHandle;
const SITE_MODULE = import.meta.glob<{ createSite: CreateSite }>('./site/index.ts');

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
  const roofs = buildRoofs(house);
  const lamps = warmInterior();
  scene.add(roofs.group, lamps.group);
  gl.skyOn(stage.root);
  gl.skyOn(roofs.group);
  // The shadow catcher drops to the site's base-block bottom once the estate stands on it.
  const catcherY = gl.ground.position.y;
  let siteFloor = catcherY;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Agent SITE's module (ground, water, planting, outdoor items): its own chunk, mounted when it lands.
  let site: SiteHandle | null = null;
  void SITE_MODULE['./site/index.ts']?.().then((m) => {
    if (disposed) {
      return;
    }
    site = m.createSite(house, { materials: stage.materials, anisotropy });
    scene.add(site.group);
    gl.skyOn(site.group);
    siteFloor = new Box3().setFromObject(site.group).min.y;
    if (last !== null) {
      site.apply(last, camera.position, target);
    }
    dirty = true;
    shadowDirty = true;
  });
  let view: { position: Vec3; target: Vec3; fov?: number } | null = null;
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
  let facadeTextures: Texture[] = [];
  const target = new Vector3();

  // A `.glb` swapped in for a procedural piece gets the piece's growth clones, then one redraw.
  for (const piece of stage.pieces) {
    void piece.ready.then((source) => {
      const grower = stage.furniture.get(piece.id);
      if (source === 'model' && !disposed && grower !== undefined) {
        recolourModel(grower.object, house.plan.furniture.find((f) => f.id === piece.id)?.modelUrl, stage.materials);
        grower.refresh();
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
    matchSheetPaper(ink.group, settings.composer && post !== null);
    post?.configure(settings);
    renderer.setPixelRatio(pixelRatioFor(quality, width, height, dpr));
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
  const onRestored = (): void => void (dirty = true);
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
      // Off the composer the warm draw went to the screen (jury fix 12: a beige slab over the plan at 768):
      // overwrite it in this same task, before the browser presents the canvas.
      if (last !== null) {
        applyBuild(stage, last, camera.position);
      }
      dirty = true;
      stageApi.render();
      // Every lower tier's programs too (shadowed or not, tone-mapped by the renderer, drawn to the
      // screen): a later step down then links nothing — SMOOTH.md's 1.2 s stall. The governor never climbs.
      const lower = (['full', 'balanced', 'lite'] as const).slice((['full', 'balanced', 'lite'] as const).indexOf(quality) + 1);
      await compileTiers(renderer, scene, camera, lower.map((tier) => () => gl.configure(QUALITY[tier])), configure);
    }
  };

  // Counts every pass of a frame (the composer renders several), reset once per frame below.
  renderer.info.autoReset = false;
  if (import.meta.env.DEV) {
    window.__landingStageInfo = info;
    window.__landingStageView = (next) => {
      view = next;
      if (last !== null) stageApi.apply(last);
    };
    window.__landingStageTune = (patch, q) => {
      tune = patch ?? {};
      quality = q ?? quality;
      configure();
    };
  }
  function info(): StageInfo {
    const { render, memory, programs } = renderer.info;
    return { quality, render: { ...render }, memory: { ...memory }, gpuMB: gpuMemory(renderer, scene), programs: programs?.length ?? 0 };
  }

  const anchorPoint = (id: string): Vector3 | null => {
    const mine: StageAnchor | undefined = own.get(id);
    if (mine !== undefined) {
      lifted.copy(mine.point);
      if (mine.upper && stage.upper !== null) {
        lifted.y += stage.upper.position.y * (mine.liftK ?? 1);
      }
      return lifted;
    }
    return ink.anchors.get(id) ?? null;
  };

  const stageApi: Stage = {
    apply(s) {
      const c = view === null ? s.camera : { position: view.position, target: view.target, fovDeg: view.fov ?? s.camera.fovDeg, rollDeg: 0 };
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
      applyBuild(stage, s, camera.position);
      roofs.apply(s, lamps.apply(camera.position, stage.inside));
      if (site?.apply(s, camera.position, target) === true) {
        shadowDirty = true;
      }
      gl.ground.position.y = site !== null && s.build.site > 0.5 ? siteFloor : catcherY;
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
        const landed = applyPbr(stage, house.plan.rooms, anisotropy);
        void Promise.all([roofs.loadTextures(anisotropy), stage.facade.loadTextures(anisotropy, stage.clonesOf)]).then(
          (sets) => {
            facadeTextures = sets[1];
            if (disposed) {
              for (const t of facadeTextures) t.dispose();
            }
            dirty = true;
          },
          () => undefined,
        );
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
    ambient(timeMs) {
      dirty = site?.ambient(timeMs) === true || dirty;
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
        delete window.__landingStageView;
      }
      warmedResolve();
      models.abort();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      lostCallbacks.length = 0;
      pbr?.dispose();
      ink.dispose();
      roofs.dispose();
      lamps.dispose();
      site?.dispose();
      for (const t of facadeTextures) t.dispose();
      post?.dispose();
      disposeStageHouse(stage, disposeMaterials);
      scene.remove(stage.root);
      ownAssets?.dispose();
      gl.dispose();
    },
  };
  return stageApi;
}
