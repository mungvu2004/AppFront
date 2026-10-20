/**
 * The estate around the villa: ground, lawns, paths, walls and gates, the koi
 * pond, planting and outdoor objects — every `LandingSite` record, in about
 * thirty draw calls.
 *
 * Built once here; `apply(state)` only writes uniforms, colours, positions and
 * `visible` (allocation-free). Three state channels drive it:
 * - `build.site`: hardscape turns from paper to material and rises (one shared
 *   growth uniform set, the house's clamp), the model base with it;
 * - `build.planting`: the lawn greens from bare soil, plants grow from their feet;
 * - `build.water`: the pond fills from its floor.
 * `ambient(timeMs)` moves only the water ripples and the koi; the stage calls
 * it while it chooses to animate and simply stops calling when idle.
 *
 * Photographic textures (lawn, paving; Poly Haven CC0) and the Pascal models
 * arrive after construction and land once; the site draws without them.
 */

import {
  Box3,
  Color,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Sphere,
  SRGBColorSpace,
  TextureLoader,
  type BufferGeometry,
  type MeshBasicMaterial,
  type PerspectiveCamera,
  type Material,
  type Texture,
} from 'three';

import { createAssetService, type AssetService, type SceneMaterials } from '@/lib/three/present';

import { LANDING_PALETTE } from '../../palette';
import type { LandingHouse, LandingState } from '../../types';
import { NO_CLAMP_Y, createGrowthUniforms, growthDepthMaterial } from '../patch';
import { TEX_BASE } from '../textures';
import { inverseNeutral } from '../tone';

import { AMBIENT_MIN_PX, radiusPx } from '../loop';

import { M } from './geo';
import { buildHardscape } from './ground';
import { buildItems } from './items';
import { buildPlanting } from './plants';
import { blobMesh, blobTexture, blobsOf } from './shadows';
import { buildPond } from './water';
import { patchSite, type Num } from './shader';

export interface SiteContext {
  readonly materials: SceneMaterials;
  readonly anisotropy: number;
  /** Pascal model loader; default: present's service with the Draco decoder (the site frees its own). */
  readonly assets?: AssetService;
  /** Texture loader (tests inject one); default: three's TextureLoader. */
  readonly loadTexture?: (url: string) => Promise<Texture>;
}

export interface StageSite {
  readonly group: Group;
  /** Writes one frame; true when the shadow map must redraw (plants hidden or shown near `eye`). */
  apply(state: LandingState, eye?: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }): boolean;
  /**
   * Ripples + koi at `timeMs`; true when a shown pond is in `camera`'s frustum and at least AMBIENT_MIN_PX
   * (radius) on a `heightPx`-tall viewport, so the frame needs a redraw. Nothing moves otherwise.
   */
  ambient(timeMs: number, camera?: PerspectiveCamera, heightPx?: number): boolean;
  /** Resolves when textures and models have landed or failed. */
  readonly ready: Promise<void>;
  dispose(): void;
}

/** Tile sizes (m) of the photographic sets. */
const LAWN_TILE_M = 2;
const PAVING_TILE_M = 2.4;
/** Stone pieces' uv is ~0.5 per model unit (items.ts): one tile across a rock. */
const STONE_TILE_M = 1.2;
/** The clamp climbs this far above natural ground over `build.site` (tallest gate pier ≈ 3 m). */
const RISE_M = 3.6;
const SOIL = new Color('#7D6A4F');
/**
 * Gain over the lawn map, well above white on purpose (linear multipliers): the
 * map is a dark, very saturated turf photo (mean ≈ 0.07, 0.18, 0.03) that the
 * shader pulls to 38 % chroma; this lands a sunlit lawn near sRGB (105, 128, 67),
 * lighter than the trees (the value contrast that makes it read).
 */
const GRASS = new Color().setRGB(2.15, 2.2, 1.65);
/** Contact-shadow strength under plants / under stone, the car and along walls. */
const BLOB_PLANTS = 0.5;
const BLOB_SITE = 0.42;

