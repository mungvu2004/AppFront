/**
 * The geometry cache, from both ends: the pure hashing that decides identity,
 * the IndexedDB store that must never throw, and `assembleHouse` restoring a
 * stored assembly so a warm mount draws exactly what a cold one did.
 */

import 'fake-indexeddb/auto';
import { Box3, Group, Mesh, type Material, type Object3D } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assembleHouse } from '../assemble';
import {
  createGeometryCache,
  hashNumbers,
  hashString,
  planCacheKey,
  type CachedAssembly,
} from '../geometryCache';
import { createMaterials, materialRoles, type SceneMaterials } from '../materials';
import { hydrateBatches } from '../merge';
import { readPalette, type ScenePalette } from '../palette';

import { FIXTURE_PLAN, stubCanvasContext } from './fixtures';

let palette: ScenePalette;
let materials: SceneMaterials;

/** The restore-time direction of `materialRoles`: role name to material. */
function rolesToMaterials(set: SceneMaterials): Map<string, Material> {
  return new Map([...materialRoles(set)].map(([material, role]) => [role, material] as const));
}

const deleteDatabase = (): Promise<void> =>
  new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('digitwin-presentation');
    request.onsuccess = request.onerror = request.onblocked = () => {
      resolve();
    };
  });

beforeEach(() => {
  stubCanvasContext();
  palette = readPalette(() => '');
  materials = createMaterials(palette);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await deleteDatabase();
});

/* -------------------------------------------------------------------------- */
/* Hashing.                                                                    */
/* -------------------------------------------------------------------------- */

describe('hashing', () => {
  it('is deterministic and moves with its input', () => {
    expect(hashString('plaster')).toBe(hashString('plaster'));
    expect(hashString('plaster')).not.toBe(hashString('plaster '));
    expect(hashNumbers(1, [1, 2, 3])).toBe(hashNumbers(1, [1, 2, 3]));
    expect(hashNumbers(1, [1, 2, 3])).not.toBe(hashNumbers(1, [1, 2, 4]));
  });

  it('quantises away float noise below a tenth of a millimetre, and keeps real edits', () => {
    expect(hashNumbers(1, [1.000000004])).toBe(hashNumbers(1, [1]));
    expect(hashNumbers(1, [1.0002])).not.toBe(hashNumbers(1, [1]));
  });

  it('keys a plan by its content and the light budget', () => {
    const key = planCacheKey(FIXTURE_PLAN, 8);

    expect(key).toBe(planCacheKey(FIXTURE_PLAN, 8));
    expect(key).toMatch(/^plan-[0-9a-f]+$/);
    expect(planCacheKey(FIXTURE_PLAN, 7)).not.toBe(key);
    expect(planCacheKey({ ...FIXTURE_PLAN, name: 'khác' }, 8)).not.toBe(key);
  });
});

/* -------------------------------------------------------------------------- */
/* The store.                                                                  */
/* -------------------------------------------------------------------------- */

function smallAssembly(): CachedAssembly {
  return {
    fingerprint: 42,
    batches: [
      {
        role: 'plaster',
        castShadow: true,
        receiveShadow: false,
        renderOrder: 2,
        index: new Uint16Array([0, 1, 2]),
        attributes: {
          position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3 },
        },
      },
    ],
  };
}

describe('createGeometryCache', () => {
  it('round-trips an assembly, typed arrays intact, and misses on an absent key', async () => {
    const cache = createGeometryCache();
    const assembly = smallAssembly();

    await cache.store('k', assembly);
    const back = await cache.load('k');

    expect(back).not.toBeNull();
    expect(back).not.toBe(assembly);
    expect(back?.fingerprint).toBe(42);
    // The clone may come back from another realm; check shape, not identity.
    expect(back?.batches[0]?.index.constructor.name).toBe('Uint16Array');
    expect(Array.from(back?.batches[0]?.index ?? [])).toEqual([0, 1, 2]);
    expect(back?.batches[0]?.attributes['position']?.array.constructor.name).toBe('Float32Array');
    expect(back?.batches[0]?.renderOrder).toBe(2);

    await expect(cache.load('other')).resolves.toBeNull();
  });

  it('treats an entry with the wrong shape as a miss', async () => {
    const cache = createGeometryCache();

    await cache.store('k', { nope: true } as unknown as CachedAssembly);

    await expect(cache.load('k')).resolves.toBeNull();
  });

  it('misses quietly with no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const cache = createGeometryCache();

    await expect(cache.load('k')).resolves.toBeNull();
    await expect(cache.store('k', smallAssembly())).resolves.toBeUndefined();
  });

  it('misses quietly when the factory refuses to open', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('từ chối');
      },
    });
    const cache = createGeometryCache();

    await expect(cache.load('k')).resolves.toBeNull();
    await expect(cache.store('k', smallAssembly())).resolves.toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Restoring through assembleHouse.                                            */
/* -------------------------------------------------------------------------- */

function countMeshes(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh) {
      count += 1;
    }
  });
  return count;
}

function batchesOf(root: Object3D): Mesh[] {
  return root.children.filter((child): child is Mesh => child instanceof Mesh && child.name === 'batch');
}

