/**
 * Outdoor objects: boulders (displaced, smooth-shaded icosahedra, instanced,
 * sunk about a third into the lawn, stone-textured, ±12 % value and a warm/cool shift each), the round stone
 * table with its stools (one merged mesh), path lights (instanced posts +
 * unlit warm heads — glow without a light), and the Pascal models (car,
 * parking bay) recoloured per material slot.
 *
 * The stone pieces and models share the hardscape's growth uniforms, so they
 * turn from drawn to built and rise with `build.site`.
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
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Euler,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { AssetService } from '@/lib/three/present';

import type { Compass, SiteItem } from '../../types';
import type { GrowthUniforms } from '../patch';
import { seedOf } from '../textures';

import { M, merge } from './geo';
import { patchSite } from './shader';

const FACING: Readonly<Record<Compass, number>> = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };

/** Pascal slot → the finish it gets here. */
const SLOT_FINISH: Readonly<Record<string, { color: string; roughness: number; metalness: number }>> = {
  slot_windows: { color: '#15191D', roughness: 0.08, metalness: 0.2 },
  slot_wheels: { color: '#1B1C1E', roughness: 0.8, metalness: 0 },
  slot_rim: { color: '#9EA3A8', roughness: 0.3, metalness: 0.9 },
  slot_grill: { color: '#121314', roughness: 0.5, metalness: 0.3 },
  slot_plate: { color: '#E8E6E0', roughness: 0.6, metalness: 0 },
  slot_ground: { color: '#8E8B85', roughness: 0.9, metalness: 0 },
  slot_marking: { color: '#E9E6DE', roughness: 0.8, metalness: 0 },
};
const DEFAULT_FINISH = { color: '#8E8B85', roughness: 0.7, metalness: 0 };
/** Car paint: dark graphite metallic base under a glossy clearcoat (not one shiny plastic). */
const CAR_PAINT = { color: '#2A2E33', roughness: 0.42, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 };

export interface Items {
  readonly group: Group;
  /** The stone pieces' material: the site lays the stone texture on it once it lands. */
  readonly stone: MeshStandardMaterial;
  load(assets: AssetService, signal: AbortSignal): Promise<void>;
  dispose(): void;
}

/**
 * A rock: an icosahedron pushed in and out (±18 %) by a seeded function of
 * direction, so shared corners move together; welded so the normals smooth.
 */
export function boulderGeometry(seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 4.1 + seed * 9) * Math.cos(v.y * 3.7 - seed * 5) * 0.7 + 0.3 * Math.sin(v.z * 5.3 + seed * 3);
    v.multiplyScalar(1 + 0.18 * n);
    v.y = Math.max(v.y, -0.55); // flat-ish bottom where it sits in the lawn
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const out = mergeVertices(g, 1e-4);
  g.dispose();
  out.computeVertexNormals();
  // Box-blend planar uv (the stone map is noise, a seam never shows).
  const p = out.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 1) {
    uv[i * 2] = (p.getX(i) + p.getZ(i) * 0.6) * 0.5;
    uv[i * 2 + 1] = (p.getY(i) + p.getZ(i) * 0.4) * 0.5;
  }
  out.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return out;
}

function roughCylinder(r: number, h: number, seed: number): BufferGeometry {
  const g = new CylinderGeometry(r * 0.92, r, h, 9, 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = 1 + 0.12 * Math.sin(a * 3 + seed * 7) + 0.07 * Math.sin(a * 5 - seed * 3) + 0.05 * Math.sin(pos.getY(i) * 9 + seed);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
  }
  g.translate(0, h / 2, 0);
  return g;
}

