import { Box3, BoxGeometry, BufferGeometry, Group, Light, Matrix4, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assembleHouse } from '../assemble';
import { createMaterials, type SceneMaterials } from '../materials';
import { concatGeometries, isBatchable, mergeStatic } from '../merge';
import { readPalette, type ScenePalette } from '../palette';

import { fakeAssets, FIXTURE_PLAN, stubCanvasContext, withModel } from './fixtures';

let palette: ScenePalette;
let materials: SceneMaterials;

beforeEach(() => {
  stubCanvasContext();
  palette = readPalette(() => '');
  materials = createMaterials(palette);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function countMeshes(root: Group): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh) {
      count += 1;
    }
  });
  return count;
}

describe('mergeStatic through assembleHouse', () => {
  it('folds the static meshes into a few batches and keeps the lights and decals', () => {
    const loose = assembleHouse(FIXTURE_PLAN, palette, materials, { batch: false });
    const batched = assembleHouse(FIXTURE_PLAN, palette, materials);

    expect(countMeshes(batched.house)).toBeLessThan(countMeshes(loose.house) / 2);

    const batches = batched.house.children.filter((child) => child.name === 'batch');
    expect(batches.length).toBeGreaterThan(0);
    const surfaces = new Set(Object.values(materials));
    for (const batch of batches) {
      expect(batch).toBeInstanceOf(Mesh);
      expect(surfaces.has((batch as Mesh).material as MeshStandardMaterial)).toBe(true);
    }

    // The floor lamp's light is untouched; the bed's contact shadow, a decal,
    // is folded into a batch of its own material, in its own render order.
    const lamp = batched.house.getObjectByName('F-LAMP')!;
    const bed = batched.house.getObjectByName('F-BED')!;
    expect(lamp.getObjectByProperty('isLight', true)).toBeInstanceOf(Light);
    expect(bed.getObjectByName('contactShadow')).toBeUndefined();
    expect(countMeshes(bed as Group)).toBe(0);
    const decals = batches.filter((batch) => (batch as Mesh).material === materials.contactShadow);
    expect(decals).toHaveLength(1);
    expect(decals[0]?.renderOrder).toBe(1);
    expect(decals[0]?.castShadow).toBe(false);
  });

  it('draws exactly what it folded: the house covers the same box', () => {
    const loose = assembleHouse(FIXTURE_PLAN, palette, materials, { batch: false });
    const batched = assembleHouse(FIXTURE_PLAN, palette, materials);

    const before = new Box3().setFromObject(loose.house);
    const after = new Box3().setFromObject(batched.house);
    expect(after.min.distanceTo(before.min)).toBeLessThan(0.001);
    expect(after.max.distanceTo(before.max)).toBeLessThan(0.001);
  });

  it('keeps a shadow setting per batch rather than averaging it', () => {
    const plan = {
      ...FIXTURE_PLAN,
      furniture: [
        ...FIXTURE_PLAN.furniture,
        { id: 'F-RUG', variant: 'rug', centreMm: [1500, 1000], sizeMm: [1600, 1200, 10], facing: 'north' },
      ],
    };
    const { house } = assembleHouse(plan, palette, materials);

    const fabricBatches = house.children.filter(
      (child) => child instanceof Mesh && child.name === 'batch' && child.material === materials.fabric,
    ) as Mesh[];
    // The rug's mat casts no shadow; the bed's pillows in the same material do.
    expect(fabricBatches.map((batch) => batch.castShadow).sort()).toEqual([false, true]);
  });

  it('leaves a piece that may still become a model with its own meshes', () => {
    const plan = { ...FIXTURE_PLAN, furniture: [withModel(FIXTURE_PLAN.furniture[1]!, '/chair.glb')] };
    const { house } = assembleHouse(plan, palette, materials, { assets: fakeAssets('never') });

    expect(countMeshes(house.getObjectByName('F-CHAIR') as Group)).toBeGreaterThan(1);
  });
});