export function createSite(house: LandingHouse, ctx: SiteContext): StageSite {
  const { site } = house;
  const groundY = M(site.groundMm);
  const hard = createGrowthUniforms(groundY);
  // The site mixes paper in after lighting (shader.ts): the tone curve's pre-image lands on the page's paper.
  hard.uPaper.value.copy(inverseNeutral(new Color(LANDING_PALETTE.paper)));
  const grow: Num = { value: 0 };
  const time: Num = { value: 0 };
  const group = new Group();
  group.name = 'site';
  group.visible = false;

  const mats = {
    lawn: patchSite(new MeshLambertMaterial({ color: SOIL.clone() }), { growth: hard, twoScale: true }),
    bed: patchSite(new MeshLambertMaterial({ color: '#3A3128' }), { growth: hard }),
    // Cool grey stone, never brown cobble.
    paving: patchSite(new MeshStandardMaterial({ color: '#C9CCCD', roughness: 0.85 }), { growth: hard }),
    stone: patchSite(new MeshStandardMaterial({ color: '#B9B7B1', roughness: 0.8 }), { growth: hard }),
    granite: patchSite(new MeshStandardMaterial({ color: '#8E8C87', roughness: 0.75 }), { growth: hard }),
    render: patchSite(new MeshLambertMaterial({ color: '#F3F4F3' }), { growth: hard }),
    gate: patchSite(new MeshStandardMaterial({ color: '#3B3530', roughness: 0.5, metalness: 0.3 }), { growth: hard }),
    liner: patchSite(new MeshLambertMaterial({ color: '#2A2F2A' }), { growth: hard }),
  };
  const depth = growthDepthMaterial(hard);

  const scape = buildHardscape(site);
  const ponds = site.water.map((w) => buildPond(w, time));
  const hardMeshes: Mesh[] = [];
  const add = (name: string, geometry: BufferGeometry, material: Material, records: readonly string[], cast: boolean): void => {
    const mesh = new Mesh(geometry, material);
    mesh.name = `site:${name}`;
    mesh.userData.records = records;
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    if (cast) {
      mesh.customDepthMaterial = depth;
    }
    hardMeshes.push(mesh);
    group.add(mesh);
  };
  add('lawn', scape.lawn, mats.lawn, scape.records.lawn, false);
  add('bed', scape.bed, mats.bed, scape.records.bed, false);
  add('paving', scape.paving, mats.paving, scape.records.paving, false);
  add('stone', scape.stone, mats.stone, scape.records.stone, true);
  add('granite', scape.granite, mats.granite, [], true);
  add('render', scape.render, mats.render, scape.records.render, true);
  add('gate', scape.gate, mats.gate, scape.records.gate, true);
  for (const pond of ponds) {
    add(`${pond.group.name}:coping`, pond.coping, mats.granite, [], false);
    add(`${pond.group.name}:liner`, pond.liner, mats.liner, [], false);
    group.add(pond.group);
  }
  // Bounds once (the site never moves; the water's rise is small against the pond's width).
  const pondSpheres = ponds.map((pond) => new Box3().setFromObject(pond.group).getBoundingSphere(new Sphere()));
  const frustum = new Frustum();
  const viewProj = new Matrix4();
  const seen = (sphere: Sphere, camera: PerspectiveCamera, heightPx: number): boolean =>
    frustum.intersectsSphere(sphere) &&
    radiusPx(sphere.radius, sphere.center.distanceTo(camera.position), camera.fov, heightPx) >= AMBIENT_MIN_PX;

  const planting = buildPlanting(site.plants, grow);
  const items = buildItems(site.items, hard);
  const blobMap = blobTexture();
  const blobs = blobsOf(site);
  const plantBlobs = blobMesh(blobs.planting, blobMap, BLOB_PLANTS, 'site:contact:plants');
  const siteBlobs = blobMesh(blobs.site, blobMap, BLOB_SITE, 'site:contact:site');
  plantBlobs.userData.records = [];
  siteBlobs.userData.records = [];
  group.add(planting.group, items.group, plantBlobs, siteBlobs);

  // Late parts: textures and models, each landing once.
  const models = new AbortController();
  const ownAssets = ctx.assets === undefined ? createAssetService({ dracoDecoderPath: '/draco/' }) : null;
  const assets = ctx.assets ?? ownAssets;
  const load = ctx.loadTexture ?? ((url: string) => new TextureLoader().loadAsync(url));
  const textures: Texture[] = [];
  let disposed = false;
  const tex = async (name: string, srgb: boolean, tileM: number): Promise<Texture> => {
    const t = await load(`${TEX_BASE}${name}_1k.jpg`);
    textures.push(t);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = ctx.anisotropy;
    t.repeat.setScalar(1 / tileM);
    if (srgb) {
      t.colorSpace = SRGBColorSpace;
    }
    return t;
  };
  const dress = async (): Promise<void> => {
    const [lawnD, lawnN, paveD, paveN, stoneD, stoneN] = await Promise.all([
      tex('lawn_diff', true, LAWN_TILE_M),
      tex('lawn_nor', false, LAWN_TILE_M),
      tex('paving_diff', true, PAVING_TILE_M),
      tex('paving_nor', false, PAVING_TILE_M),
      tex('stone_diff', true, STONE_TILE_M),
      tex('stone_nor', false, STONE_TILE_M),
    ]);
    if (disposed) {
      return;
    }
    mats.lawn.map = lawnD;
    mats.lawn.normalMap = lawnN;
    mats.lawn.normalScale.setScalar(0.35);
    mats.paving.map = paveD;
    mats.paving.normalMap = paveN;
    items.stone.map = stoneD;
    items.stone.normalMap = stoneN;
    items.stone.normalScale.setScalar(0.6);
    for (const m of [mats.lawn, mats.paving, items.stone]) {
      m.needsUpdate = true;
    }
  };
  const ready = Promise.allSettled([
    dress(),
    assets === null ? Promise.resolve() : planting.load(assets, models.signal),
    assets === null ? Promise.resolve() : items.load(assets, models.signal),
  ]).then(() => undefined);

  return {
    group,
    ready,
    apply(state, eye, target) {
      const { site: s, planting: p, water: w } = state.build;
      group.visible = s > 0 || p > 0 || w > 0;
      hard.uMat.value = s;
      hard.uRiseY.value = s >= 1 ? NO_CLAMP_Y : groundY + s * RISE_M;
      for (const mesh of hardMeshes) {
        mesh.visible = s > 0;
      }
      items.group.visible = s > 0;
      mats.lawn.color.lerpColors(SOIL, GRASS, p);
      grow.value = p;
      planting.group.visible = p > 0;
      plantBlobs.visible = p > 0;
      (plantBlobs.material as MeshBasicMaterial).opacity = BLOB_PLANTS * p;
      siteBlobs.visible = s > 0;
      (siteBlobs.material as MeshBasicMaterial).opacity = BLOB_SITE * s;
      for (const pond of ponds) {
        pond.group.visible = w > 0;
        pond.group.position.y = pond.floorY + (pond.levelY - pond.floorY) * w;
        pond.koi.visible = w > 0.6;
      }
      return p > 0 && eye !== undefined && target !== undefined && planting.cull(eye, target);
    },
    ambient(timeMs, camera, heightPx = 0) {
      if (camera !== undefined) {
        frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      let moving = false;
      for (let i = 0; i < ponds.length && group.visible; i += 1) {
        const sphere = pondSpheres[i];
        moving ||=
          ponds[i]?.group.visible === true && sphere !== undefined && (camera === undefined || seen(sphere, camera, heightPx));
      }
      if (moving) {
        time.value = timeMs / 1000;
      }
      return moving;
    },
    dispose() {
      disposed = true;
      models.abort();
      for (const mesh of hardMeshes) {
        mesh.geometry.dispose();
      }
      for (const pond of ponds) {
        pond.group.traverse((o) => {
          if (o instanceof Mesh) {
            (o.geometry as BufferGeometry).dispose();
          }
        });
        for (const m of pond.materials) {
          m.dispose();
        }
      }
      for (const m of Object.values(mats)) {
        m.dispose();
      }
      depth.dispose();
      for (const b of [plantBlobs, siteBlobs]) {
        b.geometry.dispose();
        (b.material as MeshBasicMaterial).dispose();
        b.dispose();
      }
      blobMap.dispose();
      planting.dispose();
      items.dispose();
      for (const t of textures) {
        t.dispose();
      }
      // Textures still in flight are freed once they land.
      void ready.then(() => {
        for (const t of textures) {
          t.dispose();
        }
      });
      ownAssets?.dispose();
      group.clear();
    },
  };
}
