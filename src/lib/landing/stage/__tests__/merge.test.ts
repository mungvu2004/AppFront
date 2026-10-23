// @vitest-environment node
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { foldMeshes } from '../merge';

describe('foldMeshes', () => {
  it('folds same-material meshes into one in the container frame and keeps the rest', () => {
    const a = new MeshBasicMaterial();
    const b = new MeshBasicMaterial();
    const root = new Group();
    root.position.set(5, 0, 0);
    const leaf = new Mesh(new BoxGeometry(1, 1, 1), a);
    const handle = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), b);
    handle.position.set(0, 1, 0);
    leaf.add(handle);
    const other = new Mesh(new BoxGeometry(1, 1, 1), a);
    other.position.set(2, 0, 0);
    root.add(leaf, other);

    expect(foldMeshes(root)).toBe(2);
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    expect(meshes).toHaveLength(2);
    const folded = meshes.find((m) => m.material === a);
    folded?.geometry.computeBoundingBox();
    expect(folded?.geometry.boundingBox?.min.x).toBeCloseTo(-0.5);
    expect(folded?.geometry.boundingBox?.max.x).toBeCloseTo(2.5);
    // The lone handle survives its folded leaf, at the same world place.
    handle.updateWorldMatrix(true, false);
    expect(handle.parent).toBe(root);
    expect(handle.getWorldPosition(handle.position.clone()).toArray()).toEqual([5, 1, 0]);
  });
});
