/**
 * Draw-call folding for the stage: every grower's meshes, one per material.
 *
 * present builds a piece as a dozen boxes and a door as a leaf, a frame and two
 * handles — about 570 meshes for the demo house, each drawn twice a frame (sun
 * shadow + colour), which is what made S05 CPU-bound on an integrated GPU.
 * Within one grower every mesh reads the same growth uniforms and the clamp
 * works in world space, so meshes that share a material can be one geometry
 * in the container's frame without any change on screen. Growers stay whole:
 * a wall still rises on its own, a piece still grows on its own.
 *
 * Only plain meshes fold: one material, no morphs, not instanced or skinned,
 * not interleaved, and the same attribute layout as the rest of the batch
 * (`mergeGeometries` needs it). Anything else stays as it was. The sources are
 * dropped, not disposed: they were never drawn (no GPU copy) and present may
 * share a primitive's geometry between pieces.
 */

import { Matrix4, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const local = new Matrix4();
const inverse = new Matrix4();

function layoutOf(geometry: BufferGeometry): string | null {
  if (Object.keys(geometry.morphAttributes).length > 0) {
    return null;
  }
  const parts: string[] = [geometry.index === null ? 'n' : 'i'];
  for (const [name, attribute] of Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))) {
    if (!('array' in attribute) || (attribute as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute === true) {
      return null;
    }
    parts.push(`${name}:${attribute.itemSize}:${attribute.array.constructor.name}:${attribute.normalized ? 1 : 0}`);
  }
  return parts.join('|');
}

/**
 * Fold the visible plain meshes under `container` into one mesh per material
 * (and shadow / render-order setting), added to `container`. Returns how many
 * meshes were folded away.
 */
export function foldMeshes(container: Object3D): number {
  container.updateMatrixWorld(true);
  inverse.copy(container.matrixWorld).invert();
  const batches = new Map<string, { material: Material; mesh: Mesh; geometries: BufferGeometry[]; sources: Mesh[] }>();
  container.traverseVisible((node) => {
    const mesh = node as Mesh;
    if (mesh === container || mesh.isMesh !== true || Array.isArray(mesh.material)) {
      return;
    }
    if ((mesh as { isInstancedMesh?: boolean }).isInstancedMesh === true || (mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh === true) {
      return;
    }
    const layout = layoutOf(mesh.geometry);
    if (layout === null) {
      return;
    }
    const material = mesh.material;
    const key = `${material.uuid}|${layout}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
    const batch = batches.get(key) ?? { material, mesh, geometries: [], sources: [] };
    local.multiplyMatrices(inverse, mesh.matrixWorld);
    batch.geometries.push(mesh.geometry.clone().applyMatrix4(local));
    batch.sources.push(mesh);
    batches.set(key, batch);
  });

  let folded = 0;
  for (const batch of batches.values()) {
    const merged = batch.sources.length > 1 ? mergeGeometries(batch.geometries) : null;
    for (const geometry of batch.geometries) {
      geometry.dispose();
    }
    if (merged === null) {
      continue;
    }
    const mesh = new Mesh(merged, batch.material);
    mesh.castShadow = batch.mesh.castShadow;
    mesh.receiveShadow = batch.mesh.receiveShadow;
    mesh.renderOrder = batch.mesh.renderOrder;
    mesh.customDepthMaterial = batch.mesh.customDepthMaterial;
    mesh.name = 'folded';
    for (const source of batch.sources) {
      // A source's children (a leaf's handles) are folded too, or stay plain; keep the plain ones.
      for (const child of [...source.children]) {
        if (!batch.sources.includes(child as Mesh)) {
          source.parent?.attach(child);
        }
      }
      source.removeFromParent();
    }
    container.add(mesh);
    folded += batch.sources.length;
  }
  return folded;
}
