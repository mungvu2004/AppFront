// @vitest-environment node
import { InstancedMesh, Mesh, Raycaster, Texture, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '@/lib/landing/house';
import { noAssetService, type SceneMaterials } from '@/lib/three/present';

import type { LandingState } from '../../../types';
import { createSite } from '..';
import { offset } from '../geo';

const state = (site: number, planting: number, water: number): LandingState =>
  ({ build: { site, planting, water } }) as unknown as LandingState;

const make = () =>
  createSite(LANDING_HOUSE, {
    materials: {} as SceneMaterials,
    anisotropy: 4,
    assets: noAssetService(),
    loadTexture: () => Promise.resolve(new Texture()),
  });

const meshes = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
};

const triangles = (m: Mesh): number => {
  const g = m.geometry as BufferGeometry;
  const tris = (g.index?.count ?? g.getAttribute('position').count) / 3;
  return tris * (m instanceof InstancedMesh ? m.count : 1);
};

describe('createSite', () => {
  it('draws every site record', async () => {
    const site = make();
    await site.ready;
    const drawn = new Set<string>();
    site.group.traverse((o) => {
      for (const id of (o.userData.records as string[] | undefined) ?? []) drawn.add(id);
    });
    const { site: s } = LANDING_HOUSE;
    const ids = [...s.walls, ...s.gates, ...s.surfaces, ...s.steps, ...s.water, ...s.plants, ...s.items].map((r) => r.id);
    expect(ids.filter((id) => !drawn.has(id))).toEqual([]);
    site.dispose();
  });

  it('stays inside the iGPU budget: ≤ 40 draws, ≤ 120k triangles', async () => {
    const site = make();
    await site.ready;
    const all = meshes(site.group);
    expect(all.length).toBeLessThanOrEqual(40);
    expect(all.reduce((n, m) => n + triangles(m), 0)).toBeLessThanOrEqual(120_000);
    site.dispose();
  });

  it('apply() only writes values: no new objects, materials or geometries', async () => {
    const site = make();
    await site.ready;
    const before = meshes(site.group).map((m) => [m, m.geometry, m.material] as const);
    site.apply(state(0.5, 0.5, 0.5));
    site.apply(state(1, 1, 1));
    const after = meshes(site.group).map((m) => [m, m.geometry, m.material] as const);
    expect(after.length).toBe(before.length);
    expect(after.every((t, i) => t.every((x, j) => x === before[i]?.[j]))).toBe(true);
    expect(site.group.visible).toBe(true);
    expect(site.ambient(1234)).toBe(true);
    site.apply(state(0, 0, 0));
    expect(site.group.visible).toBe(false);
    site.dispose();
  });

  it('fills the pond from its floor with build.water', () => {
    const site = make();
    const pond = site.group.getObjectByName('site:POND');
    site.apply(state(1, 1, 0.01));
    const low = pond?.position.y ?? 0;
    site.apply(state(1, 1, 1));
    expect(pond?.position.y).toBeCloseTo(-0.47);
    expect(low).toBeLessThan(-1.2);
    site.dispose();
  });

  it('dispose() frees every geometry, material and texture it made', async () => {
    const site = make();
    await site.ready;
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    for (const m of meshes(site.group)) {
      geometries.add(m.geometry as BufferGeometry);
      for (const mat of [m.material as Material | Material[]].flat()) materials.add(mat);
      if (m.customDepthMaterial !== undefined) materials.add(m.customDepthMaterial);
    }
    const textures = new Set<Texture>();
    for (const mat of materials) {
      for (const v of Object.values(mat)) if (v instanceof Texture) textures.add(v);
    }
    expect(textures.size).toBeGreaterThanOrEqual(4);
    let freed = 0;
    for (const x of [...geometries, ...materials, ...textures]) x.addEventListener('dispose', () => (freed += 1));
    site.dispose();
    expect(freed).toBe(geometries.size + materials.size + textures.size);
    expect(site.group.children).toHaveLength(0);
  });

  it('cuts the ponds out of the ground: no lawn or base under the water', () => {
    const site = make();
    const lawn = site.group.getObjectByName('site:lawn') as Mesh;
    const pos = (lawn.geometry as BufferGeometry).getAttribute('position');
    // Open water west and east of the island and the stepping slabs (scene x, z).
    const probes = [[14.5, 26.5], [24, 26.5], [22.5, 30.5]] as const;
    const cross = (ax: number, az: number, bx: number, bz: number, px: number, pz: number): number => (bx - ax) * (pz - az) - (bz - az) * (px - ax);
    for (const [px, pz] of probes) {
      for (let i = 0; i < pos.count; i += 3) {
        const [ax, az, bx, bz, cx, cz] = [pos.getX(i), pos.getZ(i), pos.getX(i + 1), pos.getZ(i + 1), pos.getX(i + 2), pos.getZ(i + 2)];
        const d = [cross(ax, az, bx, bz, px, pz), cross(bx, bz, cx, cz, px, pz), cross(cx, cz, ax, az, px, pz)];
        const hit = d.every((x) => x >= 0) || d.every((x) => x <= 0);
        expect(hit && pos.getY(i) < 0, `lawn triangle ${String(i / 3)} under the water at ${String([px, pz])}`).toBe(false);
      }
    }
    // The basin walls face the water (front faces: the raycaster skips back faces).
    site.apply(state(1, 1, 1));
    site.group.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(24, -1, 27), new Vector3(0, 0, -1));
    expect(ray.intersectObject(site.group, true)[0]?.object.name).toBe('site:site:POND:liner');
    // The model base: the plot plus 1.5 m, no ground running off to the horizon.
    lawn.geometry.computeBoundingBox();
    expect(lawn.geometry.boundingBox?.min.x).toBeCloseTo(-1.5);
    expect(lawn.geometry.boundingBox?.max.z).toBeCloseTo(35.5);
    site.dispose();
  });

  it('offsets a polygon outward either winding', () => {
    const sq = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] as const;
    expect(offset(sq, 100)[0]).toEqual([-100, -100]);
    expect(offset([...sq].reverse(), 100)[0]).toEqual([-100, 1100]);
  });
});
