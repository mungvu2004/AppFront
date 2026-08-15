/**
 * Batching a storey into a handful of draw calls without losing a single object.
 *
 * `wall.ts` and `floor.ts` build one mesh per wall, per slab, per door. That is
 * the right shape for the model and the wrong shape for a graphics card: a plan
 * with forty-eight walls, fourteen rooms and thirty-four openings is a hundred
 * and ten draw calls before any furniture arrives, and a draw call costs the same
 * whether it draws a cathedral or a doorstep. Merging them into one buffer per
 * material is the whole of the fix.
 *
 * The catch is the reason a naive merge is worse than no merge: once forty-eight
 * walls are one mesh, a click returns "the mesh" and the interface can no longer
 * say *which* wall, which is the only question a QC screen ever asks. So the
 * merge keeps a **vertex range table**: every part records where its vertices
 * landed in the merged buffer, so the reverse lookup that `readPartData` used to
 * do per mesh is done per range instead, and nothing is lost.
 *
 * That table pays for itself twice. `entityAtHit` turns a raycast back into a
 * wall id; `selectionRanges` turns a set of wall ids back into the spans of the
 * buffer that draw them, which is what a highlight needs — either as geometry
 * groups swapped to a second material, or as a draw range.
 *
 * Repeated geometry is not merged at all. Forty chairs of one design are one
 * `InstancedMesh` holding one geometry and forty matrices; copying the chair's
 * vertices forty times into a buffer would spend forty times the memory to draw
 * the same thing. Two meshes count as repeats when they **share the geometry
 * object**, which is how a furniture library is authored in the first place: load
 * the chair once, place it many times.
 *
 * Every function here is pure with respect to what it is given. No input mesh,
 * geometry, material or `userData` is written to; geometries are cloned before
 * they are transformed. The two things a batch does **share** with its sources
 * are the material and — for instancing — the geometry, because sharing them is
 * the point; a caller that disposes an original while a batch is still on screen
 * disposes the batch with it.
 */

import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Material,
  type Object3D,
} from 'three';

import type { LevelId } from '@/domain/spatial/types';

import { readPartData, type BuildEntityId, type BuildPartKind, type PartUserData } from './scene';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** A span of the merged vertex buffer. */
export interface VertexRange {
  /** First vertex, counted in vertices and not in floats. */
  readonly start: number;
  readonly count: number;
}

/** Where one model entity landed in a merged buffer. */
export interface MergedPart extends VertexRange {
  readonly entityId: BuildEntityId;
  readonly kind: BuildPartKind;
  readonly levelId: LevelId;
}

/** Which instance of an instanced batch one model entity is. */
export interface InstancedPart {
  readonly entityId: BuildEntityId;
  readonly kind: BuildPartKind;
  readonly levelId: LevelId;
  readonly instanceId: number;
}

/** Many parts copied into one buffer, drawn in one call. */
export interface MergedBatch {
  readonly kind: 'merged';
  /** The material key the parts were grouped by. */
  readonly key: string;
  readonly mesh: Mesh;
  /** The range table, ordered by `start` and covering the buffer exactly once. */
  readonly parts: readonly MergedPart[];
}

/** One geometry drawn many times, one matrix per placement. */
export interface InstancedBatch {
  readonly kind: 'instanced';
  readonly key: string;
  readonly mesh: InstancedMesh;
  /** The range table, ordered by `instanceId`. */
  readonly parts: readonly InstancedPart[];
}

/** A batch of either sort. */
export type MergeBatch = MergedBatch | InstancedBatch;

/** One part of one batch: what a lookup by entity id hands back. */
export interface PartLocation {
  readonly batch: MergeBatch;
  readonly part: MergedPart | InstancedPart;
}

/** Why a mesh was left out of the batches. */
export type MergeSkipReason =
  /** Nothing tagged it, so a batch could not say what it stands for. */
  | 'noPartData'
  /** Several materials on one mesh; its geometry groups have their own story. */
  | 'multipleMaterials'
  /** No position attribute, or no vertices in it. */
  | 'noGeometry';