describe('isBatchable', () => {
  it('takes an opaque single-material mesh with position, normal and uv, and nothing else', () => {
    const geometry = new BoxGeometry(1, 1, 1);

    expect(isBatchable(new Mesh(geometry, materials.wood))).toBe(true);
    expect(isBatchable(new Mesh(geometry, materials.glass))).toBe(false);
    expect(isBatchable(new Mesh(geometry, [materials.wood, materials.cut]))).toBe(false);

    const bare = new BufferGeometry();
    bare.setAttribute('position', geometry.getAttribute('position'));
    expect(isBatchable(new Mesh(bare, materials.wood))).toBe(false);
  });

  it('takes a decal — transparent but writing no depth — and refuses transparent glass', () => {
    const geometry = new BoxGeometry(1, 1, 1);

    expect(isBatchable(new Mesh(geometry, materials.contactShadow!))).toBe(true);
    expect(isBatchable(new Mesh(geometry, materials.lightPool!))).toBe(true);
    expect(isBatchable(new Mesh(geometry, materials.glass))).toBe(false);
  });
});

describe('concatGeometries', () => {
  it('moves each source by its matrix and offsets the indices', () => {
    const unit = new BoxGeometry(1, 1, 1);
    const merged = concatGeometries([
      { geometry: unit, matrix: new Matrix4().makeTranslation(0, 0, 0) },
      { geometry: unit, matrix: new Matrix4().makeTranslation(10, 0, 0) },
    ]);

    expect(merged.getAttribute('position').count).toBe(unit.getAttribute('position').count * 2);
    expect(merged.getIndex()?.count).toBe((unit.getIndex()?.count ?? 0) * 2);

    const bounds = merged.boundingBox!;
    expect(bounds.min.x).toBeCloseTo(-0.5);
    expect(bounds.max.x).toBeCloseTo(10.5);

    const indices = merged.getIndex()!.array;
    const lastOfFirst = Math.max(...Array.from(indices.subarray(0, indices.length / 2)));
    const firstOfSecond = Math.min(...Array.from(indices.subarray(indices.length / 2)));
    expect(firstOfSecond).toBe(lastOfFirst + 1);
  });

  it('accepts a source with no index by numbering its vertices', () => {
    const flat = new BoxGeometry(1, 1, 1).toNonIndexed();
    const merged = concatGeometries([{ geometry: flat, matrix: new Matrix4() }]);

    expect(merged.getIndex()?.count).toBe(flat.getAttribute('position').count);
  });

  it('indexes with sixteen bits while the vertices fit, and thirty-two past that', () => {
    const unit = new BoxGeometry(1, 1, 1);
    const small = concatGeometries([{ geometry: unit, matrix: new Matrix4() }]);
    expect(small.getIndex()?.array).toBeInstanceOf(Uint16Array);

    // 24 vertices a box: 2 731 boxes is 65 544, one past the 16-bit limit.
    const many = Array.from({ length: 2731 }, () => ({ geometry: unit, matrix: new Matrix4() }));
    const large = concatGeometries(many);
    expect(large.getIndex()?.array).toBeInstanceOf(Uint32Array);
    expect(large.getAttribute('position').count).toBe(24 * 2731);
  });
});

describe('mergeStatic on its own', () => {
  it('bakes the world matrix relative to the target and removes the originals', () => {
    const house = new Group();
    const piece = new Group();
    piece.position.set(5, 0, 0);
    piece.rotation.y = Math.PI / 2;
    const part = new Mesh(new BoxGeometry(1, 1, 1), materials.wood);
    part.position.set(0, 0.5, 2);
    piece.add(part);
    house.add(piece);

    const report = mergeStatic([piece], house);

    expect(report.merged).toBe(1);
    expect(report.batches).toHaveLength(1);
    expect(part.parent).toBeNull();
    expect(piece.children).toHaveLength(0);

    // Local (0, 0.5, 2) under a quarter turn at x = 5 lands at (7, 0.5, 0).
    const centre = new Box3().setFromObject(report.batches[0]!).getCenter(new Vector3());
    expect(centre.x).toBeCloseTo(7);
    expect(centre.y).toBeCloseTo(0.5);
    expect(centre.z).toBeCloseTo(0);
  });
});
