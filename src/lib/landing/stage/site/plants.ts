/**
 * Trees, palms, bonsai and hedges: Pascal items (`/pascal/items/<slug>/model.glb`,
 * MIT), one InstancedMesh per slug per material slot — 40 hedges are one draw.
 *
 * Every instance's matrix is fixed at build time (position, the record's turn
 * plus a seeded jitter, a non-uniform seeded scale, a palm's lean), and so is
 * its colour, so neighbours never look stamped. The `variant` shapes a model:
 * a bonsai is a tree pressed low and wide, a topiary ball is the hedge squashed
 * round, a hedge is stretched so neighbours overlap into one mass.
 *
 * The look is the reference's, not a game kit's: dark, low-saturation greens
 * on a rough PBR surface (sky fill from the environment), facets smoothed by
 * welding and recomputing normals, and a baked vertex shade that darkens the
 * lower crown (cheap crown occlusion). Until a model arrives each slug draws a crude
 * stand-in of the record's size (an icosahedron crown on a cylinder) through
 * the same instance data; the `.glb` then replaces the geometry once.
 * Growth is the `grow` uniform in the vertex shader (shader.ts), not matrices.
 */

import {
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type MeshDepthMaterial,
  type Object3D,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { AssetService } from '@/lib/three/present';

import type { SitePlant } from '../../types';
import { seedOf } from '../textures';

import { M, merge } from './geo';
import { growDepthMaterial, patchGrow, type Num } from './shader';

type Part = 'foliage' | 'trunk' | 'fruit';

/** Albedo before lighting: HSV saturation ≤ 40 %, value ≤ 42 %, or the sun clips them into lime. */
const DEEP = '#33442C';
const MID = '#4A5C38';
const TIPS = '#66713F';
const FROND = '#5A6540';
const BOUGAINVILLEA = '#A3346B';
const BARK = '#4E4239';
const PALM_TRUNK = '#7A6E60';
const FRUIT = '#6E6A3A';
/** The lower crown darkens to this share of its colour (fake occlusion). */
const CROWN_SHADE = 0.55;
const PALM_LEAN = (6 * Math.PI) / 180;
/** The hedge model's depth / length: scaling x by this turns it into a ball. */
const BALL_X = 1043 / 3115;
const UP = new Vector3(0, 1, 0);

function foliageOf(p: SitePlant): string {
  const s = seedOf(`${p.id}f`);
  if (p.slug === 'palm') {
    return FROND;
  }
  if (p.slug === 'bush') {
    // Bougainvillea only against the boundary walls, never in the house-front beds.
    return p.variant !== 'topiary' && !p.id.startsWith('P-HEDGE-H') && s < 0.12 ? BOUGAINVILLEA : DEEP;
  }
  if (p.variant === 'bonsai') {
    return MID;
  }
  return s < 0.2 ? TIPS : s < 0.5 ? DEEP : MID;
}

interface SlugSet {
  readonly slug: string;
  readonly url: string;
  readonly records: readonly SitePlant[];
  readonly matrices: Float32Array;
  meshes: InstancedMesh[];
}

export interface Planting {
  readonly group: Group;
  /** Resolves when every model has landed or failed (the stand-ins stay on failure). */
  load(assets: AssetService, signal: AbortSignal): Promise<void>;
  dispose(): void;
}

const jitter = (id: string, amp: number): number => 1 + (seedOf(id) - 0.5) * 2 * amp;

function matrixOf(p: SitePlant, out: Matrix4): Matrix4 {
  const s = seedOf(p.id);
  const hedge = p.slug === 'bush' && p.variant !== 'topiary';
  const turn = (p.rotationDeg * Math.PI) / 180 + (hedge ? (s - 0.5) * 0.2 : s * Math.PI * 2);
  const q = new Quaternion().setFromAxisAngle(UP, turn);
  if (p.slug === 'palm') {
    const lean = new Vector3(Math.cos(s * 9), 0, Math.sin(s * 9));
    q.premultiply(new Quaternion().setFromAxisAngle(lean, (seedOf(`${p.id}l`) - 0.5) * 2 * PALM_LEAN));
  }
  const k = p.scale;
  const size =
    p.variant === 'topiary'
      ? new Vector3(k * BALL_X, k, k * BALL_X)
      : hedge
        ? new Vector3(k * 1.25, k * jitter(`${p.id}y`, 0.05), k)
        : new Vector3(k * jitter(`${p.id}x`, 0.12), k * jitter(`${p.id}y`, 0.18) * (p.variant === 'bonsai' ? 0.7 : 1), k * jitter(`${p.id}z`, 0.12));
  return out.compose(new Vector3(M(p.at[0]), M(p.baseMm), M(p.at[1])), q, size);
}

/** Smooth shading on a low-poly mesh: weld by position, then average the normals. */
function smooth(g: BufferGeometry): BufferGeometry {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const out = mergeVertices(g, 0.02);
  g.dispose();
  out.computeVertexNormals();
  return out;
}

/** Bake the crown shade into a vertex colour: dark at the crown's foot, full at its top. */
function shadeCrown(g: BufferGeometry): void {
  g.computeBoundingBox();
  const y0 = g.boundingBox?.min.y ?? 0;
  const y1 = g.boundingBox?.max.y ?? 1;
  const pos = g.getAttribute('position');
  const rgb = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0)));
    rgb.fill(CROWN_SHADE + (1 - CROWN_SHADE) * t * t * (3 - 2 * t), i * 3, i * 3 + 3);
  }
  g.setAttribute('color', new Float32BufferAttribute(rgb, 3));
}