/** A mesh that was not batched, and the sentence explaining it. */
export interface SkippedMesh {
  readonly name: string;
  readonly reason: MergeSkipReason;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

/**
 * What `mergeByMaterial` produced.
 *
 * `index` maps an entity to **every** part it owns, not to one: a room is drawn
 * by two meshes, its floor slab and its ceiling, and selecting the room has to
 * find both. A wall owns exactly one part and still comes back as a list of one,
 * so a caller never has to know which kind of entity it is holding.
 */
export interface MergeResult {
  readonly batches: readonly MergeBatch[];
  /** Every entity in the batches, so a lookup by id costs nothing. */
  readonly index: ReadonlyMap<BuildEntityId, readonly PartLocation[]>;
  readonly skipped: readonly SkippedMesh[];
}

/** How the batching is to be grouped and when it should instance. */
export interface MergeOptions {
  /**
   * What decides that two meshes can be drawn together.
   *
   * The default reads the material — its name when it has one, its uuid when it
   * does not — so a caller that shares one material per colour token gets one
   * batch per token. Override it to split further, for example to keep walls and
   * slabs apart even when they carry the same material.
   */
  readonly materialKey?: (mesh: Mesh) => string;
  /**
   * How many meshes must share a geometry before they are drawn instanced.
   *
   * Two is the honest threshold: the second copy of a chair already costs more to
   * merge than to instance.
   */
  readonly instanceThreshold?: number;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** Below two copies there is nothing to instance. */
const MIN_INSTANCE_THRESHOLD = 2;

/** A mesh that passed the checks, with everything the batching needs. */
interface Candidate {
  readonly mesh: Mesh;
  readonly data: PartUserData;
  readonly material: Material;
  readonly geometry: BufferGeometry;
  /** The mesh's own transform, read without touching it. */
  readonly matrix: Matrix4;
}

function defaultMaterialKey(mesh: Mesh): string {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return material.map((entry) => entry.uuid).join('+');
  }
  return material.name !== '' ? material.name : material.uuid;
}

/**
 * The mesh's own transform, as a fresh matrix.
 *
 * `Object3D.matrix` is only correct after `updateMatrix`, and calling that would
 * write to the input. Composing a new matrix from the three public fields reads
 * the same information and leaves the mesh exactly as it was found.
 *
 * Only the mesh's **own** transform is baked, never its parents': a batch is
 * meant to be added where its sources were, so a parent transform applies to it
 * unchanged.
 */
function localMatrixOf(mesh: Mesh): Matrix4 {
  return new Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale);
}

/** Sort the meshes into the ones that can be batched and the ones that cannot. */
function screenMeshes(
  meshes: readonly Mesh[],
): { readonly candidates: readonly Candidate[]; readonly skipped: readonly SkippedMesh[] } {
  const candidates: Candidate[] = [];
  const skipped: SkippedMesh[] = [];

  const refuse = (mesh: Mesh, reason: MergeSkipReason, detail: string): void => {
    const name = mesh.name === '' ? '(không tên)' : mesh.name;
    skipped.push({ name, reason, message: `Lưới ${name} ${detail} nên không được gộp.` });
  };

  for (const mesh of meshes) {
    const data = readPartData(mesh);
    if (data === null) {
      refuse(mesh, 'noPartData', 'không mang userData trỏ về mã đối tượng');
      continue;
    }

    if (Array.isArray(mesh.material)) {
      refuse(mesh, 'multipleMaterials', 'mang nhiều vật liệu trên cùng một hình học');
      continue;
    }

    if (!mesh.geometry.hasAttribute('position') || mesh.geometry.getAttribute('position').count === 0) {
      refuse(mesh, 'noGeometry', 'không có đỉnh nào để gộp');
      continue;
    }

    candidates.push({
      mesh,
      data,
      material: mesh.material,
      geometry: mesh.geometry,
      matrix: localMatrixOf(mesh),
    });
  }

  return { candidates, skipped };
}

/** Group by a key, keeping the order the keys were first seen in. */
function groupBy<TItem>(
  items: readonly TItem[],
  keyOf: (item: TItem) => string,
): ReadonlyMap<string, readonly TItem[]> {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }

  return groups;
}

/**
 * A copy of the geometry, flattened and moved into place.
 *
 * `toNonIndexed` hands back the very same object when a geometry is already
 * non-indexed, so the clone is not optional: applying the transform to what came
 * back would write straight into the caller's geometry.
 */
function flattenedCopy(geometry: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const copy = geometry.getIndex() === null ? geometry.clone() : geometry.toNonIndexed();
  copy.applyMatrix4(matrix);
  return copy;
}

/**
 * The attributes every geometry in a batch has, at the same item size.
 *
 * An attribute that only some of them carry cannot be merged: the buffer would
 * have holes with no defined value in them, and a shader reading one would draw
 * whatever was left in memory. Those are dropped rather than filled in with a
 * guess. Sorted, so two runs build the same buffer.
 */
