import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import type { LevelId, WallId } from '@/domain/spatial/types';

import { tagPart } from '../../build/scene';
import { firstEntityHit, resolveHit, type RayIntersection } from '../hitTest';

const LEVEL_ID: LevelId = 'L-00000100AA';
const WALL = 'W-00000100AA' as WallId;

/** A loose wall mesh, tagged the way `scene.ts` tags one. */
function wallMesh(): Mesh {
  return tagPart(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), {
    entityId: WALL,
    kind: 'wall',
    levelId: LEVEL_ID,
  });
}

/** A mesh the scene never tagged, so no lookup can name it. */
function strayMesh(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
}

function crossing(object: Mesh, normals: Partial<Pick<RayIntersection, 'face' | 'normal'>> = {}): RayIntersection {
  return {
    distance: 1,
    face: { a: 0 },
    object,
    point: new Vector3(0, 0, 0),
    ...normals,
  };
}

/** Asserts a direction without ever comparing two floats for equality. */
function expectDirection(actual: Vector3 | null | undefined, expected: Vector3): void {
  expect(actual).not.toBeNull();
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.z).toBeCloseTo(expected.z, 6);
}

describe('the surface normal of a hit', () => {
  it('is null when the crossing carried none, as a merged buffer of positions does', () => {
    expect(resolveHit(crossing(wallMesh()))?.normal).toBeNull();
  });

  it('is null when the ray met no face at all', () => {
    const mesh = wallMesh();

    expect(resolveHit({ distance: 1, face: null, object: mesh, point: new Vector3() })?.normal).toBeNull();
  });

  it('falls back on the flat normal of the triangle that was hit', () => {
    const hit = resolveHit(crossing(wallMesh(), { face: { a: 0, normal: new Vector3(0, 0, 1) } }));

    expectDirection(hit?.normal, new Vector3(0, 0, 1));
  });

  it('prefers the interpolated normal, which the caster already turned towards the ray', () => {
    const hit = resolveHit(
      crossing(wallMesh(), {
        face: { a: 0, normal: new Vector3(0, 0, 1) },
        normal: new Vector3(0, 1, 0),
      }),
    );

    expectDirection(hit?.normal, new Vector3(0, 1, 0));
  });

  it('turns a normal out of the object it belongs to and into world space', () => {
    const mesh = wallMesh();
    // A quarter turn about the vertical axis carries +z round to +x.
    mesh.rotation.y = Math.PI / 2;
    mesh.updateMatrixWorld(true);

    const hit = resolveHit(crossing(mesh, { normal: new Vector3(0, 0, 1) }));

    expectDirection(hit?.normal, new Vector3(1, 0, 0));
  });

  it('stays perpendicular to a surface the object stretches unevenly', () => {
    const mesh = wallMesh();
    mesh.scale.set(1, 2, 1);
    mesh.updateMatrixWorld(true);

    const hit = resolveHit(crossing(mesh, { normal: new Vector3(1, 1, 0) }));

    // The inverse transpose halves the stretched component; carrying the normal
    // through the world matrix itself would double it instead, and the result
    // would lean into the surface rather than off it.
    expectDirection(hit?.normal, new Vector3(1, 0.5, 0).normalize());
    expect(hit?.normal?.y).toBeLessThan(hit?.normal?.x as number);
  });

  it('is unit length however long the normal it was given was', () => {
    const hit = resolveHit(crossing(wallMesh(), { normal: new Vector3(0, 0, 42) }));

    expect(hit?.normal?.length()).toBeCloseTo(1, 6);
  });

  it('is null when the world matrix collapses the surface to nothing', () => {
    const mesh = wallMesh();
    mesh.scale.set(0, 1, 1);
    mesh.updateMatrixWorld(true);

    expect(resolveHit(crossing(mesh, { normal: new Vector3(1, 0, 0) }))?.normal).toBeNull();
  });

  it('is a fresh vector per hit, so a caller may keep the one it was handed', () => {
    const mesh = wallMesh();
    const first = resolveHit(crossing(mesh, { normal: new Vector3(0, 0, 1) }));
    const second = resolveHit(crossing(mesh, { normal: new Vector3(0, 1, 0) }));

    expect(first?.normal).not.toBe(second?.normal);
    expectDirection(first?.normal, new Vector3(0, 0, 1));
  });

  it('belongs to the crossing the walk settled on, not to the ones it stepped over', () => {
    const hit = firstEntityHit([
      crossing(strayMesh(), { normal: new Vector3(0, 1, 0) }),
      crossing(wallMesh(), { normal: new Vector3(0, 0, 1) }),
    ]);

    expect(hit?.entityId).toBe(WALL);
    expectDirection(hit?.normal, new Vector3(0, 0, 1));
  });
});