/** A stand-in at the record's native size: crown + trunk (a bush is crown only). */
function standIn(p: SitePlant): Map<Part, BufferGeometry> {
  const h = p.heightMm / p.scale / 1000;
  const r = p.canopyMm / p.scale / 1000;
  const out = new Map<Part, BufferGeometry>();
  if (p.slug === 'bush') {
    const crown = new IcosahedronGeometry(1, 1);
    crown.scale(r, h * 0.5, r * 0.35);
    crown.translate(0, h * 0.5, 0);
    out.set('foliage', crown);
    return out;
  }
  const crown = new IcosahedronGeometry(1, 1);
  crown.scale(r * 0.8, h * 0.3, r * 0.8);
  crown.translate(0, h * 0.68, 0);
  const trunk = new CylinderGeometry(h * 0.025, h * 0.04, h * 0.6, 6, 1);
  trunk.translate(0, h * 0.3, 0);
  out.set('foliage', crown);
  out.set('trunk', trunk);
  return out;
}

const partOf = (materialName: string): Part =>
  materialName.includes('trunk') ? 'trunk' : materialName.includes('coconut') || materialName.includes('fruit') ? 'fruit' : 'foliage';

/** The model's meshes, baked into its root frame and folded per slot. */
function partsOf(root: Object3D): Map<Part, BufferGeometry> {
  root.updateMatrixWorld(true);
  const lists = new Map<Part, BufferGeometry[]>();
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const material = o.material as Material | Material[];
      const name = Array.isArray(material) ? (material[0]?.name ?? '') : material.name;
      const g = (o.geometry as BufferGeometry).clone().applyMatrix4(o.matrixWorld);
      const part = partOf(name);
      lists.set(part, [...(lists.get(part) ?? []), g]);
    }
  });
  return new Map([...lists].map(([part, gs]) => [part, smooth(merge(gs))]));
}

export function buildPlanting(plants: readonly SitePlant[], grow: Num): Planting {
  const group = new Group();
  group.name = 'site:planting';
  group.userData.records = plants.map((p) => p.id);
  const white = new Color('#FFFFFF');
  const leafy = (vertexColors: boolean): MeshStandardMaterial =>
    patchGrow(new MeshStandardMaterial({ color: white, roughness: 0.9, metalness: 0, envMapIntensity: 0.4, vertexColors }), grow);
  const materials: Record<Part, MeshStandardMaterial> = { foliage: leafy(true), trunk: leafy(false), fruit: leafy(false) };
  const depth: MeshDepthMaterial = growDepthMaterial(grow);
  const tint = new Color();

  const bySlug = new Map<string, SitePlant[]>();
  for (const p of plants) {
    const slug = p.slug ?? 'tree';
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), p]);
  }
  const m = new Matrix4();
  const sets: SlugSet[] = [...bySlug].map(([slug, records]) => {
    const matrices = new Float32Array(records.length * 16);
    records.forEach((p, i) => {
      matrixOf(p, m).toArray(matrices, i * 16);
    });
    return { slug, url: records[0]?.modelUrl ?? `/pascal/items/${slug}/model.glb`, records, matrices, meshes: [] };
  });

  const mount = (set: SlugSet, parts: Map<Part, BufferGeometry>): void => {
    for (const old of set.meshes) {
      group.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    set.meshes = [...parts].map(([part, geometry]) => {
      if (part === 'foliage') {
        shadeCrown(geometry);
      }
      const mesh = new InstancedMesh(geometry, materials[part], set.records.length);
      mesh.name = `site:plants:${set.slug}:${part}`;
      mesh.userData.records = set.records.map((p) => p.id);
      mesh.instanceMatrix.array.set(set.matrices);
      set.records.forEach((p, i) => {
        const base = part === 'foliage' ? foliageOf(p) : part === 'trunk' ? (set.slug === 'palm' ? PALM_TRUNK : BARK) : FRUIT;
        // Hue ±0.025, saturation biased down (−0.10…+0.02), lightness ±0.06.
        const [h, sa, l] = [seedOf(`${p.id}h`), seedOf(`${p.id}c`), seedOf(`${p.id}v`)];
        mesh.setColorAt(i, tint.set(base).offsetHSL((h - 0.5) * 0.05, -0.1 + 0.12 * sa, (l - 0.5) * 0.12));
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depth;
      group.add(mesh);
      return mesh;
    });
  };
  for (const set of sets) {
    const first = set.records[0];
    if (first !== undefined) {
      mount(set, standIn(first));
    }
  }

  return {
    group,
    async load(assets, signal) {
      await Promise.allSettled(
        sets.map(async (set) => {
          const root = await assets.load(set.url, signal);
          if (!signal.aborted) {
            mount(set, partsOf(root));
          }
        }),
      );
    },
    dispose() {
      for (const set of sets) {
        for (const mesh of set.meshes) {
          mesh.geometry.dispose();
          mesh.dispose();
        }
      }
      for (const mat of Object.values(materials)) {
        mat.dispose();
      }
      depth.dispose();
    },
  };
}