/** What the store would hand back: through fake-indexeddb, sharing nothing. */
let tripCount = 0;
async function roundTripped(assembly: CachedAssembly | null): Promise<CachedAssembly> {
  if (assembly === null) {
    throw new Error('cold assembly missing');
  }
  const cache = createGeometryCache();
  const key = `test-trip-${(tripCount += 1)}`;
  await cache.store(key, assembly);
  const back = await cache.load(key);
  if (back === null) {
    throw new Error('round trip lost the assembly');
  }
  return back;
}

describe('assembleHouse with a cached assembly', () => {
  it('restores the batches instead of baking: same meshes, same box, same roles and flags', async () => {
    const cold = assembleHouse(FIXTURE_PLAN, palette, materials);
    expect(cold.geometryRestored).toBe(false);
    expect(cold.geometry).not.toBeNull();

    const warmMaterials = createMaterials(palette);
    const warm = assembleHouse(FIXTURE_PLAN, palette, warmMaterials, {
      cachedGeometry: await roundTripped(cold.geometry),
    });

    expect(warm.geometryRestored).toBe(true);
    expect(warm.geometry?.fingerprint).toBe(cold.geometry?.fingerprint);
    expect(countMeshes(warm.house)).toBe(countMeshes(cold.house));

    const coldBox = new Box3().setFromObject(cold.house);
    const warmBox = new Box3().setFromObject(warm.house);
    expect(warmBox.min.distanceTo(coldBox.min)).toBeLessThan(0.001);
    expect(warmBox.max.distanceTo(coldBox.max)).toBeLessThan(0.001);

    // Each restored batch wears THIS mount's material for the stored role, and
    // keeps the stored flags — shadows, render order, baked occlusion colours.
    const coldBatches = batchesOf(cold.house);
    const warmBatches = batchesOf(warm.house);
    const coldRoles = materialRoles(materials);
    expect(warmBatches).toHaveLength(coldBatches.length);
    const describeBatch = (batch: Mesh, roles: ReadonlyMap<Material, string>): string =>
      `${roles.get(batch.material as Material) ?? '?'}|${batch.castShadow ? 'c' : ''}${batch.receiveShadow ? 'r' : ''}|${batch.renderOrder}|${batch.geometry.getAttribute('position').count}|${batch.geometry.hasAttribute('color') ? 'ao' : ''}`;
    const warmRoles = materialRoles(warmMaterials);
    expect(warmBatches.map((batch) => describeBatch(batch, warmRoles)).sort()).toEqual(
      coldBatches.map((batch) => describeBatch(batch, coldRoles)).sort(),
    );
    const warmByRole = rolesToMaterials(warmMaterials);
    for (const batch of warmBatches) {
      expect(warmByRole.get(warmRoles.get(batch.material as Material) ?? '?')).toBe(batch.material);
    }
  });

  it('lets the plan invalidate the fingerprint: one piece moved a hair is a miss', async () => {
    const cold = assembleHouse(FIXTURE_PLAN, palette, materials);

    const moved = {
      ...FIXTURE_PLAN,
      furniture: [
        { ...FIXTURE_PLAN.furniture[0]!, centreMm: [1501, 2000] },
        ...FIXTURE_PLAN.furniture.slice(1),
      ],
    };
    const warm = assembleHouse(moved, palette, createMaterials(palette), {
      cachedGeometry: await roundTripped(cold.geometry),
    });

    expect(warm.geometryRestored).toBe(false);
    expect(warm.geometry?.fingerprint).not.toBe(cold.geometry?.fingerprint);
  });

  it('lets the geometry invalidate the fingerprint: a different vertex count is a miss', async () => {
    const cold = assembleHouse(FIXTURE_PLAN, palette, materials);

    const swapped = {
      ...FIXTURE_PLAN,
      furniture: [
        { ...FIXTURE_PLAN.furniture[1]!, variant: 'stool' },
        ...FIXTURE_PLAN.furniture.filter((entry) => entry.id !== FIXTURE_PLAN.furniture[1]!.id),
      ],
    };
    const warm = assembleHouse(swapped, palette, createMaterials(palette), {
      cachedGeometry: await roundTripped(cold.geometry),
    });

    expect(warm.geometryRestored).toBe(false);
    expect(warm.geometry?.fingerprint).not.toBe(cold.geometry?.fingerprint);
  });

  it('falls back to a cold bake when a stored role has no material any more', async () => {
    const cold = assembleHouse(FIXTURE_PLAN, palette, materials);
    const tampered = await roundTripped(cold.geometry);
    (tampered.batches[0]! as { role: string }).role = 'notARole';

    const warm = assembleHouse(FIXTURE_PLAN, palette, createMaterials(palette), { cachedGeometry: tampered });

    expect(warm.geometryRestored).toBe(false);
    expect(countMeshes(warm.house)).toBe(countMeshes(cold.house));
  });
});

describe('hydrateBatches', () => {
  it('leaves nothing behind when a role is unknown', () => {
    const into = new Group();
    const cached: CachedAssembly = {
      fingerprint: 1,
      batches: [smallAssembly().batches[0]!, { ...smallAssembly().batches[0]!, role: 'notARole' }],
    };

    const added = hydrateBatches(cached, rolesToMaterials(materials), into);

    expect(added).toBeNull();
    expect(into.children).toHaveLength(0);
  });
});
