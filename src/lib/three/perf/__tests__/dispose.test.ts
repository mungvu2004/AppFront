import {
  BoxGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  type BufferGeometry,
  type Material,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { OpeningId, RoomId, WallId } from '@/domain/spatial/types';

import { readPartData, type BuildPartKind } from '../../build/scene';
import {
  buildFloorMesh,
  type BuildFloorInput,
  type BuildableLevel,
  type BuildableRoom,
} from '../../build/floor';
import { buildFloorLod } from '../../build/lod';
import { collectMeshes } from '../../build/merge';
import { measureScene } from '../budget';
import { disposeFloor, ResourceLedger, type LeakWarning } from '../dispose';
import { MaterialCache, paintByPartKind, sharedMaterialCache } from '../materialCache';

/* -------------------------------------------------------------------------- */
/* Fixtures: the standard sample plan, 48 / 21 / 34 / 14 / 4.                  */
/* -------------------------------------------------------------------------- */

const WALL_COUNT = 48;
const OPENING_COUNT = 34;
const ROOM_COUNT = 14;

/** Walls, opening panels, floor slabs and ceilings: one geometry each. */
const STOREY_GEOMETRIES = WALL_COUNT + OPENING_COUNT + 2 * ROOM_COUNT;

/** How many part kinds a storey has, and therefore how many shared materials. */
const STOREY_KINDS = 4;

/** How many times the verification case swaps the storey. */
const SWAP_COUNT = 20;

const LEVEL: BuildableLevel = {
  id: 'L-01',
  elevationMm: millimetres(0),
  heightMm: millimetres(3000),
};

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function twoDigits(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

const WALLS: readonly Wall[] = Array.from({ length: WALL_COUNT }, (_unused, index): Wall => {
  const alongMm = Math.floor(index / 6) * 5000;
  const acrossMm = (index % 6) * 6000;

  return {
    id: `W-${twoDigits(index + 1)}` as WallId,
    kind: 'partition',
    centreline: { start: pointAt(alongMm, acrossMm), end: pointAt(alongMm + 4000, acrossMm) },
    thicknessMm: millimetres(200),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
});

const OPENINGS: readonly AttachedOpening[] = Array.from(
  { length: OPENING_COUNT },
  (_unused, index): AttachedOpening => ({
    id: `D-${twoDigits(index + 1)}` as OpeningId,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2100),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: `W-${twoDigits(index + 1)}` as WallId,
    relativePosition: 0.5,
  }),
);

const ROOMS: readonly BuildableRoom[] = Array.from(
  { length: ROOM_COUNT },
  (_unused, index): BuildableRoom => {
    const offsetMm = index * 6000;
    return {
      id: `R-${twoDigits(index + 1)}` as RoomId,
      outline: [
        pointAt(offsetMm, 0),
        pointAt(offsetMm + 5000, 0),
        pointAt(offsetMm + 5000, 4000),
        pointAt(offsetMm, 4000),
      ],
    };
  },
);

const STOREY: BuildFloorInput = { level: LEVEL, walls: WALLS, rooms: ROOMS, openings: OPENINGS };

/** A material the tests can tell apart, without deciding a colour. */
function plainMaterial(): Material {
  return new MeshStandardMaterial();
}

function meshesOfKind(root: Group, kind: BuildPartKind): readonly Mesh[] {
  return collectMeshes(root).filter((mesh) => readPartData(mesh)?.kind === kind);
}

/* -------------------------------------------------------------------------- */
/* The verification cases.                                                     */
/* -------------------------------------------------------------------------- */

describe('swapping storeys', () => {
  it('returns the live geometry count to where it started after twenty swaps', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();
    const baseline = ledger.counts.geometries;

    let current: Group | null = null;

    for (let swap = 0; swap < SWAP_COUNT; swap += 1) {
      const next = buildFloorMesh(STOREY);
      scene.add(next);
      ledger.track(next);

      if (current !== null) {
        disposeFloor(current);
      }
      current = next;
    }

    // Only the storey on screen is still alive, whichever swap we are on.
    expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);
    expect(current).not.toBeNull();

    if (current !== null) {
      disposeFloor(current);
    }

    expect(ledger.counts.geometries).toBe(baseline);
    expect(ledger.counts.materials).toBe(0);
    expect(scene.children).toHaveLength(0);
  });

  it('piles up twenty storeys worth of geometry when nothing is closed', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();

    for (let swap = 0; swap < SWAP_COUNT; swap += 1) {
      const next = buildFloorMesh(STOREY);
      scene.add(next);
      ledger.track(next);
    }

    // The failure this module exists to prevent, stated as a number.
    expect(ledger.counts.geometries).toBe(SWAP_COUNT * STOREY_GEOMETRIES);
  });

  it('warns that the count is climbing when storeys are not closed', () => {
    const ledger = new ResourceLedger();
    const raised: string[] = [];

    for (let swap = 0; swap < 6; swap += 1) {
      ledger.track(buildFloorMesh(STOREY));
      for (const warning of ledger.sample()) {
        raised.push(warning.resource);
      }
    }

    expect(raised).toEqual(['geometries', 'materials']);
  });

  it('stays quiet when every storey is closed behind the last', () => {
    const ledger = new ResourceLedger();
    const raised: string[] = [];
    let current: Group | null = null;

    for (let swap = 0; swap < 6; swap += 1) {
      const next = buildFloorMesh(STOREY);
      ledger.track(next);
      if (current !== null) {
        disposeFloor(current);
      }
      current = next;

      for (const warning of ledger.sample()) {
        raised.push(warning.resource);
      }
    }

    expect(raised).toEqual([]);
  });
});

