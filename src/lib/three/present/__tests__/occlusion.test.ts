import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  bakeVertexOcclusion,
  boxOcclusion,
  ensureWhiteVertexColors,
  meshOccluders,
  OCCLUSION_REACH,
  occlusionToShade,
} from '../occlusion';

const solid = (): MeshStandardMaterial => new MeshStandardMaterial();

describe('boxOcclusion', () => {
  const box = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));

  it('is nothing beyond the reach and grows towards the box', () => {
    const facing = new Vector3(-1, 0, 0);
    expect(boxOcclusion(new Vector3(-OCCLUSION_REACH - 0.01, 0.5, 0.5), facing.clone().negate(), box)).toBe(0);

    const near = boxOcclusion(new Vector3(-0.05, 0.5, 0.5), new Vector3(1, 0, 0), box);
    const far = boxOcclusion(new Vector3(-0.25, 0.5, 0.5), new Vector3(1, 0, 0), box);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('scales with how squarely the normal faces the box, and vanishes facing away', () => {
    const point = new Vector3(-0.1, 0.5, 0.5);
    const towards = boxOcclusion(point, new Vector3(1, 0, 0), box);
    const sideways = boxOcclusion(point, new Vector3(0, 1, 0), box);
    const away = boxOcclusion(point, new Vector3(-1, 0, 0), box);

    expect(towards).toBeGreaterThan(sideways);
    expect(sideways).toBe(0);
    expect(away).toBe(0);
  });

  it('occludes a touching vertex whatever its normal — the foot of a leg is dark all round', () => {
    const touching = new Vector3(0.5, 1, 0.5);
    expect(boxOcclusion(touching, new Vector3(0, 1, 0), box)).toBeCloseTo(1);
    expect(boxOcclusion(touching, new Vector3(1, 0, 0), box)).toBeCloseTo(1);
  });
});

describe('occlusionToShade', () => {
  it('darkens with occlusion but never past the floor', () => {
    expect(occlusionToShade(0)).toBe(1);
    expect(occlusionToShade(0.5)).toBeLessThan(1);
    expect(occlusionToShade(99)).toBeGreaterThan(0.3);
    expect(occlusionToShade(99)).toBeLessThan(occlusionToShade(0.5));
  });
});

describe('meshOccluders', () => {
  it('collects every solid mesh with its world box, and skips decals and glass', () => {
    const root = new Group();
    const cube = new Mesh(new BoxGeometry(1, 1, 1), solid());
    cube.position.set(5, 0, 0);
    const decal = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ transparent: true }));
    root.add(cube);
    root.add(decal);

    const occluders = meshOccluders(root);

    expect(occluders).toHaveLength(1);
    expect(occluders[0]?.owner).toBe(cube);
    expect(occluders[0]?.box.min.x).toBeCloseTo(4.5);
  });
});

describe('bakeVertexOcclusion', () => {
  it('writes a colour per vertex: darker near a neighbour, untouched by itself', () => {
    const root = new Group();
    const piece = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), solid());
    piece.position.set(0, 0.2, 0);
    const wall = new Mesh(new BoxGeometry(0.4, 2, 4), solid());
    wall.position.set(-0.4, 1, 0);
    root.add(piece);
    root.add(wall);

    const shaded = bakeVertexOcclusion([piece], meshOccluders(root));

    expect(shaded).toBe(1);
    const colors = piece.geometry.getAttribute('color');
    const positions = piece.geometry.getAttribute('position');
    expect(colors.count).toBe(positions.count);

    // Vertices on the wall side are darker than vertices on the open side.
    let nearWall = 1;
    let open = 1;
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      if (positions.getX(vertex) < 0) {
        nearWall = Math.min(nearWall, colors.getX(vertex));
      } else {
        open = Math.min(open, colors.getX(vertex));
      }
    }
    expect(nearWall).toBeLessThan(open);
    expect(open).toBeLessThanOrEqual(1);
  });

  it('bakes alone: a piece with no neighbours keeps a plain white attribute', () => {
    const lone = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), solid());
    lone.position.set(0, 5, 0);

    bakeVertexOcclusion([lone], meshOccluders(lone));

    const colors = lone.geometry.getAttribute('color');
    for (let vertex = 0; vertex < colors.count; vertex += 1) {
      expect(colors.getX(vertex)).toBe(1);
    }
  });

  it('reads world transforms: a piece moved beside the wall is the one that darkens', () => {
    const root = new Group();
    const wall = new Mesh(new BoxGeometry(0.4, 2, 4), solid());
    wall.position.set(2, 1, 0);
    const nested = new Group();
    nested.position.set(1.7, 0, 0);
    const piece = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), solid());
    piece.position.set(0, 0.1, 0);
    nested.add(piece);
    root.add(wall);
    root.add(nested);

    bakeVertexOcclusion([nested], meshOccluders(root));

    const colors = piece.geometry.getAttribute('color');
    let darkest = 1;
    for (let vertex = 0; vertex < colors.count; vertex += 1) {
      darkest = Math.min(darkest, colors.getX(vertex));
    }
    expect(darkest).toBeLessThan(1);
  });
});

describe('ensureWhiteVertexColors', () => {
  it('adds a white attribute once and leaves an existing one alone', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), solid());
    ensureWhiteVertexColors(mesh);

    const colors = mesh.geometry.getAttribute('color');
    expect(colors.count).toBe(mesh.geometry.getAttribute('position').count);
    expect(colors.getX(0)).toBe(1);

    bakeVertexOcclusion([mesh], [{ box: new Box3(new Vector3(-2, 0, -2), new Vector3(2, 0.01, 2)), owner: null }]);
    const baked = mesh.geometry.getAttribute('color');
    ensureWhiteVertexColors(mesh);
    expect(mesh.geometry.getAttribute('color')).toBe(baked);
  });
});