function sharedAttributeNames(geometries: readonly BufferGeometry[]): readonly string[] {
  const first = geometries[0];
  if (first === undefined) {
    return [];
  }

  return Object.keys(first.attributes)
    .filter((name) =>
      geometries.every(
        (geometry) =>
          geometry.hasAttribute(name) &&
          geometry.getAttribute(name).itemSize === first.getAttribute(name).itemSize,
      ),
    )
    .sort();
}

/** Copy every geometry's attributes into one buffer, end to end. */
function concatenateGeometries(geometries: readonly BufferGeometry[]): BufferGeometry {
  const merged = new BufferGeometry();
  const totalVertices = geometries.reduce(
    (total, geometry) => total + geometry.getAttribute('position').count,
    0,
  );

  for (const name of sharedAttributeNames(geometries)) {
    const sample = geometries[0]?.getAttribute(name);
    if (sample === undefined) {
      continue;
    }

    const itemSize = sample.itemSize;
    const values = new Float32Array(totalVertices * itemSize);
    let vertex = 0;

    for (const geometry of geometries) {
      const source = geometry.getAttribute(name);
      for (let index = 0; index < source.count; index += 1) {
        for (let component = 0; component < itemSize; component += 1) {
          values[(vertex + index) * itemSize + component] = source.getComponent(index, component);
        }
      }
      vertex += source.count;
    }

    merged.setAttribute(name, new BufferAttribute(values, itemSize));
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/** One batch holding every part whose geometry appears only once. */
function buildMergedBatch(key: string, members: readonly Candidate[]): MergedBatch | null {
  const first = members[0];
  if (first === undefined) {
    return null;
  }

  const geometries = members.map((member) => flattenedCopy(member.geometry, member.matrix));
  const parts: MergedPart[] = [];
  let start = 0;

  members.forEach((member, index) => {
    const count = geometries[index]?.getAttribute('position').count ?? 0;
    parts.push({
      entityId: member.data.entityId,
      kind: member.data.kind,
      levelId: member.data.levelId,
      start,
      count,
    });
    start += count;
  });

  const mesh = new Mesh(concatenateGeometries(geometries), first.material);
  mesh.name = key;
  mesh.userData = { kind: 'mergedBatch', key, entityIds: parts.map((part) => part.entityId) };

  return { kind: 'merged', key, mesh, parts };
}

/** One batch drawing a shared geometry once per placement. */
function buildInstancedBatch(
  key: string,
  ordinal: number,
  members: readonly Candidate[],
): InstancedBatch | null {
  const first = members[0];
  if (first === undefined) {
    return null;
  }

  // The geometry object itself, not a copy: sharing it is the whole saving.
  const mesh = new InstancedMesh(first.geometry, first.material, members.length);
  const parts: InstancedPart[] = [];

  members.forEach((member, instanceId) => {
    mesh.setMatrixAt(instanceId, member.matrix);
    parts.push({
      entityId: member.data.entityId,
      kind: member.data.kind,
      levelId: member.data.levelId,
      instanceId,
    });
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = `${key}#${String(ordinal)}`;
  mesh.userData = {
    kind: 'instancedBatch',
    key,
    entityIds: parts.map((part) => part.entityId),
  };

  return { kind: 'instanced', key, mesh, parts };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/** Every mesh in a subtree, in traversal order, touching nothing. */
export function collectMeshes(root: Object3D): readonly Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && !(object instanceof InstancedMesh)) {
      found.push(object);
    }
  });
  return found;
}

/**
 * Batch a pile of built meshes into a few draw calls, keeping every object
 * selectable.
 *
 * Meshes are grouped by material key. Within a group, any geometry shared by
 * `instanceThreshold` meshes or more becomes an `InstancedMesh`; everything left
 * is copied into one merged buffer. So a storey of unique walls and slabs comes
 * back as one mesh per material, and a room of repeated chairs comes back as one
 * instanced mesh holding one chair.
 *
 * Nothing given to this function is written to. The batches share the material,
 * and an instanced batch shares the geometry, so disposing an original disposes
 * the batch that borrows it.
 *
 * @throws RangeError when `instanceThreshold` is below two.
 */
export function mergeByMaterial(meshes: readonly Mesh[], options: MergeOptions = {}): MergeResult {
  const keyOf = options.materialKey ?? defaultMaterialKey;
  const threshold = options.instanceThreshold ?? MIN_INSTANCE_THRESHOLD;

  if (!Number.isInteger(threshold) || threshold < MIN_INSTANCE_THRESHOLD) {
    throw new RangeError(
      `Instance threshold must be a whole number of at least ` +
        `${String(MIN_INSTANCE_THRESHOLD)}: ${String(threshold)}`,
    );
  }

  const { candidates, skipped } = screenMeshes(meshes);
  const batches: MergeBatch[] = [];

  for (const [key, members] of groupBy(candidates, (candidate) => keyOf(candidate.mesh))) {
    const byGeometry = groupBy(members, (candidate) => candidate.geometry.uuid);
    const unique: Candidate[] = [];
    let ordinal = 0;

    for (const repeats of byGeometry.values()) {
      if (repeats.length >= threshold) {
        const batch = buildInstancedBatch(key, ordinal, repeats);
        if (batch !== null) {
          batches.push(batch);
          ordinal += 1;
        }
        continue;
      }
      unique.push(...repeats);
    }

    const merged = buildMergedBatch(key, unique);
    if (merged !== null) {
      batches.push(merged);
    }
  }

  const index = new Map<BuildEntityId, PartLocation[]>();
  for (const batch of batches) {
    for (const part of batch.parts) {
      const found = index.get(part.entityId);
      if (found === undefined) {
        index.set(part.entityId, [{ batch, part }]);
      } else {
        found.push({ batch, part });
      }
    }
  }

  return { batches, index, skipped };
}

/** Batch every mesh in a subtree. The ergonomic form of `mergeByMaterial`. */
export function mergeGroup(root: Object3D, options: MergeOptions = {}): MergeResult {
  return mergeByMaterial(collectMeshes(root), options);
}

/** Every part one model entity is drawn by; empty when it was not batched. */
export function locateParts(result: MergeResult, entityId: BuildEntityId): readonly PartLocation[] {
  return result.index.get(entityId) ?? [];
}

/**
 * The part covering a vertex of a merged buffer.
 *
 * Binary search over the range table, which is ordered and gap-free by
 * construction, so the cost does not grow with the number of walls on the storey.
 */
export function partAtVertex(batch: MergedBatch, vertexIndex: number): MergedPart | null {
  let low = 0;
  let high = batch.parts.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const part = batch.parts[middle];
    if (part === undefined) {
      return null;
    }
    if (vertexIndex < part.start) {
      high = middle - 1;
    } else if (vertexIndex >= part.start + part.count) {
      low = middle + 1;
    } else {
      return part;
    }
  }

  return null;
}