describe('paintByPartKind', () => {
  it('gives two walls of the same kind one material between them', () => {
    const cache = new MaterialCache();
    const storey = buildFloorMesh(STOREY);

    paintByPartKind(storey, cache, plainMaterial);
    const walls = meshesOfKind(storey, 'wall');

    expect(walls).toHaveLength(WALL_COUNT);
    expect(walls[0]?.material).toBe(walls[1]?.material);
    expect(new Set(walls.map((wall) => wall.material)).size).toBe(1);
  });

  it('gives each part kind its own material, and no more than that', () => {
    const cache = new MaterialCache();
    const storey = buildFloorMesh(STOREY);

    const painted = paintByPartKind(storey, cache, plainMaterial);

    expect(painted.size).toBe(STOREY_KINDS);
    expect(cache.size).toBe(STOREY_KINDS);
    expect([...cache.keys()].sort()).toEqual(['ceiling', 'floorSlab', 'opening', 'wall']);
    expect(measureScene(storey).materials).toBe(STOREY_KINDS);
  });

  it('takes one reference per kind, not one per mesh', () => {
    const cache = new MaterialCache();
    const storey = buildFloorMesh(STOREY);
    const painted = paintByPartKind(storey, cache, plainMaterial);
    const wallMaterial = painted.get('wall');

    expect(wallMaterial).toBeDefined();
    expect(cache.refCount(wallMaterial as Material)).toBe(1);
  });

  it('leaves a mesh that carries no part data exactly as it was', () => {
    const cache = new MaterialCache();
    const group = new Group();
    const gizmo = new Mesh(new BoxGeometry(1, 1, 1), plainMaterial());
    const before = gizmo.material;
    group.add(gizmo);

    paintByPartKind(group, cache, plainMaterial);

    expect(gizmo.material).toBe(before);
    expect(cache.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* disposeFloor.                                                               */
/* -------------------------------------------------------------------------- */

describe('disposeFloor', () => {
  it('leaves no geometry behind, and says how many it freed', () => {
    const ledger = new ResourceLedger();
    const storey = buildFloorMesh(STOREY);
    ledger.track(storey);

    const report = disposeFloor(storey);

    expect(report.geometries).toBe(STOREY_GEOMETRIES);
    expect(ledger.counts.geometries).toBe(0);
    expect(ledger.counts.materials).toBe(0);
  });

  it('frees a geometry shared by several meshes exactly once', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const dispose = vi.spyOn(geometry, 'dispose');
    const group = new Group();
    group.add(new Mesh(geometry, plainMaterial()));
    group.add(new Mesh(geometry, plainMaterial()));

    const report = disposeFloor(group);

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(report.geometries).toBe(1);
  });

  it('frees a hidden mesh, which holds the same buffer a visible one does', () => {
    const ledger = new ResourceLedger();
    const group = new Group();
    const hidden = new Mesh(new BoxGeometry(1, 1, 1), plainMaterial());
    hidden.visible = false;
    group.add(hidden);
    group.visible = false;
    ledger.track(group);

    expect(ledger.counts.geometries).toBe(1);
    disposeFloor(group);
    expect(ledger.counts.geometries).toBe(0);
  });

  it('takes the storey out of the scene and empties it', () => {
    const scene = new Group();
    const storey = buildFloorMesh(STOREY);
    scene.add(storey);

    disposeFloor(storey);

    expect(scene.children).toHaveLength(0);
    expect(storey.parent).toBeNull();
    expect(storey.children).toHaveLength(0);
  });

  it('leaves the storey attached when it is told to', () => {
    const scene = new Group();
    const storey = buildFloorMesh(STOREY);
    scene.add(storey);

    disposeFloor(storey, { detach: false });

    expect(scene.children).toHaveLength(1);
  });

  it('frees all three rungs of an LOD and empties its level list', () => {
    const ledger = new ResourceLedger();
    const lod = buildFloorLod(STOREY);
    ledger.track(lod);

    expect(lod.levels).toHaveLength(3);
    expect(ledger.counts.geometries).toBeGreaterThan(STOREY_GEOMETRIES);

    disposeFloor(lod);

    expect(ledger.counts.geometries).toBe(0);
    expect(lod.levels).toHaveLength(0);
    expect(lod.children).toHaveLength(0);
  });

  it('never frees a sprite geometry, which three shares with every sprite', () => {
    const sprite = new Sprite();
    const geometry = sprite.geometry;
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(sprite.material, 'dispose');

    const group = new Group();
    group.add(sprite);
    const report = disposeFloor(group);

    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(report.geometries).toBe(0);
    expect(new Sprite().geometry).toBe(geometry);
  });

  it('frees an instanced mesh geometry as well as the mesh itself', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const instanced = new InstancedMesh(geometry, plainMaterial(), 8);
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMesh = vi.spyOn(instanced, 'dispose');

    const group = new Group();
    group.add(instanced);
    disposeFloor(group);

    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMesh).toHaveBeenCalledTimes(1);
  });

  it('frees the textures of a material it owns', () => {
    const texture = new DataTexture(new Uint8Array(4), 1, 1);
    const material = new MeshStandardMaterial();
    material.map = texture;
    const disposeTexture = vi.spyOn(texture, 'dispose');

    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), material));
    const report = disposeFloor(group);

    expect(disposeTexture).toHaveBeenCalledTimes(1);
    expect(report.textures).toBe(1);
  });

  it('leaves materials alone when it is told to free only geometry', () => {
    const material = plainMaterial();
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), material));

    const report = disposeFloor(group, { disposeMaterials: false });

    expect(disposeMaterial).not.toHaveBeenCalled();
    expect(report.geometries).toBe(1);
    expect(report.materials).toBe(0);
  });

  it('keeps a geometry the caller asked to keep, and frees the rest', () => {
    const shared = new BoxGeometry(1, 1, 1);
    const own = new BoxGeometry(1, 1, 1);
    const disposeShared = vi.spyOn(shared, 'dispose');
    const disposeOwn = vi.spyOn(own, 'dispose');

    const group = new Group();
    group.add(new Mesh(shared, plainMaterial()));
    group.add(new Mesh(own, plainMaterial()));

    const report = disposeFloor(group, { retain: new Set([shared]) });

    expect(disposeShared).not.toHaveBeenCalled();
    expect(disposeOwn).toHaveBeenCalledTimes(1);
    expect(report.geometries).toBe(1);
    expect(report.retained).toBe(1);
  });

  it('keeps a retained material, cache or no cache', () => {
    const cache = new MaterialCache();
    const kept = cache.acquire('wall', plainMaterial);
    const dispose = vi.spyOn(kept, 'dispose');

    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), kept));

    const report = disposeFloor(group, { materials: cache, retain: new Set([kept]) });

    expect(dispose).not.toHaveBeenCalled();
    expect(report.released).toBe(0);
    expect(report.retained).toBe(1);
    expect(cache.refCount(kept)).toBe(1);
  });

  it('lets a merged batch outlive the meshes it borrowed its geometry from', () => {
    // The arrangement merge.ts makes: the instanced batch draws the very geometry
    // object its sources hold, so closing the sources would kill the batch.
    const ledger = new ResourceLedger();
    const shared = new BoxGeometry(1, 1, 1);
    const material = plainMaterial();

    const sources = new Group();
    sources.add(new Mesh(shared, material));
    sources.add(new Mesh(shared, material));

    const batch = new InstancedMesh(shared, material, 2);
    const batched = new Group();
    batched.add(batch);
    ledger.track(batched);

    disposeFloor(sources, { retain: new Set<BufferGeometry | Material>([shared, material]) });

    // The batch is still drawable: nothing it uses has been freed.
    expect(ledger.counts.geometries).toBe(1);
    expect(ledger.counts.materials).toBe(1);

    disposeFloor(batched);

    expect(ledger.counts.geometries).toBe(0);
    expect(ledger.counts.materials).toBe(0);
  });

  it('can be called twice without breaking anything', () => {
    const storey = buildFloorMesh(STOREY);

    const first = disposeFloor(storey);
    const second = disposeFloor(storey);

    expect(first.geometries).toBe(STOREY_GEOMETRIES);
    // Everything was already detached and emptied, so there is nothing left to walk.
    expect(second.geometries).toBe(0);
    expect(second.objects).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Shared materials must outlive the storey that let go first.                 */
/* -------------------------------------------------------------------------- */

describe('disposeFloor with a material cache', () => {
  it('keeps a shared material alive while another storey still draws with it', () => {
    const cache = new MaterialCache();
    const first = buildFloorMesh(STOREY);
    const second = buildFloorMesh(STOREY);

    paintByPartKind(first, cache, plainMaterial);
    paintByPartKind(second, cache, plainMaterial);

    const wallMaterial = meshesOfKind(second, 'wall')[0]?.material as Material;
    const dispose = vi.spyOn(wallMaterial, 'dispose');
    expect(cache.refCount(wallMaterial)).toBe(2);

    const report = disposeFloor(first, { materials: cache });

    expect(report.released).toBe(STOREY_KINDS);
    expect(report.materials).toBe(0);
    expect(dispose).not.toHaveBeenCalled();
    expect(cache.refCount(wallMaterial)).toBe(1);
    expect(cache.size).toBe(STOREY_KINDS);
  });

  it('frees the shared material when the last storey lets go of it', () => {
    const cache = new MaterialCache();
    const first = buildFloorMesh(STOREY);
    const second = buildFloorMesh(STOREY);

    paintByPartKind(first, cache, plainMaterial);
    paintByPartKind(second, cache, plainMaterial);

    const wallMaterial = meshesOfKind(second, 'wall')[0]?.material as Material;
    const dispose = vi.spyOn(wallMaterial, 'dispose');

    disposeFloor(first, { materials: cache });
    const report = disposeFloor(second, { materials: cache });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(report.materials).toBe(STOREY_KINDS);
    expect(cache.size).toBe(0);
  });

  it('disposes a material the cache never issued, and releases the ones it did', () => {
    const cache = new MaterialCache();
    const group = new Group();
    const owned = cache.acquire('wall', plainMaterial);
    const loose = plainMaterial();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), owned));
    group.add(new Mesh(new BoxGeometry(1, 1, 1), loose));

    const disposeLoose = vi.spyOn(loose, 'dispose');
    const report = disposeFloor(group, { materials: cache });

    expect(disposeLoose).toHaveBeenCalledTimes(1);
    expect(report.released).toBe(1);
    expect(report.materials).toBe(2);
    expect(cache.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* MaterialCache.                                                              */
/* -------------------------------------------------------------------------- */

describe('MaterialCache', () => {
  it('makes a material once and hands the same one back after that', () => {
    const cache = new MaterialCache();
    const create = vi.fn(plainMaterial);

    const first = cache.acquire('wall', create);
    const second = cache.acquire('wall', create);

    expect(second).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
    expect(cache.refCount(first)).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('frees a material only on the release that takes it to zero', () => {
    const cache = new MaterialCache();
    const material = cache.acquire('wall', plainMaterial);
    cache.acquire('wall', plainMaterial);
    const dispose = vi.spyOn(material, 'dispose');

    expect(cache.release(material)).toBe(false);
    expect(dispose).not.toHaveBeenCalled();

    expect(cache.release(material)).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it('leaves a material it never issued alone', () => {
    const cache = new MaterialCache();
    const stranger = plainMaterial();
    const dispose = vi.spyOn(stranger, 'dispose');

    expect(cache.owns(stranger)).toBe(false);
    expect(cache.release(stranger)).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
  });

  it('names a material after its key, so merge and budget agree with it', () => {
    const cache = new MaterialCache();

    expect(cache.acquire('wall', plainMaterial).name).toBe('wall');

    const named = new MeshStandardMaterial();
    named.name = 'chosen';
    expect(cache.acquire('ceiling', () => named).name).toBe('chosen');
  });

  it('refuses to issue one material under two keys', () => {
    const cache = new MaterialCache();
    const material = cache.acquire('wall', plainMaterial);

    expect(() => cache.acquire('ceiling', () => material)).toThrow(RangeError);
  });

  it('keeps a texture that another live material still refers to', () => {
    const cache = new MaterialCache();
    const texture = new DataTexture(new Uint8Array(4), 1, 1);
    const dispose = vi.spyOn(texture, 'dispose');

    const first = cache.acquire('wall', () => {
      const material = new MeshStandardMaterial();
      material.map = texture;
      return material;
    });
    cache.acquire('ceiling', () => {
      const material = new MeshStandardMaterial();
      material.map = texture;
      return material;
    });

    cache.release(first);
    expect(dispose).not.toHaveBeenCalled();

    cache.clear();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('frees everything when it is cleared, whatever the counts say', () => {
    const cache = new MaterialCache();
    const material = cache.acquire('wall', plainMaterial);
    cache.acquire('wall', plainMaterial);
    cache.acquire('ceiling', plainMaterial);
    const dispose = vi.spyOn(material, 'dispose');

    expect(cache.clear()).toBe(2);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it('offers one shared cache, which is the only module state in the package', () => {
    expect(sharedMaterialCache).toBeInstanceOf(MaterialCache);
  });
});

/* -------------------------------------------------------------------------- */
/* ResourceLedger.                                                             */
/* -------------------------------------------------------------------------- */

describe('ResourceLedger', () => {
  it('counts a geometry once however many meshes hold it', () => {
    const ledger = new ResourceLedger();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = plainMaterial();
    const group = new Group();
    group.add(new Mesh(geometry, material));
    group.add(new Mesh(geometry, material));

    ledger.track(group);
    ledger.track(group);

    expect(ledger.counts).toEqual({ geometries: 1, materials: 1, textures: 0 });
  });

  it('counts the textures a material refers to', () => {
    const ledger = new ResourceLedger();
    const material = new MeshStandardMaterial();
    material.map = new DataTexture(new Uint8Array(4), 1, 1);
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), material));

    ledger.track(group);

    expect(ledger.counts.textures).toBe(1);
  });

  it('notices a resource being freed by somebody other than disposeFloor', () => {
    const ledger = new ResourceLedger();
    const geometry = new BoxGeometry(1, 1, 1);
    ledger.trackGeometry(geometry);

    expect(ledger.counts.geometries).toBe(1);
    geometry.dispose();
    expect(ledger.counts.geometries).toBe(0);
  });

  it('warns after three consecutive rises, and only once for the run', () => {
    const ledger = new ResourceLedger();
    const raised: string[] = [];

    for (let step = 0; step < 8; step += 1) {
      ledger.trackGeometry(new BoxGeometry(1, 1, 1));
      for (const warning of ledger.sample()) {
        raised.push(warning.message);
      }
    }

    expect(raised).toHaveLength(1);
    expect(raised[0]).toContain('hình học');
    expect(raised[0]).toContain('tăng liên tục');
  });

  it('says nothing while the count holds steady', () => {
    const ledger = new ResourceLedger();
    const geometry = new BoxGeometry(1, 1, 1);
    ledger.trackGeometry(geometry);

    const raised = [0, 1, 2, 3, 4, 5].flatMap(() => [...ledger.sample()]);

    expect(raised).toEqual([]);
  });

  it('warns again once the run has been broken', () => {
    const ledger = new ResourceLedger();
    const raised: string[] = [];
    const record = (): void => {
      for (const warning of ledger.sample()) {
        raised.push(warning.resource);
      }
    };

    const kept: BoxGeometry[] = [];
    const grow = (): void => {
      const geometry = new BoxGeometry(1, 1, 1);
      kept.push(geometry);
      ledger.trackGeometry(geometry);
      record();
    };

    for (let step = 0; step < 5; step += 1) {
      grow();
    }
    expect(raised).toEqual(['geometries']);

    // Break the run: free everything, sample twice so the tail is no longer rising.
    for (const geometry of kept) {
      geometry.dispose();
    }
    record();
    record();

    for (let step = 0; step < 5; step += 1) {
      grow();
    }

    expect(raised).toEqual(['geometries', 'geometries']);
  });

  it('reports how far the count climbed', () => {
    const ledger = new ResourceLedger({ growthLimit: 2 });
    let warning: LeakWarning | undefined;

    for (let step = 0; step < 4; step += 1) {
      ledger.trackGeometry(new BoxGeometry(1, 1, 1));
      const raised = ledger.sample();
      if (raised.length > 0) {
        warning = raised[0];
      }
    }

    expect(warning?.resource).toBe('geometries');
    expect(warning?.counts).toEqual([1, 2, 3]);
    expect(warning?.growth).toBe(2);
  });

  it('stops tracking without freeing anything when it is told to forget', () => {
    const ledger = new ResourceLedger();
    const geometry = new BoxGeometry(1, 1, 1);
    const dispose = vi.spyOn(geometry, 'dispose');
    ledger.trackGeometry(geometry);

    ledger.forget();

    expect(ledger.counts.geometries).toBe(0);
    expect(ledger.history).toHaveLength(0);
    expect(dispose).not.toHaveBeenCalled();
  });

  it('keeps its history to the limit it was given', () => {
    const ledger = new ResourceLedger({ historyLimit: 3 });

    for (let step = 0; step < 10; step += 1) {
      ledger.sample();
    }

    expect(ledger.history).toHaveLength(3);
  });
});
