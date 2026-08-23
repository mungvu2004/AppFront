/**
 * Batching the static part of a presentation into a few draw calls.
 *
 * A procedural piece is a dozen boxes and a pot plant a dozen spheres, and
 * each of them is its own mesh — which is the right shape to build and the
 * wrong shape to draw. A furnished flat comes to seven or eight hundred
 * meshes, and every one costs a draw call per frame and another in the shadow
 * pass, whether it is a wardrobe or a door handle. On a modest laptop that is
 * the difference between a sway and a stutter.
 *
 * This pass walks the roots it is given — the furniture that will never be
 * swapped for a model, the frames, the rails — and folds every opaque mesh
 * into one geometry per material, positioned in the house's own frame. The
 * originals are removed and their geometry released; lights and glass stay
 * where they were (glass has to sort against everything else). Decals — the
 * contact shadows and the drawn pools of light, the meshes that write no depth
 * — fold too: they are drawn after the opaque pass in their own render order,
 * and within a batch their triangles land in the order they were added, which
 * is the order they were drawn in before. Nothing is lost that a presentation
 * needs: the tagged groups still stand where the plan put them, so a count of
 * pieces, a lift or a facing can still be read off the graph.
 *
 * `../build/merge.ts` does the same job for the product's own storeys, with a
 * range table so a merged wall stays selectable. A presentation has no
 * selection and its pieces are nested two groups deep, so it needs the world
 * matrix baked rather than the local one, and nothing to look up afterwards —
 * a smaller tool for a smaller job.
 */

import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Material, type Object3D } from 'three';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** What `mergeStatic` did. */
export interface MergeReport {
  /** Meshes folded into batches and removed. */
  readonly merged: number;
  /** The batches added, one per material and shadow setting. */
  readonly batches: readonly Mesh[];
}

/** One batch in the making. */
interface Batch {
  readonly material: Material;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly renderOrder: number;
  readonly sources: { readonly geometry: BufferGeometry; readonly matrix: Matrix4 }[];
}

/** The attributes every primitive in `pieces/` carries, and so every batch. */
const ATTRIBUTES = ['position', 'normal', 'uv'] as const;

/** Carried when any source has it — the baked occlusion — and white where one does not. */
const COLOR = 'color';

/* -------------------------------------------------------------------------- */
/* Deciding what merges.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Whether a mesh can be folded into a batch: one material that is either
 * opaque or a decal (transparent but writing no depth), the three attributes
 * every batch needs, and no material array — a multi-material mesh has
 * geometry groups with their own story.
 */
export function isBatchable(mesh: Mesh): boolean {
  if (Array.isArray(mesh.material)) {
    return false;
  }
  if (mesh.material.transparent && mesh.material.depthWrite) {
    return false;
  }

  return ATTRIBUTES.every((name) => mesh.geometry.hasAttribute(name));
}

function batchKey(mesh: Mesh, material: Material): string {
  return `${material.uuid}|${mesh.castShadow ? 'c' : ''}${mesh.receiveShadow ? 'r' : ''}|${mesh.renderOrder}`;
}

/** The largest vertex index a 16-bit index buffer can name. */
const MAX_UINT16_INDEX = 0xffff;

/* -------------------------------------------------------------------------- */
/* Concatenating geometry.                                                     */
/* -------------------------------------------------------------------------- */

/** The triangle list of a geometry as indices, whether or not it is indexed. */
function indicesOf(geometry: BufferGeometry): ArrayLike<number> {
  const index = geometry.getIndex();
  if (index !== null) {
    return index.array;
  }
  return Array.from({ length: geometry.getAttribute('position').count }, (_, vertex) => vertex);
}

/**
 * One geometry holding every source, each moved by its matrix.
 *
 * Normals are transformed with the matrix too — `applyMatrix4` does that — so
 * a box turned by a facing still shades as a turned box. The index is 16-bit
 * whenever the vertices fit, which is half the upload and what most GPUs
 * prefer; a batch past 65 536 vertices gets 32 bits.
 */
export function concatGeometries(sources: readonly { geometry: BufferGeometry; matrix: Matrix4 }[]): BufferGeometry {
  const moved = sources.map((source) => source.geometry.clone().applyMatrix4(source.matrix));
  const vertexCount = moved.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
  const indexCount = moved.reduce((sum, geometry) => sum + indicesOf(geometry).length, 0);

  const merged = new BufferGeometry();
  const index = vertexCount - 1 <= MAX_UINT16_INDEX ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;

  const names: readonly string[] = moved.some((geometry) => geometry.hasAttribute(COLOR))
    ? [...ATTRIBUTES, COLOR]
    : ATTRIBUTES;
  for (const name of names) {
    const itemSize = moved.find((geometry) => geometry.hasAttribute(name))?.getAttribute(name).itemSize ?? 3;
    const array = new Float32Array(vertexCount * itemSize);
    let offset = 0;
    for (const geometry of moved) {
      const count = geometry.getAttribute('position').count;
      if (geometry.hasAttribute(name)) {
        array.set(geometry.getAttribute(name).array.subarray(0, count * itemSize), offset);
      } else {
        array.fill(1, offset, offset + count * itemSize);
      }
      offset += count * itemSize;
    }
    merged.setAttribute(name, new BufferAttribute(array, itemSize));
  }

  for (const geometry of moved) {
    const indices = indicesOf(geometry);
    for (let i = 0; i < indices.length; i += 1) {
      index[indexOffset + i] = (indices[i] ?? 0) + vertexOffset;
    }
    indexOffset += indices.length;
    vertexOffset += geometry.getAttribute('position').count;
    geometry.dispose();
  }

  merged.setIndex(new BufferAttribute(index, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/* -------------------------------------------------------------------------- */
/* The pass.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fold every batchable mesh under `roots` into one mesh per material under
 * `into`, in `into`'s frame.
 *
 * `into` must be an ancestor of every root — the world matrices are read
 * relative to it, so it is updated first and must carry no transform of its
 * own at the time (the house does not: it is positioned after assembly).
 */
export function mergeStatic(roots: readonly Object3D[], into: Object3D): MergeReport {
  into.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(into.matrixWorld).invert();
  const batches = new Map<string, Batch>();
  const removed: Mesh[] = [];

  for (const root of roots) {
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !isBatchable(object)) {
        return;
      }

      const material = object.material as Material;
      const key = batchKey(object, material);
      const batch = batches.get(key) ?? {
        material,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        renderOrder: object.renderOrder,
        sources: [],
      };
      batch.sources.push({ geometry: object.geometry, matrix: new Matrix4().multiplyMatrices(inverse, object.matrixWorld) });
      batches.set(key, batch);
      removed.push(object);
    });
  }

  const added: Mesh[] = [];
  for (const batch of batches.values()) {
    const mesh = new Mesh(concatGeometries(batch.sources), batch.material);
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;
    mesh.renderOrder = batch.renderOrder;
    mesh.name = 'batch';
    into.add(mesh);
    added.push(mesh);
  }

  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }

  return { merged: removed.length, batches: added };
}