/** The least a raycast hit has to say for the entity behind it to be found. */
export interface HitLike {
  readonly object: Object3D;
  /** The face that was hit; `a` is the first of its three vertices. */
  readonly face?: { readonly a: number } | null;
  /** Which placement of an instanced batch was hit. */
  readonly instanceId?: number | undefined;
}

/**
 * The model entity a raycast hit, whichever kind of batch it landed on.
 *
 * This is what makes merging safe to do: the interface asks the same question it
 * asked of an unbatched scene — "which wall is this?" — and gets the same answer.
 * A hit on an object that is not a batch falls back to its own `userData`, so a
 * scene holding both batched and loose meshes works without the caller branching.
 */
export function entityAtHit(result: MergeResult, hit: HitLike): BuildEntityId | null {
  for (const batch of result.batches) {
    if (batch.mesh !== hit.object) {
      continue;
    }

    if (batch.kind === 'instanced') {
      const part = hit.instanceId === undefined ? undefined : batch.parts[hit.instanceId];
      return part?.entityId ?? null;
    }

    const vertexIndex = hit.face?.a;
    return vertexIndex === undefined ? null : (partAtVertex(batch, vertexIndex)?.entityId ?? null);
  }

  return readPartData(hit.object)?.entityId ?? null;
}

/**
 * The spans of a merged buffer that draw the given entities, ready to highlight.
 *
 * Neighbouring spans are joined, so selecting a run of walls that happen to sit
 * side by side in the buffer costs one group rather than a dozen. Feed the result
 * to `geometry.addGroup` to draw those vertices with a second material, or to
 * `setDrawRange` to draw them alone.
 */
export function selectionRanges(
  batch: MergedBatch,
  entityIds: Iterable<BuildEntityId>,
): readonly VertexRange[] {
  const wanted = new Set<BuildEntityId>(entityIds);
  const chosen = batch.parts
    .filter((part) => wanted.has(part.entityId))
    .map((part): VertexRange => ({ start: part.start, count: part.count }))
    .sort((first, second) => first.start - second.start);

  const joined: VertexRange[] = [];

  for (const range of chosen) {
    const previous = joined[joined.length - 1];
    if (previous !== undefined && range.start <= previous.start + previous.count) {
      joined[joined.length - 1] = {
        start: previous.start,
        count: Math.max(previous.count, range.start + range.count - previous.start),
      };
      continue;
    }
    joined.push(range);
  }

  return joined;
}
