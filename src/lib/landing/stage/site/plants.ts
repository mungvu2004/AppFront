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
 * lower crown (cheap crown occlusion); canopy normals lean to the crown's ellipsoid
 * (soft masses), and shader.ts adds leaf clumps and wrap light. Until a model arrives each slug draws a crude
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
const DEEP = '#3E5A2E';
const MID = '#557043';
const TIPS = '#6E7E4A';
const FROND = '#647349';
/** Bark: grey-brown, never pink (low red-blue spread). */
const BARK = '#5A5045';
const PALM_TRUNK = '#6B6457';
const FRUIT = '#6E6A3A';
/** The lower crown darkens to this share of its colour (fake occlusion). */
const CROWN_SHADE = 0.45;
/** How far the canopy normals lean to the crown's ellipsoid (0 = welded facets, 1 = one soft ball). */
const ROUND = 0.7;
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
    // A lighter bush now and then against the boundary walls (was magenta bougainvillea: read as a missing texture).
    return p.variant !== 'topiary' && !p.id.startsWith('P-HEDGE-H') && s < 0.12 ? MID : DEEP;
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
  /** Per instance: crown centre x, y, z and radius (m). */
  readonly crowns: Float32Array;
  /** Per instance: 1 while hidden by the camera-near cull. */
  readonly hidden: Uint8Array;
  meshes: InstancedMesh[];
}

/** A plant is hidden whole (never faded) when its crown comes within this of the eye... */
const EYE_CLEAR_M = 2.5;
/** ...or of the first `REACH_M` of the line of sight (half the eye-target distance at most), with this radius. */
const SIGHT_CLEAR_M = 1.2;
const REACH_M = 8;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Planting {
  readonly group: Group;
  /** Resolves when every model has landed or failed (the stand-ins stay on failure). */
  load(assets: AssetService, signal: AbortSignal): Promise<void>;
  /** Hide whole plants whose crown is in the camera-near volume; true when the hidden set changed. Allocates nothing. */
  cull(eye: Point, target: Point): boolean;
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

/**
 * The stylised-tree trick: lean every canopy normal toward the direction from
 * the crown's centre (its bounding ellipsoid), so the crown lights as a soft mass
 * and the low-poly facets stop reading; ROUND keeps a little blob detail.
 */
function roundNormals(g: BufferGeometry): void {
  g.computeBoundingBox();
  const box = g.boundingBox;
  if (box === null) {
    return;
  }
  const c = box.getCenter(new Vector3());
  const e = box.getSize(new Vector3()).multiplyScalar(0.5).max(new Vector3(1e-3, 1e-3, 1e-3));
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const n = new Vector3();
  const r = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    // Gradient of the ellipsoid through the point: (p − c) / e².
    r.fromBufferAttribute(pos, i).sub(c).divide(e).divide(e).normalize();
    n.fromBufferAttribute(nor, i).lerp(r, ROUND).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
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
    patchGrow(new MeshStandardMaterial({ color: white, roughness: vertexColors ? 0.95 : 1, metalness: 0, envMapIntensity: 0.35, vertexColors }), grow, vertexColors);
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
    const crowns = new Float32Array(records.length * 4);
    records.forEach((p, i) => {
      matrixOf(p, m).toArray(matrices, i * 16);
      const h = p.heightMm / 1000;
      crowns.set([M(p.at[0]), M(p.baseMm) + h * 0.65, M(p.at[1]), Math.max(p.canopyMm / 2000, h * 0.3)], i * 4);
    });
    const url = records[0]?.modelUrl ?? `/pascal/items/${slug}/model.glb`;
    return { slug, url, records, matrices, crowns, hidden: new Uint8Array(records.length), meshes: [] };
  });

  const mount = (set: SlugSet, parts: Map<Part, BufferGeometry>): void => {
    for (const old of set.meshes) {
      group.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    set.meshes = [...parts].map(([part, geometry]) => {
      if (part === 'foliage') {
        roundNormals(geometry);
        shadeCrown(geometry);
      }
      const mesh = new InstancedMesh(geometry, materials[part], set.records.length);
      mesh.name = `site:plants:${set.slug}:${part}`;
      mesh.userData.records = set.records.map((p) => p.id);
      mesh.instanceMatrix.array.set(set.matrices);
      set.hidden.forEach((h, i) => h === 1 && mesh.instanceMatrix.array.fill(0, i * 16, i * 16 + 12));
      set.records.forEach((p, i) => {
        const base = part === 'foliage' ? foliageOf(p) : part === 'trunk' ? (set.slug === 'palm' ? PALM_TRUNK : BARK) : FRUIT;
        // Hue ±0.035 (olive ↔ blue-green), saturation biased down (−0.12…+0.02), lightness ±0.07.
        const [h, sa, l] = [seedOf(`${p.id}h`), seedOf(`${p.id}c`), seedOf(`${p.id}v`)];
        mesh.setColorAt(i, tint.set(base).offsetHSL((h - 0.5) * 0.07, -0.12 + 0.14 * sa, (l - 0.5) * 0.14));
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
    cull(eye, target) {
      const dx = target.x - eye.x;
      const dy = target.y - eye.y;
      const dz = target.z - eye.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const reach = Math.min(REACH_M, dist / 2);
      let changed = false;
      for (const set of sets) {
        const { crowns, hidden, matrices } = set;
        for (let i = 0; i < hidden.length; i += 1) {
          const cx = (crowns[i * 4] ?? 0) - eye.x;
          const cy = (crowns[i * 4 + 1] ?? 0) - eye.y;
          const cz = (crowns[i * 4 + 2] ?? 0) - eye.z;
          const r = crowns[i * 4 + 3] ?? 0;
          // Closest point of the near sight segment [0, reach] to the crown centre.
          const t = Math.min(reach, Math.max(0, (cx * dx + cy * dy + cz * dz) / dist));
          const off = Math.hypot(cx - (dx / dist) * t, cy - (dy / dist) * t, cz - (dz / dist) * t);
          const hide = Math.hypot(cx, cy, cz) < r + EYE_CLEAR_M || off < r + SIGHT_CLEAR_M ? 1 : 0;
          if (hide === hidden[i]) {
            continue;
          }
          hidden[i] = hide;
          changed = true;
          for (const mesh of set.meshes) {
            const a = mesh.instanceMatrix.array;
            if (hide === 1) {
              a.fill(0, i * 16, i * 16 + 12);
            } else {
              for (let k = i * 16; k < i * 16 + 12; k += 1) a[k] = matrices[k] ?? 0;
            }
            mesh.instanceMatrix.needsUpdate = true;
          }
        }
      }
      return changed;
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