export function buildItems(items: readonly SiteItem[], growth: GrowthUniforms): Items {
  const group = new Group();
  group.name = 'site:items';
  group.userData.records = items.map((i) => i.id);
  const materials: Material[] = [];
  const own = <T extends Material>(mat: T): T => {
    materials.push(mat);
    return mat;
  };
  // Linear gain above white on purpose: the stone map is dark (mean ≈ 0.1); this lands mid grey (≈ 120–150 sRGB) in sun.
  const granite = own(patchSite(new MeshStandardMaterial({ color: new Color().setScalar(2), roughness: 0.92, envMapIntensity: 1 }), { growth }));
  const shade = new Color();
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const at = (i: SiteItem, y: number): Vector3 => new Vector3(M(i.at[0]), M(i.baseMm) + y, M(i.at[1]));

  const boulders = items.filter((i) => i.kind === 'boulder');
  if (boulders.length > 0) {
    const mesh = new InstancedMesh(boulderGeometry(0.37), granite, boulders.length);
    boulders.forEach((b, i) => {
      const s = seedOf(b.id);
      const [w, d, h] = b.sizeMm;
      // Centre at ground level: about 35 % of the rock is under the lawn.
      m.compose(at(b, 0), q.setFromEuler(e.set((s - 0.5) * 0.3, s * 6.28, (seedOf(`${b.id}t`) - 0.5) * 0.3)), new Vector3(M(w) / 2, M(h) / 1.3, M(d) / 2));
      mesh.setMatrixAt(i, m);
      // ±12 % value, warm ↔ cool a touch, so no two rocks match.
      const v = 1 + (seedOf(`${b.id}c`) - 0.5) * 0.24;
      const warm = (seedOf(`${b.id}w`) - 0.5) * 0.08;
      mesh.setColorAt(i, shade.setRGB(v * (1 + warm), v, v * (1 - warm)));
    });
    mesh.name = 'site:boulders';
    mesh.userData.records = boulders.map((b) => b.id);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  const seats = items.filter((i) => i.kind === 'stone-stool' || i.kind === 'stone-table');
  if (seats.length > 0) {
    const parts = seats.flatMap((it) => {
      const [w, , h] = it.sizeMm;
      const p = at(it, 0);
      if (it.kind === 'stone-stool') {
        return [roughCylinder(M(w) / 2, M(h), seedOf(it.id)).translate(p.x, p.y, p.z)];
      }
      const top = new CylinderGeometry(M(w) / 2, M(w) / 2 - 0.02, 0.09, 20, 1).translate(p.x, p.y + M(h) - 0.045, p.z);
      return [top, roughCylinder(M(w) / 4, M(h) - 0.09, seedOf(it.id)).translate(p.x, p.y, p.z)];
    });
    const mesh = new Mesh(merge(parts), granite);
    mesh.name = 'site:stone-seats';
    mesh.userData.records = seats.map((s) => s.id);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const lights = items.filter((i) => i.kind === 'path-light');
  if (lights.length > 0) {
    const postMat = own(patchSite(new MeshStandardMaterial({ color: '#2F3236', roughness: 0.5, metalness: 0.6 }), { growth }));
    const headMat = own(new MeshBasicMaterial({ color: '#FFD9A0' }));
    const posts = new InstancedMesh(new CylinderGeometry(0.05, 0.06, 1, 8, 1).translate(0, 0.5, 0), postMat, lights.length);
    const heads = new InstancedMesh(new CylinderGeometry(0.045, 0.045, 0.07, 8, 1), headMat, lights.length);
    lights.forEach((l, i) => {
      const h = M(l.sizeMm[2]);
      posts.setMatrixAt(i, m.compose(at(l, 0), q.identity(), new Vector3(1, h - 0.08, 1)));
      heads.setMatrixAt(i, m.compose(at(l, h - 0.06), q.identity(), new Vector3(1, 1, 1)));
    });
    for (const [mesh, name] of [[posts, 'site:path-lights'], [heads, 'site:path-lights:glow']] as const) {
      mesh.name = name;
      mesh.userData.records = lights.map((l) => l.id);
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }

  const models = items.filter((i) => i.kind === 'model');
  const modelGroup = new Group();
  modelGroup.name = 'site:models';
  modelGroup.userData.records = models.map((i) => i.id);
  group.add(modelGroup);
  const slotMats = new Map<string, Material>();
  const finish = (slot: string): Material => {
    let mat = slotMats.get(slot);
    if (mat === undefined) {
      const f = SLOT_FINISH[slot] ?? DEFAULT_FINISH;
      mat = own(patchSite(slot === 'slot_body' ? new MeshPhysicalMaterial(CAR_PAINT) : new MeshStandardMaterial(f), { growth }));
      slotMats.set(slot, mat);
    }
    return mat;
  };
  const loaded: BufferGeometry[] = [];

  const place = (item: SiteItem, root: Object3D): void => {
    root.updateMatrixWorld(true);
    const holder = new Group();
    holder.name = `site:${item.id}`;
    root.traverse((o) => {
      if (o instanceof Mesh) {
        const src = o.material as Material | Material[];
        const geometry = (o.geometry as BufferGeometry).clone().applyMatrix4(o.matrixWorld);
        loaded.push(geometry);
        const mesh = new Mesh(geometry, finish(Array.isArray(src) ? (src[0]?.name ?? '') : src.name));
        mesh.castShadow = item.slug !== 'parking-spot';
        mesh.receiveShadow = true;
        holder.add(mesh);
      }
    });
    holder.updateMatrixWorld(true);
    const width = loaded.length > 0 ? boxWidth(holder) : 1;
    const s = width > 0 ? M(item.sizeMm[0]) / width : 1;
    holder.scale.setScalar(s);
    holder.rotation.y = FACING[item.facing];
    holder.position.set(M(item.at[0]), M(item.baseMm) + 0.012, M(item.at[1]));
    modelGroup.add(holder);
  };

  return {
    group,
    stone: granite,
    async load(assets, signal) {
      await Promise.allSettled(
        models.map(async (item) => {
          const root = await assets.load(item.modelUrl ?? `/pascal/items/${item.slug ?? ''}/model.glb`, signal);
          if (!signal.aborted) {
            place(item, root);
          }
        }),
      );
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) {
          (o.geometry as BufferGeometry).dispose();
        }
        if (o instanceof InstancedMesh) {
          o.dispose();
        }
      });
      for (const g of loaded) {
        g.dispose();
      }
      for (const mat of materials) {
        mat.dispose();
      }
    },
  };
}

/** Width along x of a holder's meshes in its own frame (before any scale). */
function boxWidth(holder: Group): number {
  let min = Infinity;
  let max = -Infinity;
  holder.traverse((o) => {
    if (o instanceof Mesh) {
      const g = o.geometry as BufferGeometry;
      g.computeBoundingBox();
      min = Math.min(min, g.boundingBox?.min.x ?? 0);
      max = Math.max(max, g.boundingBox?.max.x ?? 0);
    }
  });
  return max - min;
}
